import { AlertSeverity, PaymentStatus, SettlementStatus } from "@/lib/types";
import { cn, paymentStatusLabel, settlementStatusLabel } from "@/lib/utils";

interface StatusBadgeProps {
  status: PaymentStatus | SettlementStatus | AlertSeverity;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    partial: "bg-sky-50 text-sky-700 ring-sky-200",
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    overdue: "bg-rose-50 text-rose-700 ring-rose-200",
    debt: "bg-rose-50 text-rose-700 ring-rose-200",
    liquidated: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-amber-200",
    critical: "bg-rose-50 text-rose-700 ring-rose-200",
  };

  const label =
    status === "success" || status === "warning" || status === "critical"
      ? {
          success: "Al día",
          warning: "Atención",
          critical: "Crítico",
        }[status]
      : status === "debt" || status === "liquidated"
        ? settlementStatusLabel(status)
        : paymentStatusLabel(status);

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        styles[status],
      )}
    >
      {label}
    </span>
  );
}
