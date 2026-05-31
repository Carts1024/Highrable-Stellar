import { env } from "@/core/config/env";
import { resolveStablecoinTokenContractId } from "@/core/stellar/stablecoin-config";

export type TStellarDeploymentNetwork = "local" | "testnet" | "mainnet" | "unknown";
export type TRelayerKind =
  | "none"
  | "custom"
  | "openzeppelin_channels"
  | "sdk_source_account"
  | "unknown";

export interface ISmartAccountDeploymentConfig {
  readonly network: TStellarDeploymentNetwork;
  readonly stellarNetwork?: string;
  readonly networkPassphrase?: string;
  readonly rpcUrl?: string;
  readonly horizonUrl?: string;
  readonly accountWasmHash?: string;
  readonly accountWasmSha256?: string;
  readonly webauthnVerifierContractId?: string;
  readonly webauthnVerifierWasmSha256?: string;
  readonly factoryContractId?: string;
  readonly deploymentLabel?: string;
  readonly deploymentVersion?: string;
  readonly sourceRepo?: string;
  readonly appDomain?: string;
  readonly rpName?: string;
  readonly relayerKind: TRelayerKind;
  readonly rawRelayerKind?: string;
  readonly relayerUrl?: string;
  readonly stablecoinTokenContractId?: string;
  readonly nativeXlmTokenContractId?: string;
  readonly usdcAssetCode?: string;
  readonly usdcAssetIssuer?: string;
  readonly escrowContractId?: string;
  readonly reputationContractId?: string;
}

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

export function normalizeOptionalString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeConfiguredNetwork(
  value: string | null | undefined,
): TStellarDeploymentNetwork {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "public" || normalized === "pubnet" || normalized === "mainnet") {
    return "mainnet";
  }

  if (normalized === "testnet") {
    return "testnet";
  }

  if (normalized === "local" || normalized === "standalone") {
    return "local";
  }

  return "unknown";
}

export function normalizeRelayerKind(value: string | null | undefined): TRelayerKind {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "none" ||
    normalized === "custom" ||
    normalized === "openzeppelin_channels" ||
    normalized === "sdk_source_account"
  ) {
    return normalized;
  }

  return "unknown";
}

export function normalizeContractId(value: string | null | undefined): string | undefined {
  return normalizeOptionalString(value)?.toUpperCase();
}

export function normalizeHash(value: string | null | undefined): string | undefined {
  return normalizeOptionalString(value)?.toLowerCase();
}

export function getMainnetPassphrase(): string {
  return MAINNET_PASSPHRASE;
}

export function getTestnetPassphrase(): string {
  return TESTNET_PASSPHRASE;
}

export function getSmartAccountDeploymentConfig(): ISmartAccountDeploymentConfig {
  const relayerUrl = normalizeOptionalString(env.NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL);
  const rawRelayerKind = normalizeOptionalString(env.NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND);
  const relayerKind = rawRelayerKind
    ? normalizeRelayerKind(rawRelayerKind)
    : relayerUrl
      ? "custom"
      : "sdk_source_account";

  return {
    network: normalizeConfiguredNetwork(env.NEXT_PUBLIC_STELLAR_NETWORK),
    stellarNetwork: normalizeOptionalString(env.NEXT_PUBLIC_STELLAR_NETWORK),
    networkPassphrase: normalizeOptionalString(env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE),
    rpcUrl: normalizeOptionalString(env.NEXT_PUBLIC_STELLAR_RPC_URL),
    horizonUrl: normalizeOptionalString(env.NEXT_PUBLIC_STELLAR_HORIZON_URL),
    accountWasmHash: normalizeHash(env.NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH),
    accountWasmSha256: normalizeHash(env.NEXT_PUBLIC_SMART_ACCOUNT_WASM_SHA256),
    webauthnVerifierContractId: normalizeContractId(env.NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID),
    webauthnVerifierWasmSha256: normalizeHash(env.NEXT_PUBLIC_WEBAUTHN_VERIFIER_WASM_SHA256),
    factoryContractId: normalizeContractId(env.NEXT_PUBLIC_SMART_ACCOUNT_FACTORY_CONTRACT_ID),
    deploymentLabel: normalizeOptionalString(env.NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_LABEL),
    deploymentVersion: normalizeOptionalString(env.NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_VERSION),
    sourceRepo: normalizeOptionalString(env.NEXT_PUBLIC_SMART_ACCOUNT_SOURCE_REPO),
    appDomain: normalizeOptionalString(env.NEXT_PUBLIC_APP_DOMAIN),
    rpName: normalizeOptionalString(env.NEXT_PUBLIC_PASSKEY_RP_NAME),
    relayerKind,
    rawRelayerKind,
    relayerUrl,
    stablecoinTokenContractId: normalizeContractId(
      resolveStablecoinTokenContractId(env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID),
    ),
    nativeXlmTokenContractId: normalizeContractId(env.NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID),
    usdcAssetCode: normalizeOptionalString(
      env.NEXT_PUBLIC_USDC_ASSET_CODE ?? env.NEXT_PUBLIC_STABLECOIN_ASSET_CODE,
    ),
    usdcAssetIssuer: normalizeOptionalString(
      env.NEXT_PUBLIC_USDC_ASSET_ISSUER ??
        env.NEXT_PUBLIC_STABLECOIN_ISSUER ??
        (env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID?.startsWith("G")
          ? env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID
          : undefined),
    )?.toUpperCase(),
    escrowContractId: normalizeContractId(env.NEXT_PUBLIC_ESCROW_CONTRACT_ID),
    reputationContractId: normalizeContractId(env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID),
  };
}
