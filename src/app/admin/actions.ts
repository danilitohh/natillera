"use server";

import { redirect } from "next/navigation";

import { logoutAdmin, requireAdminSession } from "@/lib/auth";
import { calculateDurationMonths, getDefaultSettlementDate, parseStoredDate } from "@/lib/date";
import {
  buildSettlementPreview,
  calculateDashboardMetrics,
  createLoanInstallmentPlan,
  getLoanSnapshot,
} from "@/lib/finance/calculations";
import { LOAN_MONTHLY_RATE, LUNCH_FIXED_AMOUNT, RAFFLE_FIXED_AMOUNT } from "@/lib/constants";
import { createId, updateDatabase } from "@/lib/store";
import {
  CashAdjustment,
  LoanStatus,
  NatilleraStatus,
  SettlementRecord,
} from "@/lib/types";
import {
  buildMessageUrl,
  parseBoolean,
  parseNumberInput,
  parseString,
  roundCurrency,
} from "@/lib/utils";

async function ensureAdmin(): Promise<void> {
  await requireAdminSession();
}

function redirectWithSuccess(path: string, message: string): never {
  redirect(buildMessageUrl(path, { success: message }));
}

function redirectWithError(path: string, message: string): never {
  redirect(buildMessageUrl(path, { error: message }));
}

async function runActionOrRedirect(
  path: string,
  callback: () => Promise<void> | void,
): Promise<void> {
  try {
    await callback();
  } catch (error) {
    redirectWithError(
      path,
      error instanceof Error ? error.message : "No fue posible completar la acción.",
    );
  }
}

function assertPositive(value: number, label: string): void {
  if (value < 0) {
    throw new Error(`${label} no puede ser negativo.`);
  }
}

function normalizeLoanStatus(value: string): LoanStatus {
  if (value === "paid" || value === "overdue" || value === "refinanced") {
    return value;
  }

  return "active";
}

function normalizeNatilleraStatus(value: string): NatilleraStatus {
  if (value === "finished" || value === "settled") {
    return value;
  }

  return "active";
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function logoutAction(): Promise<void> {
  await ensureAdmin();
  await logoutAdmin();
  redirect("/login?success=Sesión cerrada.");
}

export async function saveSettingsAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const name = parseString(formData.get("name"));
  const startDate = parseString(formData.get("startDate"));
  const endDate = parseString(formData.get("endDate"));
  const estimatedSettlementDate =
    parseString(formData.get("estimatedSettlementDate")) || getDefaultSettlementDate();
  const status = normalizeNatilleraStatus(parseString(formData.get("status")));

  if (!name || !startDate || !endDate) {
    redirectWithError("/admin/settings", "Completa todos los campos obligatorios.");
  }

  if (parseStoredDate(startDate).getTime() > parseStoredDate(endDate).getTime()) {
    redirectWithError(
      "/admin/settings",
      "La fecha de inicio no puede ser mayor que la fecha final.",
    );
  }

  await runActionOrRedirect("/admin/settings", async () => {
    await updateDatabase((database) => {
      database.settings = {
        ...database.settings,
        name,
        startDate,
        endDate,
        durationMonths: calculateDurationMonths(startDate, endDate),
        estimatedSettlementDate,
        status,
        updatedAt: nowIso(),
      };
    });
  });

  redirectWithSuccess("/admin/settings", "Configuración actualizada.");
}

