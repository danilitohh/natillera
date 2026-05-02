interface SectionHeadingProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeading({
  title,
  description,
  action,
}: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
