import { getRelayerReadiness, type IRelayerHealthResponse } from "@/core/stellar/relayer-readiness";
import {
  getMainnetPassphrase,
  getSmartAccountDeploymentConfig,
  getTestnetPassphrase,
  normalizeConfiguredNetwork,
  type ISmartAccountDeploymentConfig,
  type TRelayerKind,
  type TStellarDeploymentNetwork,
} from "@/core/stellar/smart-account-deployment-config";

export type TSmartAccountWasmHashStatus = "missing" | "present" | "mismatch" | "unknown";
export type TVerifierFormatStatus = "missing" | "invalid" | "valid";
export type TVerifierStatus = "missing" | "invalid_format" | "unverified" | "verified" | "mismatch";

export interface ISmartAccountReadinessContext {
  readonly connectedAccountAddress?: string | null;
  readonly connectedAccountWasmHash?: string | null;
  readonly connectedSignerVerifier?: string | null;
  readonly sourceAccount?: string | null;
  readonly sourceAccountFunded?: boolean | null;
  readonly relayerHealth?: IRelayerHealthResponse | null;
  readonly channelsApiKeyAvailable?: boolean | null;
}

export interface ISmartAccountMainnetReadiness {
  readonly network: TStellarDeploymentNetwork;
  readonly isMainnet: boolean;
  readonly networkStatus: {
    readonly stellarNetwork?: string;
    readonly networkPassphrase?: string;
    readonly rpcUrl?: string;
    readonly horizonUrl?: string;
    readonly rpcLooksLikeTestnet: boolean;
    readonly horizonLooksLikeTestnet: boolean;
    readonly rpcLooksLikeMainnet: boolean;
    readonly horizonLooksLikeMainnet: boolean;
    readonly hasNetworkMismatch: boolean;
  };
  readonly appDomainStatus: {
    readonly appDomain?: string;
    readonly derivedRpId?: string;
    readonly rpName?: string;
    readonly isHttps: boolean;
    readonly isLocalhost: boolean;
    readonly isValidForMainnet: boolean;
  };
  readonly smartAccountStatus: {
    readonly configuredWasmHash?: string;
    readonly configuredWasmSha256?: string;
    readonly connectedAccountAddress?: string;
    readonly connectedAccountWasmHash?: string;
    readonly wasmHashMatches?: boolean;
    readonly wasmHashStatus: TSmartAccountWasmHashStatus;
    readonly factoryContractId?: string;
    readonly deploymentLabel?: string;
    readonly deploymentVersion?: string;
    readonly sourceRepo?: string;
  };
  readonly verifierStatus: {
    readonly verifierContractId?: string;
    readonly verifierWasmSha256?: string;
    readonly formatStatus: TVerifierFormatStatus;
    readonly connectedSignerVerifier?: string;
    readonly verifierMatchesConnectedAccount?: boolean;
    readonly status: TVerifierStatus;
  };
  readonly relayerStatus: {
    readonly relayerKind: TRelayerKind;
    readonly relayerUrl?: string;
    readonly isConfigured: boolean;
    readonly isHttps: boolean;
    readonly isLocalhost: boolean;
    readonly healthStatus: "not_checked" | "ready" | "unreachable" | "unsafe" | "unsupported";
    readonly relayerPublicKey?: string;
    readonly supportedTargets?: string[];
    readonly maxFeePerTx?: string;
    readonly warnings: string[];
  };
  readonly sourceAccountStatus: {
    readonly sourceAccount?: string;
    readonly formatStatus: "missing" | "invalid" | "valid" | "unknown";
    readonly fundingStatus: "unknown" | "funded" | "unfunded" | "not_required";
  };
  readonly paymentAssetStatus: {
    readonly stablecoin: "missing" | "configured" | "unverified";
    readonly nativeXlmSac: "missing" | "configured" | "unverified";
    readonly usdcClassicAsset: "missing" | "configured" | "unverified";
    readonly warnings: string[];
  };
  readonly capabilities: {
    readonly canCreatePasskeyAccount: boolean;
    readonly canRestorePasskeyAccount: boolean;
    readonly canExecutePasskeyEscrow: boolean;
    readonly canExecuteMainnetPasskeyEscrow: boolean;
    readonly canUseExternalWalletEscrow: boolean;
    readonly canUseXlmToUsdcTopUp: boolean;
  };
  readonly blockingIssues: string[];
  readonly warnings: string[];
  readonly recommendations: string[];
}