export async function saveParticipantAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const id = parseString(formData.get("id"));
  const fullName = parseString(formData.get("fullName"));
  const phone = parseString(formData.get("phone"));
  const document = parseString(formData.get("document"));
  const joinedAt = parseString(formData.get("joinedAt"));
  const active = parseBoolean(formData.get("active"));

  if (!fullName || !joinedAt) {
    redirectWithError("/admin/participants", "Nombre y fecha de ingreso son obligatorios.");
  }

  await runActionOrRedirect("/admin/participants", async () => {
    await updateDatabase((database) => {
      const timestamp = nowIso();
      const existing = database.participants.find((participant) => participant.id === id);

      if (existing) {
        existing.fullName = fullName;
        existing.phone = phone || undefined;
        existing.document = document || undefined;
        existing.joinedAt = joinedAt;
        existing.active = active;
        existing.updatedAt = timestamp;
        return;
      }

      database.participants.push({
        id: createId("participant"),
        fullName,
        phone: phone || undefined,
        document: document || undefined,
        joinedAt,
        active,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  });

  redirectWithSuccess("/admin/participants", id ? "Participante actualizado." : "Participante registrado.");
}

export async function toggleParticipantAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const participantId = parseString(formData.get("participantId"));
  const active = parseBoolean(formData.get("active"));

  if (!participantId) {
    redirectWithError("/admin/participants", "Participante no encontrado.");
  }

  await runActionOrRedirect("/admin/participants", async () => {
    await updateDatabase((database) => {
      const participant = database.participants.find((item) => item.id === participantId);

      if (!participant) {
        throw new Error("Participante no encontrado.");
      }

      participant.active = active;
      participant.updatedAt = nowIso();
    });
  });

  redirectWithSuccess(
    "/admin/participants",
    active ? "Participante activado." : "Participante desactivado.",
  );
}

export async function saveContributionAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const id = parseString(formData.get("id"));
  const participantId = parseString(formData.get("participantId"));
  const month = parseNumberInput(formData.get("month"));
  const year = parseNumberInput(formData.get("year"));
  const quotaAmount = parseNumberInput(formData.get("quotaAmount"));
  const amountPaid = parseNumberInput(formData.get("amountPaid"));
  const lateInterestPaid = parseNumberInput(formData.get("lateInterestPaid"));
  const dueDate = parseString(formData.get("dueDate"));
  const paidAt = parseString(formData.get("paidAt"));
  const notes = parseString(formData.get("notes"));

  if (!participantId || !month || !year || !quotaAmount || !dueDate) {
    redirectWithError("/admin/contributions", "Completa los datos del aporte.");
  }

  assertPositive(quotaAmount, "La cuota");
  assertPositive(amountPaid, "El valor pagado");
  assertPositive(lateInterestPaid, "El interés");

  if (amountPaid > quotaAmount) {
    redirectWithError(
      "/admin/contributions",
      "El valor pagado no puede superar la cuota mensual.",
    );
  }

  const maxLateInterest = roundCurrency(quotaAmount * 0.02);

  if (lateInterestPaid > maxLateInterest) {
    redirectWithError(
      "/admin/contributions",
      "El interés de mora no puede superar el 2% de la cuota.",
    );
  }

  await runActionOrRedirect("/admin/contributions", async () => {
    await updateDatabase((database) => {
      const participant = database.participants.find((item) => item.id === participantId);

      if (!participant) {
        throw new Error("Participante no encontrado.");
      }

      const duplicated = database.monthlyContributions.find(
        (record) =>
          record.participantId === participantId &&
          record.month === month &&
          record.year === year &&
          record.id !== id,
      );

      if (duplicated) {
        throw new Error("Ya existe un aporte para ese participante, mes y año.");
      }

      const timestamp = nowIso();
      const existing = database.monthlyContributions.find((record) => record.id === id);

      if (existing) {
        existing.participantId = participantId;
        existing.month = month;
        existing.year = year;
        existing.quotaAmount = quotaAmount;
        existing.amountPaid = amountPaid;
        existing.lateInterestPaid = lateInterestPaid;
        existing.dueDate = dueDate;
        existing.paidAt = paidAt || existing.paidAt;
        existing.notes = notes || undefined;
        existing.updatedAt = timestamp;
        return;
      }

      database.monthlyContributions.push({
        id: createId("contribution"),
        participantId,
        month,
        year,
        quotaAmount,
        amountPaid,
        lateInterestPaid,
        dueDate,
        paidAt: paidAt || undefined,
        notes: notes || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  });

  redirectWithSuccess("/admin/contributions", id ? "Aporte actualizado." : "Aporte registrado.");
}

export async function deleteContributionAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const id = parseString(formData.get("id"));

  await runActionOrRedirect("/admin/contributions", async () => {
    await updateDatabase((database) => {
      database.monthlyContributions = database.monthlyContributions.filter((record) => record.id !== id);
    });
  });

  redirectWithSuccess("/admin/contributions", "Aporte eliminado.");
}

export async function saveTripContributionAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const id = parseString(formData.get("id"));
  const participantId = parseString(formData.get("participantId"));
  const month = parseNumberInput(formData.get("month"));
  const year = parseNumberInput(formData.get("year"));
  const quotaAmount = parseNumberInput(formData.get("quotaAmount"));
  const amountPaid = parseNumberInput(formData.get("amountPaid"));
  const dueDate = parseString(formData.get("dueDate"));
  const paidAt = parseString(formData.get("paidAt"));
  const notes = parseString(formData.get("notes"));

  if (!participantId || !month || !year || !quotaAmount || !dueDate) {
    redirectWithError("/admin/covenas", "Completa los datos del ahorro para Coveñas.");
  }

  assertPositive(quotaAmount, "La cuota");
  assertPositive(amountPaid, "El valor pagado");

  if (amountPaid > quotaAmount) {
    redirectWithError(
      "/admin/covenas",
      "El valor pagado no puede superar la cuota mensual del viaje.",
    );
  }

  await runActionOrRedirect("/admin/covenas", async () => {
    await updateDatabase((database) => {
      const participant = database.participants.find((item) => item.id === participantId);

      if (!participant) {
        throw new Error("Participante no encontrado.");
      }

      const duplicated = database.tripContributions.find(
        (record) =>
          record.participantId === participantId &&
          record.month === month &&
          record.year === year &&
          record.id !== id,
      );

      if (duplicated) {
        throw new Error("Ya existe un ahorro de Coveñas para ese participante, mes y año.");
      }

      const timestamp = nowIso();
      const existing = database.tripContributions.find((record) => record.id === id);

      if (existing) {
        existing.participantId = participantId;
        existing.month = month;
        existing.year = year;
        existing.quotaAmount = quotaAmount;
        existing.amountPaid = amountPaid;
        existing.dueDate = dueDate;
        existing.paidAt = paidAt || existing.paidAt;
        existing.notes = notes || undefined;
        existing.updatedAt = timestamp;
        return;
      }

      database.tripContributions.push({
        id: createId("trip"),
        participantId,
        month,
        year,
        quotaAmount,
        amountPaid,
        dueDate,
        paidAt: paidAt || undefined,
        notes: notes || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  });

  redirectWithSuccess(
    "/admin/covenas",
    id ? "Ahorro de Coveñas actualizado." : "Ahorro de Coveñas registrado.",
  );
}

export async function deleteTripContributionAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const id = parseString(formData.get("id"));

  await runActionOrRedirect("/admin/covenas", async () => {
    await updateDatabase((database) => {
      database.tripContributions = database.tripContributions.filter(
        (record) => record.id !== id,
      );
    });
  });

  redirectWithSuccess("/admin/covenas", "Registro de viaje eliminado.");
}

export async function saveRaffleEntryAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const id = parseString(formData.get("id"));
  const participantId = parseString(formData.get("participantId"));
  const month = parseNumberInput(formData.get("month"));
  const year = parseNumberInput(formData.get("year"));
  const selectedNumber = parseNumberInput(formData.get("selectedNumber"));
  const amountPaid = parseNumberInput(formData.get("amountPaid"));
  const paidAt = parseString(formData.get("paidAt"));
  const notes = parseString(formData.get("notes"));

  if (!participantId || !month || !year) {
    redirectWithError("/admin/raffles", "Completa los datos de la polla.");
  }

  if (selectedNumber < 0) {
    redirectWithError("/admin/raffles", "El número elegido no puede ser negativo.");
  }

  if (amountPaid > RAFFLE_FIXED_AMOUNT) {
    redirectWithError("/admin/raffles", "El pago de polla no puede superar $5.000.");
  }

  await runActionOrRedirect("/admin/raffles", async () => {
    await updateDatabase((database) => {
      const duplicated = database.raffleEntries.find(
        (record) =>
          record.participantId === participantId &&
          record.month === month &&
          record.year === year &&
          record.id !== id,
      );

      if (duplicated) {
        throw new Error("Ese participante ya tiene un registro de polla para ese mes.");
      }

      const repeatedNumber = database.raffleEntries.find(
        (record) =>
          record.month === month &&
          record.year === year &&
          record.selectedNumber === selectedNumber &&
          record.id !== id,
      );

      if (repeatedNumber) {
        throw new Error("Ese número ya fue elegido para el mismo mes.");
      }

      const timestamp = nowIso();
      const existing = database.raffleEntries.find((record) => record.id === id);

      if (existing) {
        existing.participantId = participantId;
        existing.month = month;
        existing.year = year;
        existing.selectedNumber = selectedNumber;
        existing.fixedAmount = RAFFLE_FIXED_AMOUNT;
        existing.amountPaid = amountPaid;
        existing.paidAt = paidAt || existing.paidAt;
        existing.notes = notes || undefined;
        existing.updatedAt = timestamp;
        return;
      }

      database.raffleEntries.push({
        id: createId("raffle"),
        participantId,
        month,
        year,
        selectedNumber,
        fixedAmount: RAFFLE_FIXED_AMOUNT,
        amountPaid,
        paidAt: paidAt || undefined,
        notes: notes || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  });

  redirectWithSuccess("/admin/raffles", id ? "Registro de polla actualizado." : "Polla registrada.");
}

export async function deleteRaffleEntryAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const id = parseString(formData.get("id"));

  await runActionOrRedirect("/admin/raffles", async () => {
    await updateDatabase((database) => {
      database.raffleEntries = database.raffleEntries.filter((record) => record.id !== id);
    });
  });

  redirectWithSuccess("/admin/raffles", "Registro de polla eliminado.");
}

export async function saveRaffleRoundAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const month = parseNumberInput(formData.get("month"));
  const year = parseNumberInput(formData.get("year"));
  const winnerParticipantId = parseString(formData.get("winnerParticipantId"));
  const drawDate = parseString(formData.get("drawDate")) || new Date().toISOString().slice(0, 10);
  const payoutRecordedAt = parseString(formData.get("payoutRecordedAt"));
  const notes = parseString(formData.get("notes"));

  if (!month || !year || !winnerParticipantId) {
    redirectWithError("/admin/raffles", "Selecciona mes, año y ganador.");
  }

  await runActionOrRedirect("/admin/raffles", async () => {
    await updateDatabase((database) => {
      const winnerEntry = database.raffleEntries.find(
        (entry) =>
          entry.month === month &&
          entry.year === year &&
          entry.participantId === winnerParticipantId,
      );

      if (!winnerEntry) {
        throw new Error("El ganador debe tener un número registrado para ese mes.");
      }

      const timestamp = nowIso();
      const existing = database.raffleRounds.find(
        (round) => round.month === month && round.year === year,
      );

      if (existing) {
        existing.winnerParticipantId = winnerParticipantId;
        existing.winningNumber = winnerEntry.selectedNumber;
        existing.drawDate = drawDate;
        existing.payoutRecordedAt = payoutRecordedAt || undefined;
        existing.notes = notes || undefined;
        existing.updatedAt = timestamp;
        return;
      }

      database.raffleRounds.push({
        id: createId("raffle_round"),
        month,
        year,
        winnerParticipantId,
        winningNumber: winnerEntry.selectedNumber,
        drawDate,
        payoutRecordedAt: payoutRecordedAt || undefined,
        notes: notes || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  });

  redirectWithSuccess("/admin/raffles", "Ganador de polla registrado.");
}

export async function saveLunchAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const id = parseString(formData.get("id"));
  const participantId = parseString(formData.get("participantId"));
  const month = parseNumberInput(formData.get("month"));
  const year = parseNumberInput(formData.get("year"));
  const amountPaid = parseNumberInput(formData.get("amountPaid"));
  const paidAt = parseString(formData.get("paidAt"));
  const notes = parseString(formData.get("notes"));

  if (!participantId || !month || !year) {
    redirectWithError("/admin/lunches", "Completa los datos del almuerzo.");
  }

  if (amountPaid > LUNCH_FIXED_AMOUNT) {
    redirectWithError("/admin/lunches", "El aporte de almuerzos no puede superar $5.000.");
  }

  await runActionOrRedirect("/admin/lunches", async () => {
    await updateDatabase((database) => {
      const duplicated = database.lunches.find(
        (record) =>
          record.participantId === participantId &&
          record.month === month &&
          record.year === year &&
          record.id !== id,
      );

      if (duplicated) {
        throw new Error("Ese participante ya tiene almuerzo registrado para ese mes.");
      }

      const timestamp = nowIso();
      const existing = database.lunches.find((record) => record.id === id);

      if (existing) {
        existing.participantId = participantId;
        existing.month = month;
        existing.year = year;
        existing.fixedAmount = LUNCH_FIXED_AMOUNT;
        existing.amountPaid = amountPaid;
        existing.paidAt = paidAt || existing.paidAt;
        existing.notes = notes || undefined;
        existing.updatedAt = timestamp;
        return;
      }

      database.lunches.push({
        id: createId("lunch"),
        participantId,
        month,
        year,
        fixedAmount: LUNCH_FIXED_AMOUNT,
        amountPaid,
        paidAt: paidAt || undefined,
        notes: notes || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  });

  redirectWithSuccess("/admin/lunches", id ? "Almuerzo actualizado." : "Almuerzo registrado.");
}

export async function deleteLunchAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const id = parseString(formData.get("id"));

  await runActionOrRedirect("/admin/lunches", async () => {
    await updateDatabase((database) => {
      database.lunches = database.lunches.filter((record) => record.id !== id);
    });
  });

  redirectWithSuccess("/admin/lunches", "Registro de almuerzo eliminado.");
}

export async function saveLoanAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const id = parseString(formData.get("id"));
  const participantId = parseString(formData.get("participantId"));
  const principalAmount = parseNumberInput(formData.get("principalAmount"));
  const issuedAt = parseString(formData.get("issuedAt"));
  const installmentCount = parseNumberInput(formData.get("installmentCount"));
  const status = normalizeLoanStatus(parseString(formData.get("status")));
  const notes = parseString(formData.get("notes"));

  if (!participantId || !principalAmount || !issuedAt || !installmentCount) {
    redirectWithError("/admin/loans", "Completa los datos del préstamo.");
  }

  if (installmentCount < 1) {
    redirectWithError("/admin/loans", "El préstamo debe tener al menos una cuota.");
  }

  await runActionOrRedirect("/admin/loans", async () => {
    await updateDatabase((database) => {
      const metrics = calculateDashboardMetrics(database);
      const timestamp = nowIso();
      const existing = database.loans.find((loan) => loan.id === id);
      const existingInstallments = database.loanInstallments.filter((item) => item.loanId === id);
      const effectiveAvailableCash =
        metrics.availableCash + (existing ? existing.principalAmount : 0);

      if (principalAmount > effectiveAvailableCash) {
        throw new Error("La caja disponible es insuficiente para aprobar ese préstamo.");
      }

      if (existing && existingInstallments.some((item) => item.amountPaid > 0)) {
        throw new Error(
          "No se puede editar un préstamo que ya tiene pagos registrados. Registra una refinanciación o crea uno nuevo.",
        );
      }

      const plan = createLoanInstallmentPlan(principalAmount, installmentCount, issuedAt);

      if (existing) {
        existing.participantId = participantId;
        existing.principalAmount = principalAmount;
        existing.issuedAt = issuedAt;
        existing.installmentCount = installmentCount;
        existing.monthlyInterestRate = LOAN_MONTHLY_RATE;
        existing.status = status;
        existing.notes = notes || undefined;
        existing.updatedAt = timestamp;

        database.loanInstallments = database.loanInstallments.filter(
          (item) => item.loanId !== existing.id,
        );

        database.loanInstallments.push(
          ...plan.map((installment) => ({
            id: createId("loan_installment"),
            loanId: existing.id,
            installmentNumber: installment.installmentNumber,
            dueDate: installment.dueDate,
            capitalAmount: installment.capitalAmount,
            interestAmount: installment.interestAmount,
            totalAmount: installment.totalAmount,
            amountPaid: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          })),
        );

        return;
      }

      const loanId = createId("loan");
      database.loans.push({
        id: loanId,
        participantId,
        principalAmount,
        issuedAt,
        installmentCount,
        monthlyInterestRate: LOAN_MONTHLY_RATE,
        status,
        notes: notes || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      database.loanInstallments.push(
        ...plan.map((installment) => ({
          id: createId("loan_installment"),
          loanId,
          installmentNumber: installment.installmentNumber,
          dueDate: installment.dueDate,
          capitalAmount: installment.capitalAmount,
          interestAmount: installment.interestAmount,
          totalAmount: installment.totalAmount,
          amountPaid: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      );
    });
  });

  redirectWithSuccess("/admin/loans", id ? "Préstamo actualizado." : "Préstamo creado.");
}

export async function deleteLoanAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const id = parseString(formData.get("id"));

  await runActionOrRedirect("/admin/loans", async () => {
    await updateDatabase((database) => {
      const installments = database.loanInstallments.filter((installment) => installment.loanId === id);

      if (installments.some((installment) => installment.amountPaid > 0)) {
        throw new Error("No se puede eliminar un préstamo con pagos registrados.");
      }

      database.loans = database.loans.filter((loan) => loan.id !== id);
      database.loanInstallments = database.loanInstallments.filter(
        (installment) => installment.loanId !== id,
      );
    });
  });

  redirectWithSuccess("/admin/loans", "Préstamo eliminado.");
}

export async function recordLoanPaymentAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const installmentId = parseString(formData.get("installmentId"));
  const paymentAmount = parseNumberInput(formData.get("paymentAmount"));
  const paidAt = parseString(formData.get("paidAt")) || new Date().toISOString().slice(0, 10);

  if (!installmentId || paymentAmount <= 0) {
    redirectWithError("/admin/loans", "Ingresa un valor válido para la cuota.");
  }

  await runActionOrRedirect("/admin/loans", async () => {
    await updateDatabase((database) => {
      const installment = database.loanInstallments.find((item) => item.id === installmentId);

      if (!installment) {
        throw new Error("La cuota no existe.");
      }

      const newPaidAmount = installment.amountPaid + paymentAmount;

      if (newPaidAmount > installment.totalAmount) {
        throw new Error("El pago supera el saldo pendiente de la cuota.");
      }

      installment.amountPaid = newPaidAmount;
      installment.paidAt = paidAt;
      installment.updatedAt = nowIso();

      const loan = database.loans.find((item) => item.id === installment.loanId);

      if (loan) {
        const snapshot = getLoanSnapshot(loan, database.loanInstallments);
        loan.status = snapshot.status;
        loan.updatedAt = nowIso();
      }
    });
  });

  redirectWithSuccess("/admin/loans", "Pago de cuota registrado.");
}

export async function saveCashAdjustmentAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const id = parseString(formData.get("id"));
  const date = parseString(formData.get("date"));
  const type = parseString(formData.get("type")) === "expense" ? "expense" : "income";
  const amount = parseNumberInput(formData.get("amount"));
  const description = parseString(formData.get("description"));
  const participantId = parseString(formData.get("participantId"));

  if (!date || !amount || !description) {
    redirectWithError("/admin/cash", "Completa los datos del ajuste.");
  }

  assertPositive(amount, "El valor");

  await runActionOrRedirect("/admin/cash", async () => {
    await updateDatabase((database) => {
      const metrics = calculateDashboardMetrics(database);

      if (type === "expense" && amount > metrics.availableCash) {
        throw new Error("No puedes registrar una salida mayor a la caja disponible.");
      }

      const timestamp = nowIso();
      const existing = database.cashAdjustments.find((adjustment) => adjustment.id === id);

      if (existing) {
        existing.date = date;
        existing.type = type;
        existing.amount = amount;
        existing.description = description;
        existing.participantId = participantId || undefined;
        return;
      }

      const adjustment: CashAdjustment = {
        id: createId("adjustment"),
        date,
        type,
        category: "adjustment",
        amount,
        description,
        participantId: participantId || undefined,
        createdBy: "admin",
        createdAt: timestamp,
      };

      database.cashAdjustments.push(adjustment);
    });
  });

  redirectWithSuccess("/admin/cash", id ? "Ajuste actualizado." : "Ajuste registrado.");
}

export async function deleteCashAdjustmentAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const id = parseString(formData.get("id"));

  await runActionOrRedirect("/admin/cash", async () => {
    await updateDatabase((database) => {
      database.cashAdjustments = database.cashAdjustments.filter(
        (adjustment) => adjustment.id !== id,
      );
    });
  });

  redirectWithSuccess("/admin/cash", "Ajuste eliminado.");
}

export async function generateSettlementAction(): Promise<void> {
  await ensureAdmin();

  await runActionOrRedirect("/admin/settlement", async () => {
    await updateDatabase((database) => {
      const previews = buildSettlementPreview(database);
      const timestamp = nowIso();

      database.settlements = previews.map((preview) => {
        const existing = database.settlements.find(
          (settlement) => settlement.participantId === preview.participant.id,
        );

        return {
          id: existing?.id ?? createId("settlement"),
          participantId: preview.participant.id,
          generatedAt: timestamp,
          individualSavings: preview.individualSavings,
          commonFundShare: preview.commonFundShare,
          outstandingDebt: preview.outstandingDebt,
          finalAmount: preview.finalAmount,
          status:
            existing?.status && existing.status !== "pending"
              ? existing.status
              : preview.outstandingDebt > 0
                ? "debt"
                : "pending",
          paidAt: existing?.paidAt,
          notes: existing?.notes,
          updatedAt: timestamp,
        };
      });
    });
  });

  redirectWithSuccess("/admin/settlement", "Resumen de liquidación generado.");
}

export async function markSettlementPaidAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  const participantId = parseString(formData.get("participantId"));

  if (!participantId) {
    redirectWithError("/admin/settlement", "Participante inválido.");
  }

  await runActionOrRedirect("/admin/settlement", async () => {
    await updateDatabase((database) => {
      const metrics = calculateDashboardMetrics(database);
      const previews = buildSettlementPreview(database);
      const preview = previews.find((item) => item.participant.id === participantId);

      if (!preview) {
        throw new Error("No se encontró la liquidación del participante.");
      }

      if (preview.finalAmount > metrics.availableCash) {
        throw new Error("La caja disponible es insuficiente para pagar esta liquidación.");
      }

      const timestamp = nowIso();
      const existing = database.settlements.find(
        (settlement) => settlement.participantId === participantId,
      );

      const payload: SettlementRecord = {
        id: existing?.id ?? createId("settlement"),
        participantId,
        generatedAt: existing?.generatedAt ?? timestamp,
        individualSavings: preview.individualSavings,
        commonFundShare: preview.commonFundShare,
        outstandingDebt: preview.outstandingDebt,
        finalAmount: preview.finalAmount,
        status: preview.outstandingDebt > 0 ? "debt" : "paid",
        paidAt: preview.finalAmount > 0 ? timestamp : existing?.paidAt,
        notes: existing?.notes,
        updatedAt: timestamp,
      };

      if (existing) {
        Object.assign(existing, payload);
      } else {
        database.settlements.push(payload);
      }
    });
  });

  redirectWithSuccess("/admin/settlement", "Liquidación actualizada.");
}
