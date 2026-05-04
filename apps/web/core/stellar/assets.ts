import { STABLECOIN_ASSET_CODE, STABLECOIN_ISSUER } from "@/core/config/stellar-contracts";
import { Asset } from "@stellar/stellar-sdk";

export const USDC_ASSET_CODE = STABLECOIN_ASSET_CODE;
export const USDC_ISSUER = STABLECOIN_ISSUER;
export const USDC_ASSET_IDENTIFIER = `${USDC_ASSET_CODE}:${USDC_ISSUER}`;

export function getUsdcAsset(): Asset {
  return new Asset(USDC_ASSET_CODE, USDC_ISSUER);
}
