import { formatAssetLabel } from "@/core/stellar/assets";
import { formatTokenAmount } from "@/core/stellar/amounts";
import { stablecoinConfig } from "@/core/stellar/stablecoin-config";

import type { TAssetAmount } from "@/features/dashboard/types";

/** Returns a human-readable asset label for known contracts, or a shortened contract ID. */
export function formatAsset(asset: string): string {
  return formatAssetLabel(asset);
}

/** Formats a human-readable stablecoin amount for display. */
export function formatAmount(amount: number): string {
  return formatTokenAmount(amount, stablecoinConfig.symbol).replace(` ${stablecoinConfig.symbol}`, "");
}

/** Formats an asset amount with its label as a single string. */
export function formatAssetAmount(row: TAssetAmount): string {
  return `${formatAmount(row.amount)} ${formatAsset(row.asset)}`;
}
