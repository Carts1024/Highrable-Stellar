import { AppButton } from "@/core/ui/button";

interface IStablecoinReadinessCardProps {
  readonly requiredAmount: string | null;
  readonly walletBalance: string | null;
  readonly deficitAmount: string | null;
  readonly hasSufficientBalance: boolean | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
  readonly isRefreshDisabled?: boolean;
}

export function StablecoinReadinessCard({
  requiredAmount,
  walletBalance,
  deficitAmount,
  hasSufficientBalance,
  isLoading,
  error,
  onRefresh,
  isRefreshDisabled,
}: IStablecoinReadinessCardProps) {
  const readinessLabel =
    hasSufficientBalance === null ? "Checking" : hasSufficientBalance ? "Ready" : "Insufficient";

  const readinessClassName =
    hasSufficientBalance === null
      ? "border-gray-200 bg-gray-50 text-gray-700"
      : hasSufficientBalance
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className="space-y-3 rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#0a0a0a]">Stablecoin Readiness</h3>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.06em] uppercase ${readinessClassName}`}
        >
          {readinessLabel}
        </span>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-[#e8e8e8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Amount needed</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">{requiredAmount ?? "-"} USDC</dd>
        </div>
        <div className="rounded-lg border border-[#e8e8e8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Wallet balance</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">
            {isLoading ? "Checking..." : (walletBalance ?? "-")} USDC
          </dd>
        </div>
        <div className="rounded-lg border border-[#e8e8e8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Deficit</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">{deficitAmount ?? "-"} USDC</dd>
        </div>
      </dl>

      <p className="text-xs text-[#5f5f5f]">
        Friendbot only funds testnet XLM for gas. Add stablecoin to your wallet before funding
        escrow.
      </p>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <AppButton
          type="button"
          appVariant="secondary"
          className="h-8 rounded-lg px-3 py-1.5 text-xs"
          disabled={isLoading || isRefreshDisabled}
          onClick={onRefresh}
        >
          {isLoading ? "Refreshing..." : "Refresh Balance"}
        </AppButton>
      </div>
    </div>
  );
}
