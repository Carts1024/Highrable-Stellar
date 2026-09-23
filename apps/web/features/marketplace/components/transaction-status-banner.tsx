interface ITransactionStatusBannerProps {
  readonly error: string | null;
  readonly success: string | null;
  readonly txExplorerUrl: string | null;
}

export function TransactionStatusBanner({
  error,
  success,
  txExplorerUrl,
}: ITransactionStatusBannerProps) {
  if (!error && !success && !txExplorerUrl) {
    return null;
  }

  return (
    <div
      className="mt-4 space-y-2"
      role="region"
      aria-live="polite"
      aria-label="Transaction status"
    >
      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:rounded-2xl"
          role="alert"
          aria-atomic="true"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 sm:rounded-2xl"
          role="status"
          aria-atomic="true"
        >
          {success}
        </p>
      ) : null}
      {txExplorerUrl ? (
        <a
          href={txExplorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex font-mono text-sm font-medium tracking-[0.04em] text-highrable-orange-3 hover:text-highrable-orange-2 hover:underline"
          aria-label="View transaction in Stellar Testnet Explorer (opens in new window)"
        >
          View on Stellar Explorer
        </a>
      ) : null}
    </div>
  );
}
