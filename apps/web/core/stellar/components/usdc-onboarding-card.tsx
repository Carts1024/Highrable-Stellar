"use client";

type TUsdcOnboardingCardProps = {
  isChecking?: boolean;
  isEnabling?: boolean;
  isEnabled?: boolean;
  error?: string | null;
  isWalletFunded?: boolean | null;
  onEnable: () => void;
  onFundTestnetAccount?: () => void;
  onRefresh?: () => void;
};

export function UsdcOnboardingCard({
  isChecking = false,
  isEnabling = false,
  isEnabled = false,
  error,
  isWalletFunded,
  onEnable,
  onFundTestnetAccount,
  onRefresh,
}: TUsdcOnboardingCardProps) {
  if (isEnabled) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        USDC payments enabled.
      </div>
    );
  }

  const needsFunding = isWalletFunded === false;
  const buttonLabel = isEnabling ? "Enabling USDC..." : "Enable USDC Payments";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-gray-950">Enable USDC Payments</h3>
        <p className="text-sm text-gray-700">
          Highrable uses USDC on Stellar for escrow payments. Enable USDC once so your wallet can
          receive and send payments.
        </p>
      </div>

      {needsFunding ? (
        <p className="mt-3 rounded-lg border border-amber-300 bg-white/70 p-3 text-sm text-amber-900">
          Your Stellar testnet wallet needs testnet XLM before enabling USDC.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-white p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {needsFunding && onFundTestnetAccount ? (
          <button
            type="button"
            onClick={onFundTestnetAccount}
            className="rounded-lg border border-amber-700 bg-white px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
          >
            Get Testnet XLM
          </button>
        ) : null}
        <button
          type="button"
          disabled={isChecking || isEnabling || needsFunding}
          onClick={onEnable}
          className="rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500"
        >
          {isChecking ? "Checking USDC..." : buttonLabel}
        </button>
        {onRefresh ? (
          <button
            type="button"
            disabled={isChecking || isEnabling}
            onClick={onRefresh}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            Refresh
          </button>
        ) : null}
      </div>
    </div>
  );
}