const CONTRACT_ACCOUNT_PATTERN = /^C[A-Z2-7]{55}$/;
const CLASSIC_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;
const TESTNET_ISSUERS = new Set(["GBBD47IFXDGCAYTNZGDTQ5VLLQHUQIVTRAW3PGQJIVQKQ3GGMN7RCW5Q"]);
const UNSUPPORTED_LAUNCHTUBE_MESSAGE =
  "Launchtube is legacy and is not supported. Use OpenZeppelin Relayer with the Channels Plugin instead.";

function looksLikeTestnet(value: string | undefined): boolean {
  const normalized = value?.toLowerCase() ?? "";
  return normalized.includes("testnet") || normalized.includes("futurenet");
}

function looksLikeMainnet(value: string | undefined): boolean {
  const normalized = value?.toLowerCase() ?? "";
  return (
    normalized.includes("mainnet") || normalized.includes("pubnet") || normalized.includes("public")
  );
}

function parseAppDomain(value: string | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
}

export function deriveRpId(appDomain: string | undefined): string | undefined {
  const url = parseAppDomain(appDomain);
  if (!url) {
    return undefined;
  }

  return url.hostname.toLowerCase();
}

function isLocalhostRpId(value: string | undefined): boolean {
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

function isHttpsDomain(value: string | undefined): boolean {
  const url = parseAppDomain(value);
  if (!url) {
    return false;
  }

  if (!value?.match(/^https?:\/\//iu)) {
    return false;
  }

  return url.protocol === "https:";
}

function normalizeContract(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function getVerifierStatus(input: {
  readonly verifierContractId?: string;
  readonly connectedSignerVerifier?: string;
}): Pick<
  ISmartAccountMainnetReadiness["verifierStatus"],
  "formatStatus" | "status" | "verifierMatchesConnectedAccount"
> {
  if (!input.verifierContractId) {
    return { formatStatus: "missing", status: "missing" };
  }

  if (!CONTRACT_ACCOUNT_PATTERN.test(input.verifierContractId)) {
    return { formatStatus: "invalid", status: "invalid_format" };
  }

  if (!input.connectedSignerVerifier) {
    return { formatStatus: "valid", status: "unverified" };
  }

  const verifierMatchesConnectedAccount =
    normalizeContract(input.connectedSignerVerifier) === input.verifierContractId;
  return {
    formatStatus: "valid",
    status: verifierMatchesConnectedAccount ? "verified" : "mismatch",
    verifierMatchesConnectedAccount,
  };
}

function getSourceAccountStatus(
  sourceAccount: string | null | undefined,
  sourceAccountFunded: boolean | null | undefined,
  relayerKind: TRelayerKind,
): ISmartAccountMainnetReadiness["sourceAccountStatus"] {
  if (relayerKind === "custom" || relayerKind === "openzeppelin_channels") {
    return {
      sourceAccount: sourceAccount ?? undefined,
      formatStatus: "unknown",
      fundingStatus: "not_required",
    };
  }

  if (!sourceAccount) {
    return { formatStatus: "missing", fundingStatus: "unknown" };
  }

  return {
    sourceAccount,
    formatStatus: CLASSIC_ACCOUNT_PATTERN.test(sourceAccount) ? "valid" : "invalid",
    fundingStatus:
      sourceAccountFunded === true
        ? "funded"
        : sourceAccountFunded === false
          ? "unfunded"
          : "unknown",
  };
}

function getPaymentAssetStatus(
  config: ISmartAccountDeploymentConfig,
): ISmartAccountMainnetReadiness["paymentAssetStatus"] {
  const warnings: string[] = [];
  const stablecoin = config.stablecoinTokenContractId ? "configured" : "missing";
  const nativeXlmSac = config.nativeXlmTokenContractId ? "configured" : "missing";
  const usdcClassicAsset =
    config.usdcAssetCode && config.usdcAssetIssuer ? "configured" : "missing";

  if (!config.nativeXlmTokenContractId) {
    warnings.push("Native XLM SAC is missing. XLM escrow remains unavailable until configured.");
  }

  if (!config.usdcAssetIssuer) {
    warnings.push(
      "USDC classic issuer is missing. External-wallet XLM to USDC top-up is disabled.",
    );
  }

  return { stablecoin, nativeXlmSac, usdcClassicAsset, warnings };
}

export function evaluateSmartAccountMainnetReadiness(
  context: ISmartAccountReadinessContext = {},
  config: ISmartAccountDeploymentConfig = getSmartAccountDeploymentConfig(),
): ISmartAccountMainnetReadiness {
  const network = normalizeConfiguredNetwork(config.network);
  const isMainnet = network === "mainnet";
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const rawRelayerKind = config.rawRelayerKind?.trim().toLowerCase();

  if (rawRelayerKind === "launchtube") {
    blockingIssues.push(UNSUPPORTED_LAUNCHTUBE_MESSAGE);
  }

  const networkStatus = {
    stellarNetwork: config.stellarNetwork,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    horizonUrl: config.horizonUrl,
    rpcLooksLikeTestnet: looksLikeTestnet(config.rpcUrl),
    horizonLooksLikeTestnet: looksLikeTestnet(config.horizonUrl),
    rpcLooksLikeMainnet: looksLikeMainnet(config.rpcUrl),
    horizonLooksLikeMainnet: looksLikeMainnet(config.horizonUrl),
    hasNetworkMismatch: false,
  };
  networkStatus.hasNetworkMismatch =
    (isMainnet && (networkStatus.rpcLooksLikeTestnet || networkStatus.horizonLooksLikeTestnet)) ||
    (network === "testnet" &&
      (config.networkPassphrase === getMainnetPassphrase() ||
        networkStatus.rpcLooksLikeMainnet ||
        networkStatus.horizonLooksLikeMainnet));

  const derivedRpId = deriveRpId(config.appDomain);
  const appDomainStatus = {
    appDomain: config.appDomain,
    derivedRpId,
    rpName: config.rpName,
    isHttps: isHttpsDomain(config.appDomain),
    isLocalhost: isLocalhostRpId(derivedRpId),
    isValidForMainnet: Boolean(
      config.appDomain &&
      derivedRpId &&
      isHttpsDomain(config.appDomain) &&
      !isLocalhostRpId(derivedRpId),
    ),
  };

  const connectedAccountAddress = normalizeContract(context.connectedAccountAddress);
  const connectedAccountWasmHash = context.connectedAccountWasmHash?.trim().toLowerCase();
  const wasmHashMatches =
    Boolean(config.accountWasmHash && connectedAccountWasmHash) &&
    config.accountWasmHash === connectedAccountWasmHash;
  const smartAccountStatus = {
    configuredWasmHash: config.accountWasmHash,
    configuredWasmSha256: config.accountWasmSha256,
    connectedAccountAddress,
    connectedAccountWasmHash,
    wasmHashMatches: connectedAccountWasmHash ? wasmHashMatches : undefined,
    wasmHashStatus: !config.accountWasmHash
      ? "missing"
      : connectedAccountWasmHash
        ? wasmHashMatches
          ? "present"
          : "mismatch"
        : "unknown",
    factoryContractId: config.factoryContractId,
    deploymentLabel: config.deploymentLabel,
    deploymentVersion: config.deploymentVersion,
    sourceRepo: config.sourceRepo,
  } satisfies ISmartAccountMainnetReadiness["smartAccountStatus"];

  const connectedSignerVerifier = normalizeContract(context.connectedSignerVerifier);
  const verifierBase = getVerifierStatus({
    verifierContractId: config.webauthnVerifierContractId,
    connectedSignerVerifier,
  });
  const verifierStatus = {
    verifierContractId: config.webauthnVerifierContractId,
    verifierWasmSha256: config.webauthnVerifierWasmSha256,
    connectedSignerVerifier,
    ...verifierBase,
  };

  const relayerReadiness = getRelayerReadiness({
    config,
    sourceAccount: context.sourceAccount,
    sourceAccountFunded: context.sourceAccountFunded,
    healthResponse: context.relayerHealth,
    channelsApiKeyAvailable: context.channelsApiKeyAvailable,
  });
  const sourceAccountStatus = getSourceAccountStatus(
    context.sourceAccount,
    context.sourceAccountFunded,
    config.relayerKind,
  );
  const paymentAssetStatus = getPaymentAssetStatus(config);

  if (!config.rpcUrl) {
    blockingIssues.push("Stellar RPC URL is missing.");
  }
  if (!config.networkPassphrase) {
    blockingIssues.push("Stellar network passphrase is missing.");
  }
  if (!config.accountWasmHash) {
    blockingIssues.push("Missing smart account WASM hash.");
  }
  if (!config.webauthnVerifierContractId) {
    blockingIssues.push("Missing WebAuthn verifier contract ID.");
  }
  if (verifierStatus.formatStatus === "invalid") {
    blockingIssues.push("Invalid WebAuthn verifier contract format.");
  }
  if (!config.appDomain) {
    blockingIssues.push("Missing app domain.");
  }
  if (!config.rpName) {
    blockingIssues.push("Passkey RP name is missing.");
  }
  if (!config.stablecoinTokenContractId) {
    blockingIssues.push("Missing stablecoin token contract ID.");
  }
  if (!config.escrowContractId) {
    blockingIssues.push("Missing escrow contract ID.");
  }

  if (isMainnet) {
    if (config.networkPassphrase !== getMainnetPassphrase()) {
      blockingIssues.push("Network passphrase is not Stellar mainnet.");
    }
    if (networkStatus.rpcLooksLikeTestnet) {
      blockingIssues.push("RPC URL points to testnet or futurenet while mainnet is selected.");
    }
    if (networkStatus.horizonLooksLikeTestnet) {
      blockingIssues.push("Horizon URL points to testnet or futurenet while mainnet is selected.");
    }
    if (appDomainStatus.isLocalhost) {
      blockingIssues.push(
        "Mainnet passkeys require a production HTTPS domain. Localhost is only valid for development.",
      );
    }
    if (!appDomainStatus.isHttps) {
      blockingIssues.push("App domain must use HTTPS on mainnet.");
    }
    if (connectedAccountAddress && !CONTRACT_ACCOUNT_PATTERN.test(connectedAccountAddress)) {
      blockingIssues.push("Connected passkey smart-account address is not a C... contract.");
    }
    if (smartAccountStatus.wasmHashStatus === "mismatch") {
      blockingIssues.push(
        "The connected smart account was deployed from a different WASM hash. Do not use it for mainnet escrow.",
      );
    }
    if (verifierStatus.status === "mismatch") {
      blockingIssues.push(
        "The connected smart account uses a different WebAuthn verifier than this Highrable deployment expects.",
      );
    }
    if (config.usdcAssetIssuer && TESTNET_ISSUERS.has(config.usdcAssetIssuer)) {
      blockingIssues.push(
        "A testnet USDC issuer appears to be configured while mainnet is selected.",
      );
    }
    if (relayerReadiness.blockingIssues.length > 0) {
      blockingIssues.push(...relayerReadiness.blockingIssues);
    }
  }

  const hasFeePath =
    relayerReadiness.healthStatus === "ready" ||
    relayerReadiness.relayerKind === "custom" ||
    relayerReadiness.relayerKind === "openzeppelin_channels" ||
    sourceAccountStatus.fundingStatus === "funded";

  if (isMainnet && !hasFeePath) {
    blockingIssues.push(
      "No fee path is available for passkey smart-account execution. Configure OpenZeppelin Channels, a custom relayer, or a funded source account.",
    );
  }

  warnings.push(...relayerReadiness.warnings, ...paymentAssetStatus.warnings);
  if (!config.sourceRepo) {
    warnings.push("No smart-account source repo metadata configured.");
  }
  if (!config.accountWasmSha256) {
    warnings.push("No smart-account WASM SHA256 metadata configured.");
  }
  warnings.push(
    "Backend signed-session enforcement still has TODOs.",
    "Dispute resolution is still limited.",
    "Proof privacy controls are incomplete.",
    "Smart contracts do not emit events.",
    "Path Payment top-up depends on liquidity and trustline readiness.",
    "XLM escrow exposes users to volatility.",
    "Configuration readiness does not mean the contracts or relayer have been audited for production funds.",
  );

  if (networkStatus.hasNetworkMismatch) {
    warnings.push(
      "A testnet contract, issuer, or endpoint appears to be configured while mainnet is selected.",
    );
  }

  recommendations.push(
    "Run scripts/verify-smart-account-mainnet.ts before enabling mainnet passkey escrow.",
    "Test passkey escrow with tiny amounts before raising limits.",
    "Keep relayer credentials server-side only and restrict allowed target contracts.",
  );

  const canCreatePasskeyAccount =
    Boolean(
      config.rpcUrl &&
      config.networkPassphrase &&
      config.accountWasmHash &&
      config.webauthnVerifierContractId &&
      config.appDomain &&
      config.rpName,
    ) &&
    (!isMainnet || appDomainStatus.isValidForMainnet);
  const canRestorePasskeyAccount = canCreatePasskeyAccount;
  const canExecutePasskeyEscrow =
    canRestorePasskeyAccount &&
    Boolean(config.escrowContractId && config.stablecoinTokenContractId);
  const canExecuteMainnetPasskeyEscrow =
    isMainnet && canExecutePasskeyEscrow && blockingIssues.length === 0;

  return {
    network,
    isMainnet,
    networkStatus,
    appDomainStatus,
    smartAccountStatus,
    verifierStatus,
    relayerStatus: {
      relayerKind: relayerReadiness.relayerKind,
      relayerUrl: relayerReadiness.relayerUrl,
      isConfigured: relayerReadiness.isConfigured,
      isHttps: relayerReadiness.isHttps,
      isLocalhost: relayerReadiness.isLocalhost,
      healthStatus: relayerReadiness.healthStatus,
      relayerPublicKey: relayerReadiness.relayerPublicKey,
      supportedTargets: relayerReadiness.supportedTargets,
      maxFeePerTx: relayerReadiness.maxFeePerTx,
      warnings: relayerReadiness.warnings,
    },
    sourceAccountStatus,
    paymentAssetStatus,
    capabilities: {
      canCreatePasskeyAccount,
      canRestorePasskeyAccount,
      canExecutePasskeyEscrow,
      canExecuteMainnetPasskeyEscrow,
      canUseExternalWalletEscrow: true,
      canUseXlmToUsdcTopUp: paymentAssetStatus.usdcClassicAsset !== "missing",
    },
    blockingIssues: Array.from(new Set(blockingIssues)),
    warnings: Array.from(new Set(warnings)),
    recommendations,
  };
}

export { getMainnetPassphrase, getTestnetPassphrase };
