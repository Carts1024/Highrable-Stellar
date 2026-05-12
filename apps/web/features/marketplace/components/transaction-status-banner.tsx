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
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
          aria-atomic="true"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
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
          className="inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900"
          aria-label="View transaction in Stellar Testnet Explorer (opens in new window)"
        >
          View on Stellar Explorer
        </a>
      ) : null}
    </div>
  );
}
