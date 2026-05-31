"use client";

import Link from "next/link";
import { useState } from "react";

import { saveLunchAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { LUNCH_FIXED_AMOUNT, MONTH_OPTIONS } from "@/lib/constants";
import type { LunchContribution, Participant } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type LunchRecordType = "contribution" | "extra_sale";
type ParticipantOption = Pick<Participant, "id" | "fullName">;
type LunchEditableRecord = Pick<
  LunchContribution,
  "id" | "participantId" | "month" | "year" | "amountPaid" | "paidAt" | "notes"
>;

interface LunchFormProps {
  participants: ParticipantOption[];
  editingRecord?: LunchEditableRecord;
  selectedMonth: number;
  selectedYear: number;
  yearOptions: number[];
  cancelHref: string;
}

export function LunchForm({
  participants,
  editingRecord,
  selectedMonth,
  selectedYear,
  yearOptions,
  cancelHref,
}: LunchFormProps) {
  const [recordType, setRecordType] = useState<LunchRecordType>("contribution");
  const [amountPaid, setAmountPaid] = useState(
    String(editingRecord?.amountPaid ?? LUNCH_FIXED_AMOUNT),
  );
  const isExtraSale = recordType === "extra_sale";

  function updateRecordType(value: LunchRecordType) {
    setRecordType(value);

    if (value === "extra_sale" && amountPaid === String(LUNCH_FIXED_AMOUNT)) {
      setAmountPaid("");
    }

    if (value === "contribution" && amountPaid === "") {
      setAmountPaid(String(LUNCH_FIXED_AMOUNT));
    }
  }

  return (
    <form action={saveLunchAction} className="mt-6 grid gap-4">
      <input type="hidden" name="id" value={editingRecord?.id ?? ""} />

      <div>
        <label htmlFor="recordType" className="label">
          Tipo de registro
        </label>
        <select
          id="recordType"
          name="recordType"
          className="select"
          value={recordType}
          onChange={(event) => updateRecordType(event.target.value as LunchRecordType)}
        >
          <option value="contribution">Aporte participante</option>
          {!editingRecord ? <option value="extra_sale">Venta almuerzo extra</option> : null}
        </select>
      </div>

      <div>
        <label htmlFor="participantId" className="label">
          {isExtraSale ? "Participante relacionado" : "Participante"}
        </label>
        <select
          id="participantId"
          name="participantId"
          className="select"
          defaultValue={editingRecord?.participantId ?? ""}
          required={!isExtraSale}
        >
          <option value="">{isExtraSale ? "Ninguno" : "Selecciona"}</option>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="month" className="label">
            Mes
          </label>
          <select
            id="month"
            name="month"
            className="select"
            defaultValue={String(editingRecord?.month ?? selectedMonth)}
          >
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="year" className="label">
            Año
          </label>
          <select
            id="year"
            name="year"
            className="select"
            defaultValue={String(editingRecord?.year ?? selectedYear)}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="amountPaid" className="label">
          Valor pagado
        </label>
        <input
          id="amountPaid"
          name="amountPaid"
          type="number"
          min="0"
          className="input"
          value={amountPaid}
          onChange={(event) => setAmountPaid(event.target.value)}
          required
        />
        <p className="helper">
          {isExtraSale
            ? "Registra el total recibido por la venta extra."
            : `Valor fijo sugerido: ${formatCurrency(LUNCH_FIXED_AMOUNT)}.`}
        </p>
      </div>

      <div>
        <label htmlFor="paidAt" className="label">
          {isExtraSale ? "Fecha de venta" : "Fecha de pago"}
        </label>
        <input
          id="paidAt"
          name="paidAt"
          type="date"
          className="input"
          defaultValue={editingRecord?.paidAt}
        />
      </div>

      <div>
        <label htmlFor="notes" className="label">
          Observaciones
        </label>
        <textarea
          id="notes"
          name="notes"
          className="textarea"
          defaultValue={editingRecord?.notes}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          label={
            editingRecord
              ? "Guardar registro"
              : isExtraSale
                ? "Registrar venta"
                : "Registrar almuerzo"
          }
          pendingLabel="Guardando..."
        />
        {editingRecord ? (
          <Link href={cancelHref} className="pill-link">
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
