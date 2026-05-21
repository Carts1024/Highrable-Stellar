import { BadRequestError } from "./errors";
import { requireNonEmptyString } from "./input";

const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;

function normalizeOptionalContractId(value: string | undefined): string | null {
  const sanitized = value?.trim();
  return sanitized && CONTRACT_ID_PATTERN.test(sanitized) ? sanitized : null;
}

function getConfiguredEscrowAssetIds(): Set<string> {
  return new Set(
    [
      normalizeOptionalContractId(process.env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID),
      normalizeOptionalContractId(process.env.NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID),
    ].filter((asset): asset is string => Boolean(asset)),
  );
}

export function sanitizeSupportedEscrowAsset(asset: string): string {
  const sanitizedAsset = requireNonEmptyString(asset, "asset");

  if (!CONTRACT_ID_PATTERN.test(sanitizedAsset)) {
    throw new BadRequestError("Escrow asset must be a Stellar contract ID.");
  }

  const configuredAssets = getConfiguredEscrowAssetIds();
  if (configuredAssets.size > 0 && !configuredAssets.has(sanitizedAsset)) {
    throw new BadRequestError("This job uses an unsupported escrow asset.");
  }

  return sanitizedAsset;
}
