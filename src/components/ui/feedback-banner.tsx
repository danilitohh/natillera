interface FeedbackBannerProps {
  success?: string;
  error?: string;
}

export function FeedbackBanner({ success, error }: FeedbackBannerProps) {
  if (!success && !error) {
    return null;
  }

  const isError = Boolean(error);
  const message = error || success;

  return (
    <div
      className={`rounded-3xl border px-5 py-4 text-sm ${
        isError
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {message}
    </div>
  );
}
