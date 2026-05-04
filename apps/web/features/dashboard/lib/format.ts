import { STABLECOIN_TOKEN_CONTRACT_ID } from "@/core/config/stellar-contracts";

import type { TAssetAmount } from "@/features/dashboard/types";

/** Returns a human-readable asset label for known contracts, or a shortened contract ID. */
export function formatAsset(asset: string): string {
  if (STABLECOIN_TOKEN_CONTRACT_ID && asset === STABLECOIN_TOKEN_CONTRACT_ID) {
    return "Mock USDC";
  }

  if (asset.length > 10) {
    return `Token ${asset.slice(0, 4)}...${asset.slice(-4)}`;
  }

  return asset;
}

/** Formats a human-readable stablecoin amount for display. */
export function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 7 });
}

/** Formats an asset amount with its label as a single string. */
export function formatAssetAmount(row: TAssetAmount): string {
  return `${formatAmount(row.amount)} ${formatAsset(row.asset)}`;
}
