import {
  CONTRIBUTION_LATE_RATE,
  LOAN_MONTHLY_RATE,
  SETTLEMENT_ALERT_WINDOW_DAYS,
  UPCOMING_ALERT_WINDOW_DAYS,
} from "@/lib/constants";
import {
  addMonths,
  formatMonthYear,
  getLastFridayOfMonth,
  getMonthEndDate,
  isPastDue,
  isWithinDays,
  toDateInputValue,
} from "@/lib/date";
import {
  AlertRecord,
  ContributionSnapshot,
  DashboardMetrics,
  Database,
  FixedContributionSnapshot,
  GeneratedCashMovement,
  Loan,
  LoanInstallment,
  LoanInstallmentSnapshot,
  LoanSnapshot,
  LoanStatus,
  LunchContribution,
  MonthlyContribution,
  Participant,
  ParticipantSummary,
  PaymentStatus,
  RaffleEntry,
  RaffleRound,
  SettlementPreview,
  SettlementStatus,
  TripContribution,
} from "@/lib/types";
import { roundCurrency, sumBy } from "@/lib/utils";

function paymentStatusFromOutstanding(
  totalAmount: number,
  outstanding: number,
  dueDate: string,
  asOf: Date,
): PaymentStatus {
  if (outstanding <= 0) {
    return "paid";
  }

  if (outstanding < totalAmount) {
    return isPastDue(dueDate, asOf) ? "overdue" : "partial";
  }

  return isPastDue(dueDate, asOf) ? "overdue" : "pending";
}

function fixedContributionDueDate(month: number, year: number): string {
  return getMonthEndDate(month, year);
}

export function getContributionSnapshot(
  record: MonthlyContribution,
  asOf = new Date(),
): ContributionSnapshot {
  const baseOutstanding = Math.max(record.quotaAmount - record.amountPaid, 0);
  const paidAfterDue =
    record.paidAt && new Date(record.paidAt).getTime() > new Date(record.dueDate).getTime();
  const lateInterestDue =
    isPastDue(record.dueDate, asOf) && (baseOutstanding > 0 || paidAfterDue)
      ? roundCurrency(record.quotaAmount * CONTRIBUTION_LATE_RATE)
      : 0;
  const interestOutstanding = Math.max(lateInterestDue - record.lateInterestPaid, 0);
  const totalOutstanding = baseOutstanding + interestOutstanding;

  return {
    record,
    status: paymentStatusFromOutstanding(
      record.quotaAmount + lateInterestDue,
      totalOutstanding,
      record.dueDate,
      asOf,
    ),
    lateInterestDue,
    baseOutstanding,
    interestOutstanding,
    totalOutstanding,
  };
}

export function getRaffleSnapshot(
  record: RaffleEntry,
  asOf = new Date(),
): FixedContributionSnapshot<RaffleEntry> {
  const dueDate = fixedContributionDueDate(record.month, record.year);
  const baseOutstanding = Math.max(record.fixedAmount - record.amountPaid, 0);

  return {
    record,
    status: paymentStatusFromOutstanding(
      record.fixedAmount,
      baseOutstanding,
      dueDate,
      asOf,
    ),
    baseOutstanding,
  };
}

export function getLunchSnapshot(
  record: LunchContribution,
  asOf = new Date(),
): FixedContributionSnapshot<LunchContribution> {
  const dueDate = fixedContributionDueDate(record.month, record.year);
  const baseOutstanding = Math.max(record.fixedAmount - record.amountPaid, 0);

  return {
    record,
    status: paymentStatusFromOutstanding(
      record.fixedAmount,
      baseOutstanding,
      dueDate,
      asOf,
    ),
    baseOutstanding,
  };
}

export function getTripSnapshot(
  record: TripContribution,
  asOf = new Date(),
): FixedContributionSnapshot<TripContribution> {
  const baseOutstanding = Math.max(record.quotaAmount - record.amountPaid, 0);

  return {
    record,
    status: paymentStatusFromOutstanding(
      record.quotaAmount,
      baseOutstanding,
      record.dueDate,
      asOf,
    ),
    baseOutstanding,
  };
}

