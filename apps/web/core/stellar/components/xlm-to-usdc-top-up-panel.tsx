"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import {
  useXlmToUsdcTopUp,
  type TUseXlmToUsdcTopUpResult,
} from "@/core/stellar/hooks/use-xlm-to-usdc-top-up";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
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

function ConversionMetric({
  label,
  value,
  className = "",
}: {
  readonly label: string;
  readonly value: string;
  readonly className?: string;
}) {
  return (
    <div className={`border-l border-border pl-4 ${className}`}>
      <dt className="hr-label-caps hr-text-muted">{label}</dt>
      <dd className="hr-text-primary mt-1 text-sm font-semibold break-words">{value}</dd>
    </div>
  );
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
      <div className="border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
    <div className="hr-surface-muted space-y-5 border border-border p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div>
          <SectionLabel className="mb-3">Stellar Path Payment</SectionLabel>
          <h3 className="hr-text-primary text-lg font-semibold">Convert XLM to USDC</h3>
          <p className="hr-text-secondary mt-2 max-w-2xl text-sm leading-relaxed">
            You need more USDC to fund this escrow. Convert XLM to USDC first, then fund the escrow.
          </p>
        </div>
        <div className="hr-v2-badge-accent w-fit px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.08em] uppercase">
          XLM -&gt; USDC
        </div>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <ConversionMetric label="USDC Needed" value={`${missingUsdcAmount ?? "0"} USDC`} />
        <ConversionMetric
          label="Estimated XLM"
          value={`${topUp.quote?.estimatedSendAmount ?? "-"} ${topUp.quote ? "XLM" : ""}`.trim()}
        />
        <ConversionMetric
          label="Max XLM Spend"
          value={`${topUp.quote?.sendMax ?? "-"} ${topUp.quote ? "XLM" : ""}`.trim()}
        />
        <ConversionMetric label="Slippage" value="1%" />
        <ConversionMetric
          label="Route"
          value={formatRoute(topUp)}
          className="sm:col-span-2 lg:col-span-4"
        />
      </dl>

      <div className="grid gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-[#5f5f5f] sm:grid-cols-2">
        <p>Network fee not included in conversion amount.</p>
        <p>Conversion depends on available Stellar DEX liquidity.</p>
        <p>The transaction can fail if the route changes before submission.</p>
        <p>Highrable does not set the exchange rate.</p>
        <p>This conversion is external-wallet-only.</p>
      </div>

      {topUp.quoteError ? (
        <p className="border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">
          {topUp.quoteError}
        </p>
      ) : null}

      {topUp.executionError ? (
        <p className="border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">
          {topUp.executionError}
        </p>
      ) : null}

      {topUp.lastTxHash ? (
        <div className="border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
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
          className="hr-v2-button-secondary rounded-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {topUp.isQuoting ? "Getting quote..." : "Get quote"}
        </AppButton>
        <AppButton
          type="button"
          disabled={!topUp.quote || topUp.isExecuting || topUp.isQuoting}
          onClick={() => void topUp.executeTopUp().catch(() => undefined)}
          className="hr-v2-button-primary rounded-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {topUp.isExecuting ? "Converting..." : "Convert XLM to USDC"}
        </AppButton>
        <AppButton
          type="button"
          variant="secondary"
          disabled={topUp.isExecuting}
          onClick={() => void onRefreshBalance?.()}
          className="hr-v2-button-secondary rounded-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          Refresh balance
        </AppButton>
        {canFundEscrow ? (
          <AppButton
            type="button"
            disabled={isFundEscrowPending}
            onClick={() => void onFundEscrow?.()}
            className="hr-v2-button-primary rounded-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFundEscrowPending ? "Funding Escrow..." : "Fund Escrow"}
          </AppButton>
        ) : null}
      </div>
    </div>
  );
}
