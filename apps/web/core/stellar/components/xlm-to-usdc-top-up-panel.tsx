"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import {
  useXlmToUsdcTopUp,
  type TUseXlmToUsdcTopUpResult,
} from "@/core/stellar/hooks/use-xlm-to-usdc-top-up";
import { Button as AppButton } from "@repo/ui/components/ui/button";

type TWalletType = "external_wallet" | "passkey_smart_account";

interface IXlmToUsdcTopUpPanelProps {
  readonly walletAddress?: string | null;
  readonly walletType?: TWalletType | null;
  readonly missingUsdcAmount?: string | null;
  readonly usdcBalance?: string | null;
  readonly xlmFeeBalance?: string | null;
  readonly jobAssetContractId?: string | null;
  readonly onRefreshBalance?: () => Promise<void> | void;
  readonly onFundEscrow?: () => Promise<void> | void;
  readonly canFundEscrow?: boolean;
  readonly isFundEscrowPending?: boolean;
}

function formatRoute(topUp: TUseXlmToUsdcTopUpResult): string {
  if (!topUp.quote) {
    return "XLM -> USDC";
  }

  const intermediateAssets = topUp.quote.path.map((asset) => {
    if (asset.assetType === "native") {
      return "XLM";
    }

    return asset.assetCode ?? asset.assetType;
  });

  return ["XLM", ...intermediateAssets, topUp.quote.destinationAssetCode].join(" -> ");
}

export function XlmToUsdcTopUpPanel({
  walletAddress,
  walletType,
  missingUsdcAmount,
  usdcBalance,
  xlmFeeBalance,
  jobAssetContractId,
  onRefreshBalance,
  onFundEscrow,
  canFundEscrow,
  isFundEscrowPending,
}: IXlmToUsdcTopUpPanelProps) {
  const topUp = useXlmToUsdcTopUp({
    walletAddress,
    walletType,
    missingUsdcAmount,
    usdcBalance,
    xlmFeeBalance,
    jobAssetContractId,
    onSuccess: onRefreshBalance,
  });
  const txExplorerUrl = topUp.lastTxHash ? getTxExplorerUrl(topUp.lastTxHash) : null;

  if (
    walletType === "passkey_smart_account" &&
    missingUsdcAmount &&
    Number(missingUsdcAmount) > 0
  ) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        XLM to USDC conversion is currently available only for external wallets. To use this top-up
        flow, switch to Freighter or WalletConnect. Passkey smart accounts can fund escrow once they
        already hold USDC.
      </div>
    );
  }

  if (!topUp.isAvailable) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#d8e7f6] bg-[#f7fbff] p-4">
      <div>
        <h3 className="text-sm font-semibold text-[#0a0a0a]">Convert XLM to USDC</h3>
        <p className="mt-1 text-sm text-[#4f5f6f]">
          You need more USDC to fund this escrow. Convert XLM to USDC first, then fund the escrow.
        </p>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-[#e1edf8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#6f7f8f] uppercase">USDC needed</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">{missingUsdcAmount ?? "0"} USDC</dd>
        </div>
        <div className="rounded-lg border border-[#e1edf8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#6f7f8f] uppercase">Estimated XLM</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">
            {topUp.quote?.estimatedSendAmount ?? "-"} {topUp.quote ? "XLM" : ""}
          </dd>
        </div>
        <div className="rounded-lg border border-[#e1edf8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#6f7f8f] uppercase">Maximum XLM spend</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">
            {topUp.quote?.sendMax ?? "-"} {topUp.quote ? "XLM" : ""}
          </dd>
        </div>
        <div className="rounded-lg border border-[#e1edf8] bg-white p-3">
          <dt className="text-xs tracking-[0.06em] text-[#6f7f8f] uppercase">Slippage tolerance</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">1%</dd>
        </div>
        <div className="rounded-lg border border-[#e1edf8] bg-white p-3 sm:col-span-2">
          <dt className="text-xs tracking-[0.06em] text-[#6f7f8f] uppercase">Route</dt>
          <dd className="mt-1 font-medium text-[#0a0a0a]">{formatRoute(topUp)}</dd>
        </div>
      </dl>

      <div className="space-y-1 text-xs text-[#4f5f6f]">
        <p>Network fee not included in conversion amount.</p>
        <p>Conversion depends on available Stellar DEX liquidity.</p>
        <p>The transaction can fail if the route changes before submission.</p>
        <p>Highrable does not set the exchange rate.</p>
        <p>This conversion is external-wallet-only.</p>
      </div>

      {topUp.quoteError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {topUp.quoteError}
        </p>
      ) : null}

      {topUp.executionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {topUp.executionError}
        </p>
      ) : null}

      {topUp.lastTxHash ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p>Conversion submitted. Refresh your balance, then fund escrow normally.</p>
          {txExplorerUrl ? (
            <a
              href={txExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex font-medium underline"
            >
              View transaction
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <AppButton
          type="button"
          variant="secondary"
          disabled={topUp.isQuoting || topUp.isExecuting}
          onClick={() => void topUp.requestQuote()}
          className="disabled:cursor-not-allowed disabled:opacity-60"
        >
          {topUp.isQuoting ? "Getting quote..." : "Get quote"}
        </AppButton>
        <AppButton
          type="button"
          disabled={!topUp.quote || topUp.isExecuting || topUp.isQuoting}
          onClick={() => void topUp.executeTopUp().catch(() => undefined)}
          className="disabled:cursor-not-allowed disabled:opacity-60"
        >
          {topUp.isExecuting ? "Converting..." : "Convert XLM to USDC"}
        </AppButton>
        <AppButton
          type="button"
          variant="secondary"
          disabled={topUp.isExecuting}
          onClick={() => void onRefreshBalance?.()}
          className="disabled:cursor-not-allowed disabled:opacity-60"
        >
          Refresh balance
        </AppButton>
        {canFundEscrow ? (
          <AppButton
            type="button"
            disabled={isFundEscrowPending}
            onClick={() => void onFundEscrow?.()}
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFundEscrowPending ? "Funding Escrow..." : "Fund Escrow"}
          </AppButton>
        ) : null}
      </div>
    </div>
  );
}