export function createLoanInstallmentPlan(
  principalAmount: number,
  installmentCount: number,
  issuedAt: string,
): Array<Omit<LoanInstallment, "id" | "loanId" | "amountPaid" | "paidAt" | "createdAt" | "updatedAt">> {
  const plan: Array<
    Omit<
      LoanInstallment,
      "id" | "loanId" | "amountPaid" | "paidAt" | "createdAt" | "updatedAt"
    >
  > = [];
  let remainingPrincipal = principalAmount;
  const baseCapital = roundCurrency(principalAmount / installmentCount);

  for (let index = 0; index < installmentCount; index += 1) {
    const installmentNumber = index + 1;
    const capitalAmount =
      installmentNumber === installmentCount ? remainingPrincipal : Math.min(baseCapital, remainingPrincipal);
    const interestAmount = roundCurrency(remainingPrincipal * LOAN_MONTHLY_RATE);
    const totalAmount = capitalAmount + interestAmount;

    plan.push({
      installmentNumber,
      dueDate: addMonths(issuedAt, installmentNumber),
      capitalAmount,
      interestAmount,
      totalAmount,
    });

    remainingPrincipal = Math.max(remainingPrincipal - capitalAmount, 0);
  }

  return plan;
}

export function getLoanInstallmentSnapshot(
  installment: LoanInstallment,
  asOf = new Date(),
): LoanInstallmentSnapshot {
  const interestPaid = Math.min(installment.amountPaid, installment.interestAmount);
  const capitalPaid = Math.min(
    Math.max(installment.amountPaid - installment.interestAmount, 0),
    installment.capitalAmount,
  );
  const interestOutstanding = Math.max(installment.interestAmount - interestPaid, 0);
  const capitalOutstanding = Math.max(installment.capitalAmount - capitalPaid, 0);
  const totalOutstanding = capitalOutstanding + interestOutstanding;

  return {
    installment,
    status: paymentStatusFromOutstanding(
      installment.totalAmount,
      totalOutstanding,
      installment.dueDate,
      asOf,
    ),
    capitalPaid,
    interestPaid,
    capitalOutstanding,
    interestOutstanding,
    totalOutstanding,
  };
}

export function getLoanSnapshot(
  loan: Loan,
  installments: LoanInstallment[],
  asOf = new Date(),
): LoanSnapshot {
  const snapshots = installments
    .filter((installment) => installment.loanId === loan.id)
    .sort((left, right) => left.installmentNumber - right.installmentNumber)
    .map((installment) => getLoanInstallmentSnapshot(installment, asOf));
  const totalPaid = sumBy(snapshots, (item) => item.installment.amountPaid);
  const totalInterestGenerated = sumBy(snapshots, (item) => item.installment.interestAmount);
  const totalInterestPaid = sumBy(snapshots, (item) => item.interestPaid);
  const principalOutstanding = sumBy(snapshots, (item) => item.capitalOutstanding);
  const totalOutstanding = sumBy(snapshots, (item) => item.totalOutstanding);
  const overdueInstallments = snapshots.filter((item) => item.status === "overdue").length;

  let status: LoanStatus = loan.status;

  if (totalOutstanding <= 0) {
    status = "paid";
  } else if (overdueInstallments > 0) {
    status = "overdue";
  } else {
    status = loan.status === "refinanced" ? "refinanced" : "active";
  }

  return {
    loan,
    installments: snapshots,
    totalPaid,
    totalInterestGenerated,
    totalInterestPaid,
    principalOutstanding,
    totalOutstanding,
    overdueInstallments,
    status,
  };
}

function getParticipantById(participants: Participant[], participantId?: string): Participant | undefined {
  return participants.find((item) => item.id === participantId);
}

function matchesMonthYear(date: string | undefined, month: number, year: number): boolean {
  if (!date) {
    return false;
  }

  return date.slice(0, 7) === `${year}-${String(month).padStart(2, "0")}`;
}

function isRaffleWinnerPaymentDescription(description: string): boolean {
  const normalized = description.toLowerCase();

  if (normalized.includes("obsequio")) {
    return false;
  }

  return (
    normalized.includes("pago ganador polla") ||
    normalized.includes("pago de polla") ||
    normalized.includes("pago polla")
  );
}

