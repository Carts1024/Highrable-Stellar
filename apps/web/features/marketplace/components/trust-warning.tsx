interface ITrustWarningProps {
  readonly message: string;
  readonly className?: string;
}

export function TrustWarning({ message, className }: ITrustWarningProps) {
  return (
    <p
      className={`border-l-2 border-amber-400 bg-amber-50/60 py-2.5 pr-3 pl-3 text-sm text-amber-900 ${className ?? ""}`.trim()}
      role="alert"
      aria-live="polite"
    >
      {message}
    </p>
  );
}
