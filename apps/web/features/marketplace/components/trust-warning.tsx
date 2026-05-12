interface ITrustWarningProps {
  readonly message: string;
  readonly className?: string;
}

export function TrustWarning({ message, className }: ITrustWarningProps) {
  return (
    <p
      className={`rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 ${className ?? ""}`.trim()}
      role="alert"
      aria-live="polite"
    >
      {message}
    </p>
  );
}