function isRaffleRelatedExpenseDescription(description: string): boolean {
  const normalized = description.toLowerCase();

  return (
    normalized.includes("pago ganador polla") ||
    normalized.includes("pago de polla") ||
    normalized.includes("pago polla") ||
    normalized.includes("obsequio ganador polla")
  );
}

function isLunchExtraSaleAdjustment(description: string): boolean {
  const normalized = description.toLowerCase();

  return normalized.includes("venta") && normalized.includes("almuerzo");
}

function getHistoricalRafflePayoutAmount(database: Database, month: number, year: number): number {
  return sumBy(
    database.cashAdjustments.filter(
      (adjustment) =>
        adjustment.type === "expense" &&
        matchesMonthYear(adjustment.date, month, year) &&
        isRaffleWinnerPaymentDescription(adjustment.description),
    ),
    (adjustment) => adjustment.amount,
  );
}

function getHistoricalRafflePayoutDate(
  database: Database,
  month: number,
  year: number,
): string | undefined {
  return database.cashAdjustments.find(
    (adjustment) =>
      adjustment.type === "expense" &&
      matchesMonthYear(adjustment.date, month, year) &&
      isRaffleWinnerPaymentDescription(adjustment.description),
  )?.date;
}

function getRecordedRaffleWinnerPayout(
  database: Database,
  month: number,
  year: number,
  totalCollected: number,
): number {
  const round = getRaffleRound(database.raffleRounds, month, year);

  if (round?.payoutRecordedAt && round.winnerParticipantId) {
    return roundCurrency(totalCollected * 0.5);
  }

  return getHistoricalRafflePayoutAmount(database, month, year);
}

function getRecordedRafflePayoutDate(
  database: Database,
  month: number,
  year: number,
): string | undefined {
  const round = getRaffleRound(database.raffleRounds, month, year);

  if (round?.payoutRecordedAt && round.winnerParticipantId) {
    return round.payoutRecordedAt;
  }

  return getHistoricalRafflePayoutDate(database, month, year);
}

function getHistoricalRaffleOutflowAmount(database: Database, month: number, year: number): number {
  return sumBy(
    database.cashAdjustments.filter(
      (adjustment) =>
        adjustment.type === "expense" &&
        matchesMonthYear(adjustment.date, month, year) &&
        isRaffleRelatedExpenseDescription(adjustment.description),
    ),
    (adjustment) => adjustment.amount,
  );
}

function getRecordedRaffleOutflow(
  database: Database,
  month: number,
  year: number,
  totalCollected: number,
): number {
  const round = getRaffleRound(database.raffleRounds, month, year);

  if (round?.payoutRecordedAt && round.winnerParticipantId) {
    return roundCurrency(totalCollected * 0.5);
  }

  return getHistoricalRaffleOutflowAmount(database, month, year);
}

function getRecordedRaffleOutflowTotal(database: Database): number {
  const monthKeys = new Set(
    database.raffleEntries.map((entry) => `${entry.year}-${entry.month}`),
  );

  return sumBy(
    Array.from(monthKeys).map((key) => {
      const [yearValue, monthValue] = key.split("-");
      const year = Number(yearValue);
      const month = Number(monthValue);
      const totalCollected = sumBy(
        database.raffleEntries.filter(
          (entry) => entry.month === month && entry.year === year,
        ),
        (entry) => entry.amountPaid,
      );

      return getRecordedRaffleOutflow(database, month, year, totalCollected);
    }),
    (amount) => amount,
  );
}

