"use client";

import { formatTokenAmount } from "@/core/stellar/amounts";
import { formatAssetLabel } from "@/core/stellar/assets";
import { stablecoinConfig, validateStablecoinConfig } from "@/core/stellar/stablecoin-config";
import { AppButton } from "@/core/ui/button";

import {
  useStablecoinReadiness,
  type TStablecoinReadinessResult,
} from "../hooks/use-stablecoin-readiness";

interface IStablecoinBalancePanelProps {
  readonly walletAddress: string | null | undefined;
  readonly requiredAmount?: number | string;
  readonly tokenContractId?: string;
  readonly enabled?: boolean;
  readonly isRefreshDisabled?: boolean;
  readonly readinessState?: TStablecoinReadinessResult;
}

export function StablecoinBalancePanel({
  walletAddress,
  requiredAmount,
  tokenContractId,
  enabled = true,
  isRefreshDisabled,
  readinessState,
}: IStablecoinBalancePanelProps) {
  const readiness =
    readinessState ??
    useStablecoinReadiness({
      walletAddress,
      requiredAmount,
      tokenContractId,
      enabled,
    });

  const configValidation = validateStablecoinConfig({
    ...stablecoinConfig,
    tokenContractId: tokenContractId ?? stablecoinConfig.tokenContractId,
  });

  const readinessLabel =
    readiness.hasSufficientBalance === null
      ? "Checking"
      : readiness.hasSufficientBalance
        ? "Ready"
        : "Insufficient";

  const readinessClassName =
    readiness.hasSufficientBalance === null
      ? "border-gray-200 bg-gray-50 text-gray-700"
      : readiness.hasSufficientBalance
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-red-200 bg-red-50 text-red-700";

  const assetLabel = formatAssetLabel(readiness.tokenContractId ?? "");

  return (
    <div className="space-y-3 rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#0a0a0a]">Stablecoin balance</h3>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.06em] uppercase ${readinessClassName}`}
        >
          {readinessLabel}
        </span>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-[#e8e8e8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Asset</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">{assetLabel}</dd>
        </div>
        <div className="rounded-lg border border-[#e8e8e8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Wallet balance</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">
            {readiness.isLoading
              ? "Checking..."
              : readiness.balanceDisplay
                ? formatTokenAmount(readiness.balanceDisplay, assetLabel, readiness.decimals)
                : `0 ${assetLabel}`}
          </dd>
        </div>
        <div className="rounded-lg border border-[#e8e8e8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Required</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">
            {readiness.requiredAmountDisplay
              ? formatTokenAmount(readiness.requiredAmountDisplay, assetLabel, readiness.decimals)
              : "-"}
          </dd>
        </div>
      </dl>

      {readiness.requiredAmountDisplay ? (
        <div className="rounded-lg border border-[#e8e8e8] bg-white p-3 text-sm">
          <p className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Missing amount</p>
          <p className="mt-1 font-medium text-[#0a0a0a]">
            {readiness.deficitDisplay
              ? formatTokenAmount(readiness.deficitDisplay, assetLabel, readiness.decimals)
              : `0 ${assetLabel}`}
          </p>
        </div>
      ) : null}

      <p className="text-xs text-[#5f5f5f]">
        Friendbot funds testnet XLM for fees. It does not fund {assetLabel}.
      </p>

      {!configValidation.isValid ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {configValidation.message}
        </p>
      ) : null}

      {readiness.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {readiness.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <AppButton
          type="button"
          appVariant="secondary"
          className="h-8 rounded-lg px-3 py-1.5 text-xs"
          disabled={readiness.isLoading || isRefreshDisabled}
          onClick={() => void readiness.refresh()}
        >
          {readiness.isLoading ? "Refreshing..." : "Refresh Balance"}
        </AppButton>
      </div>
    </div>
  );
}
