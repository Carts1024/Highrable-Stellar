import { env } from "@/core/config/env";

import { fromTokenUnits, parseHumanAmount, toTokenUnits } from "./amounts";
import { stablecoinConfig, validateStablecoinConfig } from "./stablecoin-config";

export type TEscrowPaymentAssetKind = "stablecoin" | "native_xlm";

export type TEscrowPaymentAsset = {
  readonly kind: TEscrowPaymentAssetKind;
  readonly symbol: string;
  readonly displayName: string;
  readonly tokenContractId: string;
  readonly decimals: number;
  readonly isPrimary: boolean;
  readonly isVolatile: boolean;
  readonly isConfigured: boolean;
  readonly readinessMessage?: string;
};

const NATIVE_XLM_DECIMALS = 7;
const MISSING_NATIVE_XLM_MESSAGE = "XLM escrow is not configured for this deployment.";
const UNSUPPORTED_ESCROW_ASSET_MESSAGE = "This job uses an unsupported escrow asset.";

function normalizeContractId(contractId: string | null | undefined): string {
  return contractId?.trim() ?? "";
}

function createStablecoinAsset(): TEscrowPaymentAsset {
  const validation = validateStablecoinConfig();
  return {
    kind: "stablecoin",
    symbol: stablecoinConfig.symbol || "USDC",
    displayName: "USDC escrow",
    tokenContractId: normalizeContractId(stablecoinConfig.tokenContractId),
    decimals: stablecoinConfig.decimals,
    isPrimary: true,
    isVolatile: false,
    isConfigured: validation.isValid,
    ...(validation.message ? { readinessMessage: validation.message } : {}),
  };
}

function createNativeXlmAsset(): TEscrowPaymentAsset {
  const tokenContractId = normalizeContractId(env.NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID);
  return {
    kind: "native_xlm",
    symbol: "XLM",
    displayName: "XLM escrow",
    tokenContractId,
    decimals: NATIVE_XLM_DECIMALS,
    isPrimary: false,
    isVolatile: true,
    isConfigured: tokenContractId.length > 0,
    ...(!tokenContractId ? { readinessMessage: MISSING_NATIVE_XLM_MESSAGE } : {}),
  };
}

export function getSupportedEscrowAssets(): TEscrowPaymentAsset[] {
  return [createStablecoinAsset(), createNativeXlmAsset()];
}

export function getConfiguredEscrowAssets(): TEscrowPaymentAsset[] {
  return getSupportedEscrowAssets().filter((asset) => asset.isConfigured);
}

export function getPrimaryEscrowAsset(): TEscrowPaymentAsset {
  return createStablecoinAsset();
}

export function getEscrowAssetByContractId(
  contractId: string | null | undefined,
): TEscrowPaymentAsset | null {
  const normalizedContractId = normalizeContractId(contractId);
  if (!normalizedContractId) {
    return null;
  }

  return (
    getSupportedEscrowAssets().find(
      (asset) => asset.tokenContractId && asset.tokenContractId === normalizedContractId,
    ) ?? null
  );
}

export function getEscrowAssetBySymbol(
  symbol: string | null | undefined,
): TEscrowPaymentAsset | null {
  const normalizedSymbol = symbol?.trim().toUpperCase();
  if (!normalizedSymbol) {
    return null;
  }

  return (
    getSupportedEscrowAssets().find((asset) => asset.symbol.toUpperCase() === normalizedSymbol) ??
    null
  );
}

export function isSupportedEscrowAsset(contractId: string | null | undefined): boolean {
  const asset = getEscrowAssetByContractId(contractId);
  return Boolean(asset?.isConfigured);
}

export function isStablecoinEscrowAsset(contractId: string | null | undefined): boolean {
  const asset = getEscrowAssetByContractId(contractId);
  return asset?.kind === "stablecoin" && asset.isConfigured;
}

export function isNativeXlmEscrowAsset(contractId: string | null | undefined): boolean {
  const asset = getEscrowAssetByContractId(contractId);
  return asset?.kind === "native_xlm" && asset.isConfigured;
}

export function requireSupportedEscrowAsset(
  contractId: string | null | undefined,
): TEscrowPaymentAsset {
  const asset = getEscrowAssetByContractId(contractId);

  if (!asset) {
    throw new Error(UNSUPPORTED_ESCROW_ASSET_MESSAGE);
  }

  if (!asset.isConfigured) {
    throw new Error(asset.readinessMessage ?? UNSUPPORTED_ESCROW_ASSET_MESSAGE);
  }

  return asset;
}

export function formatEscrowAssetAmount(
  asset: TEscrowPaymentAsset,
  rawAmount: bigint | number | string,
): string {
  return fromTokenUnits(rawAmount, asset.decimals);
}

export function parseEscrowAssetAmount(
  asset: TEscrowPaymentAsset,
  humanAmount: number | string,
): bigint {
  return toTokenUnits(parseHumanAmount(String(humanAmount)), asset.decimals);
}

export function getUnsupportedEscrowAssetMessage(): string {
  return UNSUPPORTED_ESCROW_ASSET_MESSAGE;
}
