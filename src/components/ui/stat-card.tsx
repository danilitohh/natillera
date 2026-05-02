import { formatCurrency } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  tone?: "brand" | "neutral" | "success" | "danger";
}

export function StatCard({
  label,
  value,
  tone = "brand",
}: StatCardProps) {
  const toneStyles: Record<typeof tone, string> = {
    brand:
      "bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_40%),white]",
    neutral:
      "bg-[radial-gradient(circle_at_top_left,_rgba(71,85,105,0.12),_transparent_40%),white]",
    success:
      "bg-[radial-gradient(circle_at_top_left,_rgba(22,163,74,0.14),_transparent_40%),white]",
    danger:
      "bg-[radial-gradient(circle_at_top_left,_rgba(225,29,72,0.14),_transparent_40%),white]",
  };

  return (
    <article
      className={`rounded-[1.75rem] border border-white/70 p-5 shadow-lg shadow-black/5 ${toneStyles[tone]}`}
    >
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        {formatCurrency(value)}
      </p>
    </article>
  );
}
