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
          className="border-l-2 border-red-500 bg-red-50/60 py-2.5 pr-3 pl-3 text-sm text-red-800"
          role="alert"
          aria-atomic="true"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="border-l-2 border-emerald-500 bg-emerald-50/60 py-2.5 pr-3 pl-3 text-sm text-emerald-900"
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
          className="hr-mode-text inline-flex text-sm hover:underline"
          aria-label="View transaction in Stellar Testnet Explorer (opens in new window)"
        >
          View transaction on Stellar
        </a>
      ) : null}
    </div>
  );
}