export function buildLunchExtraSales(database: Database) {
  return database.cashAdjustments
    .filter(
      (adjustment) =>
        adjustment.type === "income" && isLunchExtraSaleAdjustment(adjustment.description),
    )
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export function buildCashMovements(database: Database, asOf = new Date()): GeneratedCashMovement[] {
  const contributionMovements = database.monthlyContributions.flatMap((record) => {
    const movements: GeneratedCashMovement[] = [];

    if (record.amountPaid > 0) {
      movements.push({
        id: `cash_contribution_${record.id}`,
        date: record.paidAt ?? record.updatedAt,
        type: "income",
        category: "contribution",
        amount: record.amountPaid,
        description: `Aporte ${formatMonthYear(record.month, record.year)}`,
        participantId: record.participantId,
        sourceId: record.id,
        createdBy: "admin",
      });
    }

    if (record.lateInterestPaid > 0) {
      movements.push({
        id: `cash_late_interest_${record.id}`,
        date: record.paidAt ?? record.updatedAt,
        type: "income",
        category: "late_interest",
        amount: record.lateInterestPaid,
        description: `Interés mora aporte ${formatMonthYear(record.month, record.year)}`,
        participantId: record.participantId,
        sourceId: record.id,
        createdBy: "admin",
      });
    }

    return movements;
  });

  const raffleMovements = database.raffleEntries.flatMap((record) =>
    record.amountPaid > 0
      ? [
          {
            id: `cash_raffle_${record.id}`,
            date: record.paidAt ?? record.updatedAt,
            type: "income" as const,
            category: "raffle" as const,
            amount: record.amountPaid,
            description: `Polla ${formatMonthYear(record.month, record.year)}`,
            participantId: record.participantId,
            sourceId: record.id,
            createdBy: "admin",
          },
        ]
      : [],
  );

  const lunchMovements = database.lunches.flatMap((record) =>
    record.amountPaid > 0
      ? [
          {
            id: `cash_lunch_${record.id}`,
            date: record.paidAt ?? record.updatedAt,
            type: "income" as const,
            category: "lunch" as const,
            amount: record.amountPaid,
            description: `Almuerzo ${formatMonthYear(record.month, record.year)}`,
            participantId: record.participantId,
            sourceId: record.id,
            createdBy: "admin",
          },
        ]
      : [],
  );

  const tripMovements = database.tripContributions.flatMap((record) =>
    record.amountPaid > 0
      ? [
          {
            id: `cash_trip_${record.id}`,
            date: record.paidAt ?? record.updatedAt,
            type: "income" as const,
            category: "trip_fund" as const,
            amount: record.amountPaid,
            description: `Viaje Coveñas ${formatMonthYear(record.month, record.year)}`,
            participantId: record.participantId,
            sourceId: record.id,
            createdBy: "admin",
          },
        ]
      : [],
  );

  const loanDisbursementMovements = database.loans.map((loan) => ({
    id: `cash_loan_${loan.id}`,
    date: loan.issuedAt,
    type: "expense" as const,
    category: "loan_disbursement" as const,
    amount: loan.principalAmount,
    description: `Préstamo desembolsado`,
    participantId: loan.participantId,
    sourceId: loan.id,
    createdBy: "admin",
  }));

  const installmentMovements = database.loanInstallments.flatMap((installment) => {
    if (installment.amountPaid <= 0) {
      return [];
    }

    const snapshot = getLoanInstallmentSnapshot(installment, asOf);
    const movements: GeneratedCashMovement[] = [];

    if (snapshot.capitalPaid > 0) {
      movements.push({
        id: `cash_loan_capital_${installment.id}`,
        date: installment.paidAt ?? installment.updatedAt,
        type: "income",
        category: "loan_payment",
        amount: snapshot.capitalPaid,
        description: `Abono capital cuota ${installment.installmentNumber}`,
        participantId: database.loans.find((loan) => loan.id === installment.loanId)?.participantId,
        sourceId: installment.id,
        createdBy: "admin",
      });
    }

    if (snapshot.interestPaid > 0) {
      movements.push({
        id: `cash_loan_interest_${installment.id}`,
        date: installment.paidAt ?? installment.updatedAt,
        type: "income",
        category: "loan_interest",
        amount: snapshot.interestPaid,
        description: `Interés cuota ${installment.installmentNumber}`,
        participantId: database.loans.find((loan) => loan.id === installment.loanId)?.participantId,
        sourceId: installment.id,
        createdBy: "admin",
      });
    }

    return movements;
  });

  const rafflePayoutMovements = database.raffleRounds.flatMap((round) => {
    if (!round.winnerParticipantId || !round.payoutRecordedAt) {
      return [];
    }

    const totalCollected = sumBy(
      database.raffleEntries.filter(
        (entry) => entry.month === round.month && entry.year === round.year,
      ),
      (entry) => entry.amountPaid,
    );
    const payout = roundCurrency(totalCollected * 0.5);

    if (payout <= 0) {
      return [];
    }

    return [
      {
        id: `cash_raffle_payout_${round.id}`,
        date: round.payoutRecordedAt,
        type: "expense" as const,
        category: "raffle_payout" as const,
        amount: payout,
        description: `Pago ganador polla ${formatMonthYear(round.month, round.year)}`,
        participantId: round.winnerParticipantId,
        sourceId: round.id,
        createdBy: "admin",
      },
    ];
  });

  const adjustmentMovements = database.cashAdjustments.map((adjustment) => ({
    id: `cash_adjustment_${adjustment.id}`,
    date: adjustment.date,
    type: adjustment.type,
    category: adjustment.category,
    amount: adjustment.amount,
    description: adjustment.description,
    participantId: adjustment.participantId,
    sourceId: adjustment.id,
    createdBy: adjustment.createdBy,
  }));

  const settlementMovements = database.settlements.flatMap((settlement) => {
    if (!settlement.paidAt || settlement.finalAmount <= 0) {
      return [];
    }

    return [
      {
        id: `cash_settlement_${settlement.id}`,
        date: settlement.paidAt,
        type: "expense" as const,
        category: "settlement" as const,
        amount: settlement.finalAmount,
        description: "Pago de liquidación final",
        participantId: settlement.participantId,
        sourceId: settlement.id,
        createdBy: "admin",
      },
    ];
  });

  return [
    ...contributionMovements,
    ...raffleMovements,
    ...lunchMovements,
    ...tripMovements,
    ...loanDisbursementMovements,
    ...installmentMovements,
    ...rafflePayoutMovements,
    ...adjustmentMovements,
    ...settlementMovements,
  ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export function getRaffleRound(
  rounds: RaffleRound[],
  month: number,
  year: number,
): RaffleRound | undefined {
  return rounds.find((round) => round.month === month && round.year === year);
}

export function calculateDashboardMetrics(
  database: Database,
  asOf = new Date(),
): DashboardMetrics {
  const cashMovements = buildCashMovements(database, asOf);
  const totalCashIn = sumBy(
    cashMovements.filter((movement) => movement.type === "income"),
    (movement) => movement.amount,
  );
  const totalCashOut = sumBy(
    cashMovements.filter((movement) => movement.type === "expense"),
    (movement) => movement.amount,
  );
  const contributionSnapshots = database.monthlyContributions.map((record) =>
    getContributionSnapshot(record, asOf),
  );
  const raffleSnapshots = database.raffleEntries.map((record) => getRaffleSnapshot(record, asOf));
  const lunchSnapshots = database.lunches.map((record) => getLunchSnapshot(record, asOf));
  const tripSnapshots = database.tripContributions.map((record) => getTripSnapshot(record, asOf));
  const loanSnapshots = database.loans.map((loan) =>
    getLoanSnapshot(loan, database.loanInstallments, asOf),
  );
  const totalContributionCollected = sumBy(database.monthlyContributions, (record) => record.amountPaid);
  const totalRaffleCollected = sumBy(database.raffleEntries, (record) => record.amountPaid);
  const totalRafflePayouts = getRecordedRaffleOutflowTotal(database);
  const totalRaffleBalance = Math.max(totalRaffleCollected - totalRafflePayouts, 0);
  const totalLunchCollected = sumBy(database.lunches, (record) => record.amountPaid);
  const totalLunchExtraSales = sumBy(buildLunchExtraSales(database), (adjustment) => adjustment.amount);
  const totalLunchCombined = totalLunchCollected + totalLunchExtraSales;
  const totalTripCollected = sumBy(database.tripContributions, (record) => record.amountPaid);
  const totalLateInterestCollected = sumBy(
    database.monthlyContributions,
    (record) => record.lateInterestPaid,
  );
  const totalLoanInterestCollected = sumBy(loanSnapshots, (snapshot) => snapshot.totalInterestPaid);
  const totalLoanedOut = sumBy(loanSnapshots, (snapshot) => snapshot.principalOutstanding);
  const grossCashPool =
    totalContributionCollected +
    totalRaffleBalance +
    totalLunchCombined +
    totalTripCollected +
    totalLateInterestCollected +
    totalLoanInterestCollected;
  const movementCashBalance = totalCashIn - totalCashOut;

  return {
    availableCash: grossCashPool - totalLoanedOut,
    grossCashPool,
    movementCashBalance,
    totalContributionCollected,
    totalRaffleCollected,
    totalRaffleBalance,
    totalRafflePayouts,
    totalLunchCollected,
    totalLunchExtraSales,
    totalLunchCombined,
    totalTripCollected,
    totalLateInterestCollected,
    totalLoanInterestCollected,
    totalLoanedOut,
    totalPendingToCollect:
      sumBy(contributionSnapshots, (item) => item.totalOutstanding) +
      sumBy(raffleSnapshots, (item) => item.baseOutstanding) +
      sumBy(lunchSnapshots, (item) => item.baseOutstanding) +
      sumBy(tripSnapshots, (item) => item.baseOutstanding) +
      sumBy(loanSnapshots, (item) => item.totalOutstanding),
    totalCommonFund:
      totalRaffleBalance +
      sumBy(database.lunches, (record) => record.amountPaid) +
      sumBy(database.monthlyContributions, (record) => record.lateInterestPaid) +
      sumBy(loanSnapshots, (snapshot) => snapshot.totalInterestPaid) +
      sumBy(
        database.cashAdjustments.filter(
          (adjustment) => adjustment.category === "adjustment" && adjustment.type === "income",
        ),
        (adjustment) => adjustment.amount,
      ) -
      sumBy(
        database.cashAdjustments.filter(
          (adjustment) => adjustment.category === "adjustment" && adjustment.type === "expense",
        ),
        (adjustment) => adjustment.amount,
      ),
    totalCashIn,
    totalCashOut,
  };
}

export function buildParticipantSummaries(
  database: Database,
  asOf = new Date(),
): ParticipantSummary[] {
  const activeParticipants = database.participants.filter((participant) => participant.active);
  const settlementPreview = buildSettlementPreview(database, asOf);
  const previewByParticipant = new Map(
    settlementPreview.map((item) => [item.participant.id, item]),
  );

  return activeParticipants
    .map((participant) => {
      const totalContributions = sumBy(
        database.monthlyContributions.filter((record) => record.participantId === participant.id),
        (record) => record.amountPaid,
      );
      const totalRaffles = sumBy(
        database.raffleEntries.filter((record) => record.participantId === participant.id),
        (record) => record.amountPaid,
      );
      const totalLunches = sumBy(
        database.lunches.filter((record) => record.participantId === participant.id),
        (record) => record.amountPaid,
      );
      const totalTripSavings = sumBy(
        database.tripContributions.filter((record) => record.participantId === participant.id),
        (record) => record.amountPaid,
      );
      const totalLateInterests = sumBy(
        database.monthlyContributions.filter((record) => record.participantId === participant.id),
        (record) => record.lateInterestPaid,
      );
      const loans = database.loans.filter((loan) => loan.participantId === participant.id);
      const loanSnapshots = loans.map((loan) =>
        getLoanSnapshot(loan, database.loanInstallments, asOf),
      );
      const preview = previewByParticipant.get(participant.id);

      return {
        participant,
        totalContributions,
        totalRaffles,
        totalLunches,
        totalTripSavings,
        totalLateInterests,
        activeLoans: loanSnapshots.filter((loan) => loan.status !== "paid").length,
        pendingDebt: preview?.outstandingDebt ?? 0,
        estimatedSettlement: preview?.finalAmount ?? 0,
        commonFundShare: preview?.commonFundShare ?? 0,
      };
    })
    .sort((left, right) => left.participant.fullName.localeCompare(right.participant.fullName, "es"));
}

export function buildSettlementPreview(
  database: Database,
  asOf = new Date(),
): SettlementPreview[] {
  const eligibleParticipants = database.participants.filter((participant) => participant.active);
  const commonFund = calculateDashboardMetrics(database, asOf).totalCommonFund;
  const commonFundShare =
    eligibleParticipants.length > 0
      ? roundCurrency(commonFund / eligibleParticipants.length)
      : 0;
  const settlementByParticipant = new Map(
    database.settlements.map((settlement) => [settlement.participantId, settlement]),
  );

  return eligibleParticipants
    .map((participant) => {
      const individualSavings = sumBy(
        database.monthlyContributions.filter((record) => record.participantId === participant.id),
        (record) => record.amountPaid,
      );
      const pendingContributionDebt = sumBy(
        database.monthlyContributions
          .filter((record) => record.participantId === participant.id)
          .map((record) => getContributionSnapshot(record, asOf)),
        (snapshot) => snapshot.totalOutstanding,
      );
      const pendingRaffleDebt = sumBy(
        database.raffleEntries
          .filter((record) => record.participantId === participant.id)
          .map((record) => getRaffleSnapshot(record, asOf)),
        (snapshot) => snapshot.baseOutstanding,
      );
      const pendingLunchDebt = sumBy(
        database.lunches
          .filter((record) => record.participantId === participant.id)
          .map((record) => getLunchSnapshot(record, asOf)),
        (snapshot) => snapshot.baseOutstanding,
      );
      const loanDebt = sumBy(
        database.loans
          .filter((loan) => loan.participantId === participant.id)
          .map((loan) => getLoanSnapshot(loan, database.loanInstallments, asOf)),
        (snapshot) => snapshot.totalOutstanding,
      );
      const outstandingDebt = pendingContributionDebt + pendingRaffleDebt + pendingLunchDebt + loanDebt;
      const finalAmount = individualSavings + commonFundShare - outstandingDebt;
      const existing = settlementByParticipant.get(participant.id);
      const status: SettlementStatus = existing?.status
        ? existing.status
        : outstandingDebt > 0
          ? "debt"
          : "pending";

      return {
        participant,
        individualSavings,
        commonFundShare,
        outstandingDebt,
        finalAmount,
        status,
        paidAt: existing?.paidAt,
      };
    })
    .sort((left, right) => left.participant.fullName.localeCompare(right.participant.fullName, "es"));
}

export function buildAlerts(database: Database, asOf = new Date()): AlertRecord[] {
  const alerts: AlertRecord[] = [];
  const participantsById = new Map(database.participants.map((participant) => [participant.id, participant]));

  database.monthlyContributions.forEach((record) => {
    const snapshot = getContributionSnapshot(record, asOf);
    const participant = participantsById.get(record.participantId);

    if (!participant) {
      return;
    }

    if (snapshot.status === "overdue") {
      alerts.push({
        id: `alert_contribution_overdue_${record.id}`,
        severity: "critical",
        title: "Aporte vencido",
        description: `${participant.fullName} debe ${formatMonthYear(record.month, record.year)} por ${snapshot.totalOutstanding}.`,
        participantId: participant.id,
        href: "/admin/contributions",
      });
    } else if (
      snapshot.status === "pending" &&
      isWithinDays(record.dueDate, UPCOMING_ALERT_WINDOW_DAYS, asOf)
    ) {
      alerts.push({
        id: `alert_contribution_pending_${record.id}`,
        severity: "warning",
        title: "Aporte próximo a vencer",
        description: `${participant.fullName} tiene pendiente ${formatMonthYear(record.month, record.year)}.`,
        participantId: participant.id,
        href: "/admin/contributions",
      });
    }
  });

  database.raffleEntries.forEach((record) => {
    const snapshot = getRaffleSnapshot(record, asOf);
    const participant = participantsById.get(record.participantId);

    if (!participant || snapshot.baseOutstanding <= 0) {
      return;
    }

    alerts.push({
      id: `alert_raffle_${record.id}`,
      severity: snapshot.status === "overdue" ? "critical" : "warning",
      title:
        snapshot.status === "overdue" ? "Polla vencida" : "Polla pendiente",
      description: `${participant.fullName} tiene pendiente la polla de ${formatMonthYear(record.month, record.year)}.`,
      participantId: participant.id,
      href: "/admin/raffles",
    });
  });

  database.lunches.forEach((record) => {
    const snapshot = getLunchSnapshot(record, asOf);
    const participant = participantsById.get(record.participantId);

    if (!participant || snapshot.baseOutstanding <= 0) {
      return;
    }

    alerts.push({
      id: `alert_lunch_${record.id}`,
      severity: snapshot.status === "overdue" ? "critical" : "warning",
      title:
        snapshot.status === "overdue" ? "Almuerzo vencido" : "Almuerzo pendiente",
      description: `${participant.fullName} tiene pendiente el aporte de almuerzo de ${formatMonthYear(record.month, record.year)}.`,
      participantId: participant.id,
      href: "/admin/lunches",
    });
  });

  database.tripContributions.forEach((record) => {
    const snapshot = getTripSnapshot(record, asOf);
    const participant = participantsById.get(record.participantId);

    if (!participant || snapshot.baseOutstanding <= 0) {
      return;
    }

    alerts.push({
      id: `alert_trip_${record.id}`,
      severity: snapshot.status === "overdue" ? "critical" : "warning",
      title:
        snapshot.status === "overdue"
          ? "Ahorro de viaje vencido"
          : "Ahorro de viaje pendiente",
      description: `${participant.fullName} tiene pendiente el ahorro para Coveñas de ${formatMonthYear(record.month, record.year)}.`,
      participantId: participant.id,
      href: "/admin/covenas",
    });
  });

  database.loans.forEach((loan) => {
    const snapshot = getLoanSnapshot(loan, database.loanInstallments, asOf);
    const participant = participantsById.get(loan.participantId);

    if (!participant || snapshot.overdueInstallments <= 0) {
      return;
    }

    alerts.push({
      id: `alert_loan_${loan.id}`,
      severity: "critical",
      title: "Préstamo con cuotas vencidas",
      description: `${participant.fullName} tiene ${snapshot.overdueInstallments} cuota(s) vencida(s).`,
      participantId: participant.id,
      href: "/admin/loans",
    });
  });

  if (
    database.settings.status === "active" &&
    isWithinDays(database.settings.estimatedSettlementDate, SETTLEMENT_ALERT_WINDOW_DAYS, asOf)
  ) {
    alerts.push({
      id: "alert_settlement_window",
      severity: "warning",
      title: "Natillera próxima a liquidarse",
      description: `La fecha estimada de liquidación es ${database.settings.estimatedSettlementDate}.`,
      href: "/admin/settlement",
    });
  }

  buildSettlementPreview(database, asOf)
    .filter((preview) => preview.outstandingDebt > 0)
    .forEach((preview) => {
      alerts.push({
        id: `alert_settlement_debt_${preview.participant.id}`,
        severity: "critical",
        title: "Participante con deuda para liquidación",
        description: `${preview.participant.fullName} aún debe ${preview.outstandingDebt} antes del cierre.`,
        participantId: preview.participant.id,
        href: "/admin/settlement",
      });
    });

  return alerts;
}

export function buildMonthlyRaffleSummaries(database: Database): Array<{
  month: number;
  year: number;
  lastFriday: string;
  totalCollected: number;
  winnerPayout: number;
  commonFund: number;
  winner?: Participant;
  winningNumber?: number;
  drawDate?: string;
  payoutRecordedAt?: string;
  entryCount: number;
}> {
  const monthKeys = new Set(
    database.raffleEntries.map((entry) => `${entry.year}-${entry.month}`),
  );

  return Array.from(monthKeys)
    .map((key) => {
      const [yearValue, monthValue] = key.split("-");
      const year = Number(yearValue);
      const month = Number(monthValue);
      const entries = database.raffleEntries.filter(
        (entry) => entry.month === month && entry.year === year,
      );
      const totalCollected = sumBy(entries, (entry) => entry.amountPaid);
      const round = getRaffleRound(database.raffleRounds, month, year);
      const winnerPayout = getRecordedRaffleWinnerPayout(database, month, year, totalCollected);
      const raffleOutflow = getRecordedRaffleOutflow(database, month, year, totalCollected);
      const payoutRecordedAt = getRecordedRafflePayoutDate(database, month, year);

      return {
        month,
        year,
        lastFriday: toDateInputValue(getLastFridayOfMonth(month, year)),
        totalCollected,
        winnerPayout,
        commonFund: totalCollected - raffleOutflow,
        winner: getParticipantById(database.participants, round?.winnerParticipantId),
        winningNumber: round?.winningNumber,
        drawDate: round?.drawDate,
        payoutRecordedAt,
        entryCount: entries.length,
      };
    })
    .sort((left, right) =>
      `${right.year}-${String(right.month).padStart(2, "0")}`.localeCompare(
        `${left.year}-${String(left.month).padStart(2, "0")}`,
      ),
    );
}
