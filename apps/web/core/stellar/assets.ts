import { STABLECOIN_ASSET_CODE, STABLECOIN_ISSUER } from "@/core/config/stellar-contracts";
import { Asset } from "@stellar/stellar-sdk";

import { stablecoinConfig } from "./stablecoin-config";

export const USDC_ASSET_CODE = STABLECOIN_ASSET_CODE;
export const USDC_ISSUER = STABLECOIN_ISSUER;
export const USDC_ASSET_IDENTIFIER = `${USDC_ASSET_CODE}:${USDC_ISSUER}`;

export function shortenContractId(contractId: string, visibleChars = 6): string {
  const sanitizedContractId = contractId.trim();
  if (sanitizedContractId.length <= visibleChars * 2) {
    return sanitizedContractId;
  }

  return `${sanitizedContractId.slice(0, visibleChars)}...${sanitizedContractId.slice(-visibleChars)}`;
}

export function isConfiguredStablecoin(assetContractId: string): boolean {
  if (!stablecoinConfig.tokenContractId) {
    return false;
  }

  return assetContractId.trim() === stablecoinConfig.tokenContractId;
}

export function formatAssetLabel(assetContractId: string): string {
  if (!assetContractId.trim()) {
    return stablecoinConfig.symbol;
  }

  return isConfiguredStablecoin(assetContractId)
    ? stablecoinConfig.symbol
    : shortenContractId(assetContractId);
}

export function getUsdcAsset(): Asset {
  return new Asset(USDC_ASSET_CODE, USDC_ISSUER);
}
