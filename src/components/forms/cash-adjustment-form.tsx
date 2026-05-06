"use client";

import { useState } from "react";

import { saveCashAdjustmentAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import type { CashMovementType, Participant } from "@/lib/types";

type ParticipantOption = Pick<Participant, "id" | "fullName">;

interface CashMovementPreset {
  id: string;
  label: string;
  type: CashMovementType;
  amount?: number;
  description: string;
}

const MOVEMENT_PRESETS: CashMovementPreset[] = [
  {
    id: "extra-lunches",
    label: "Venta almuerzos extras",
    type: "income",
    description: "Venta almuerzos extras",
  },
  {
    id: "bank-fees",
    label: "Gastos bancarios",
    type: "expense",
    amount: 31770,
    description: "Gastos bancarios",
  },
  {
    id: "raffle-payout",
    label: "Pago ganador polla",
    type: "expense",
    description: "Pago ganador polla",
  },
  {
    id: "raffle-gift",
    label: "Obsequio ganador polla",
    type: "expense",
    amount: 10000,
    description: "Obsequio ganador polla",
  },
  {
    id: "supplies",
    label: "Compra de insumos",
    type: "expense",
    description: "Compra de insumos",
  },
  {
    id: "cash-correction",
    label: "Ajuste de caja",
    type: "income",
    description: "Ajuste de caja",
  },
];

interface CashAdjustmentFormProps {
  participants: ParticipantOption[];
  defaultDate: string;
}

export function CashAdjustmentForm({
  participants,
  defaultDate,
}: CashAdjustmentFormProps) {
  const [type, setType] = useState<CashMovementType>("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  function applyPreset(presetId: string) {
    const preset = MOVEMENT_PRESETS.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setType(preset.type);
    setAmount(preset.amount === undefined ? "" : String(preset.amount));
    setDescription(preset.description);
  }

  return (
    <form action={saveCashAdjustmentAction} className="mt-6 grid gap-4">
      <div>
        <label htmlFor="movementPreset" className="label">
          Movimiento frecuente
        </label>
        <select
          id="movementPreset"
          className="select"
          defaultValue=""
          onChange={(event) => applyPreset(event.target.value)}
        >
          <option value="">Personalizado</option>
          {MOVEMENT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="date" className="label">
          Fecha
        </label>
        <input
          id="date"
          name="date"
          type="date"
          className="input"
          defaultValue={defaultDate}
          required
        />
      </div>

      <div>
        <label htmlFor="type" className="label">
          Tipo
        </label>
        <select
          id="type"
          name="type"
          className="select"
          value={type}
          onChange={(event) => setType(event.target.value as CashMovementType)}
        >
          <option value="income">Ingreso</option>
          <option value="expense">Salida</option>
        </select>
      </div>

      <div>
        <label htmlFor="amount" className="label">
          Valor
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          min="0"
          className="input"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="label">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          className="textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="participantId" className="label">
          Participante relacionado
        </label>
        <select id="participantId" name="participantId" className="select">
          <option value="">Ninguno</option>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.fullName}
            </option>
          ))}
        </select>
      </div>

      <SubmitButton label="Registrar ajuste" pendingLabel="Guardando..." />
    </form>
  );
}
