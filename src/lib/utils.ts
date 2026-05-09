import { CashMovementCategory, PaymentStatus, SettlementStatus } from "@/lib/types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function roundCurrency(value: number): number {
  return Math.round(value);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeLocalizedNumber(value: string): string {
  const lastDot = value.lastIndexOf(".");
  const lastComma = value.lastIndexOf(",");

  if (lastDot === -1 && lastComma === -1) {
    return value;
  }

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandsSeparator = decimalSeparator === "." ? "," : ".";

    return value
      .replaceAll(thousandsSeparator, "")
      .replace(decimalSeparator, ".");
  }

  const separator = lastDot !== -1 ? "." : ",";
  const parts = value.split(separator);

  if (parts.length > 2) {
    const [first = "", ...rest] = parts;
    const looksGrouped = first.length > 0 && rest.every((part) => part.length === 3);

    return looksGrouped ? parts.join("") : value.replaceAll(separator, "");
  }

  const [integerPart = "", decimalPart = ""] = parts;

  if (integerPart.length > 0 && decimalPart.length === 3) {
    return `${integerPart}${decimalPart}`;
  }

  return value.replace(separator, ".");
}

export function parseNumberInput(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    return 0;
  }

  const cleaned = value.trim().replace(/[^\d,.-]/g, "");

  if (!cleaned) {
    return 0;
  }

  const sign = cleaned.startsWith("-") ? "-" : "";
  const unsigned = cleaned.replaceAll("-", "");
  const normalized = `${sign}${normalizeLocalizedNumber(unsigned)}`;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on";
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

export function buildMessageUrl(
  pathname: string,
  options: { success?: string; error?: string; edit?: string; query?: string } = {},
): string {
  const params = new URLSearchParams();

  if (options.success) {
    params.set("success", options.success);
  }

  if (options.error) {
    params.set("error", options.error);
  }

  if (options.edit) {
    params.set("edit", options.edit);
  }

  if (options.query) {
    params.set("query", options.query);
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return (
    {
      pending: "Pendiente",
      partial: "Parcial",
      paid: "Pagado",
      overdue: "Vencido",
    }[status] ?? status
  );
}

export function settlementStatusLabel(status: SettlementStatus): string {
  return (
    {
      pending: "Por pagar",
      paid: "Pagado",
      debt: "Con deuda",
      liquidated: "Liquidado",
    }[status] ?? status
  );
}

export function cashCategoryLabel(category: CashMovementCategory): string {
  return (
    {
      contribution: "Aporte",
      raffle: "Polla",
      lunch: "Almuerzo",
      trip_fund: "Viaje Coveñas",
      late_interest: "Interés mora",
      loan_disbursement: "Préstamo entregado",
      loan_payment: "Abono préstamo",
      loan_interest: "Interés préstamo",
      raffle_payout: "Pago ganador polla",
      adjustment: "Ajuste",
      settlement: "Liquidación",
    }[category] ?? category
  );
}

export function numberOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
