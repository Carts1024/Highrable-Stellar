import {
  normalizeRelayerKind,
  type ISmartAccountDeploymentConfig,
  type TRelayerKind,
  type TStellarDeploymentNetwork,
} from "@/core/stellar/smart-account-deployment-config";

export type TRelayerHealthStatus =
  | "not_checked"
  | "ready"
  | "unreachable"
  | "unsafe"
  | "unsupported";

export interface IRelayerHealthResponse {
  readonly status?: string;
  readonly network?: string;
  readonly relayerPublicKey?: string;
  readonly supportedTargets?: readonly string[];
  readonly maxFeePerTx?: string;
  readonly version?: string;
}

export interface IRelayerReadinessInput {
  readonly config: Pick<
    ISmartAccountDeploymentConfig,
    "network" | "relayerKind" | "relayerUrl" | "escrowContractId"
  >;
  readonly sourceAccount?: string | null;
  readonly sourceAccountFunded?: boolean | null;
  readonly healthResponse?: IRelayerHealthResponse | null;
  readonly channelsApiKeyAvailable?: boolean | null;
}

export interface IRelayerReadiness {
  readonly relayerKind: TRelayerKind;
  readonly relayerUrl?: string;
  readonly isConfigured: boolean;
  readonly isHttps: boolean;
  readonly isLocalhost: boolean;
  readonly healthStatus: TRelayerHealthStatus;
  readonly relayerPublicKey?: string;
  readonly supportedTargets?: string[];
  readonly maxFeePerTx?: string;
  readonly warnings: string[];
  readonly blockingIssues: string[];
}

const CLASSIC_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;
const CONTRACT_ACCOUNT_PATTERN = /^C[A-Z2-7]{55}$/;
const OPENZEPPELIN_CHANNELS_MAINNET_URL = "https://channels.openzeppelin.com";
const OPENZEPPELIN_CHANNELS_TESTNET_URL = "https://channels.openzeppelin.com/testnet";

function parseUrl(value: string | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isLocalhostUrl(url: URL | null): boolean {
  if (!url) {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

function normalizeNetworkName(value: string | undefined): TStellarDeploymentNetwork {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "public" || normalized === "pubnet") {
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

function openZeppelinChannelsUrlMatchesNetwork(
  network: TStellarDeploymentNetwork,
  relayerUrl: string | undefined,
): boolean {
  if (!relayerUrl) {
    return false;
  }

  const normalized = relayerUrl.replace(/\/+$/u, "");
  if (network === "mainnet") {
    return normalized === OPENZEPPELIN_CHANNELS_MAINNET_URL;
  }

  if (network === "testnet") {
    return normalized === OPENZEPPELIN_CHANNELS_TESTNET_URL;
  }

  return network === "local";
}

function checkCustomHealth(input: IRelayerReadinessInput): Pick<
  IRelayerReadiness,
  "healthStatus" | "relayerPublicKey" | "supportedTargets" | "maxFeePerTx"
> & {
  readonly blockingIssues: string[];
  readonly warnings: string[];
} {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const health = input.healthResponse;

  if (!health) {
    return {
      healthStatus: "not_checked",
      blockingIssues,
      warnings,
    };
  }

  if (health.status !== "ok") {
    blockingIssues.push("Relayer health check did not report status ok.");
  }

  if (normalizeNetworkName(health.network) !== input.config.network) {
    blockingIssues.push("Relayer health check reports the wrong Stellar network.");
  }

  if (!health.relayerPublicKey || !CLASSIC_ACCOUNT_PATTERN.test(health.relayerPublicKey)) {
    blockingIssues.push("Relayer health check returned an invalid relayer public key.");
  }

  const supportedTargets = (health.supportedTargets ?? []).map((target) =>
    target.trim().toUpperCase(),
  );
  if (input.config.escrowContractId && !supportedTargets.includes(input.config.escrowContractId)) {
    blockingIssues.push("Relayer supported targets do not include the Highrable escrow contract.");
  }

  if (supportedTargets.some((target) => !CONTRACT_ACCOUNT_PATTERN.test(target))) {
    warnings.push("Relayer health check includes an invalid supported target contract.");
  }

  return {
    healthStatus: blockingIssues.length > 0 ? "unsafe" : "ready",
    relayerPublicKey: health.relayerPublicKey,
    supportedTargets,
    maxFeePerTx: health.maxFeePerTx,
    blockingIssues,
    warnings,
  };
}

export function getRelayerReadiness(input: IRelayerReadinessInput): IRelayerReadiness {
  const relayerKind = normalizeRelayerKind(input.config.relayerKind);
  const relayerUrl = input.config.relayerUrl;
  const url = parseUrl(relayerUrl);
  const isHttps = url?.protocol === "https:";
  const isLocalhost = isLocalhostUrl(url);
  const isMainnet = input.config.network === "mainnet";
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (relayerKind === "unknown") {
    blockingIssues.push(
      "NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND is unsupported. Use none, custom, openzeppelin_channels, or sdk_source_account.",
    );
    return {
      relayerKind,
      relayerUrl,
      isConfigured: false,
      isHttps,
      isLocalhost,
      healthStatus: "unsupported",
      warnings,
      blockingIssues,
    };
  }

  if (relayerKind === "none") {
    if (isMainnet) {
      warnings.push(
        "No production fee-sponsorship path is configured. Passkey execution needs a funded SDK/source account or relayer.",
      );
    }

    return {
      relayerKind,
      relayerUrl,
      isConfigured: false,
      isHttps,
      isLocalhost,
      healthStatus: "not_checked",
      warnings,
      blockingIssues,
    };
  }

  if (relayerKind === "sdk_source_account") {
    if (isMainnet) {
      warnings.push(
        "SDK source account fallback is configured on mainnet. Prefer OpenZeppelin Channels or a hardened custom relayer for production fee submission.",
      );
    }

    return {
      relayerKind,
      relayerUrl,
      isConfigured: Boolean(input.sourceAccount),
      isHttps,
      isLocalhost,
      healthStatus:
        input.sourceAccountFunded === false
          ? "unsafe"
          : input.sourceAccountFunded === true
            ? "ready"
            : "not_checked",
      warnings,
      blockingIssues,
    };
  }

  if (!relayerUrl || !url) {
    blockingIssues.push("Relayer URL is missing or invalid.");
  }

  if (isMainnet && !isHttps) {
    blockingIssues.push("Custom relayer or channel URL must use HTTPS on mainnet.");
  }

  if (isMainnet && isLocalhost) {
    blockingIssues.push("Custom relayer or channel URL must not be localhost on mainnet.");
  }

  if (relayerKind === "openzeppelin_channels") {
    if (!openZeppelinChannelsUrlMatchesNetwork(input.config.network, relayerUrl)) {
      blockingIssues.push(
        "OpenZeppelin Channels base URL does not match the selected Stellar network.",
      );
    }

    if (isMainnet && input.channelsApiKeyAvailable === false) {
      blockingIssues.push(
        "OpenZeppelin Channels is configured but server-side API key readiness could not be verified.",
      );
    }

    return {
      relayerKind,
      relayerUrl,
      isConfigured: blockingIssues.length === 0,
      isHttps,
      isLocalhost,
      healthStatus: blockingIssues.length > 0 ? "unsafe" : "not_checked",
      warnings,
      blockingIssues,
    };
  }

  const health = checkCustomHealth(input);
  return {
    relayerKind,
    relayerUrl,
    isConfigured: Boolean(relayerUrl) && blockingIssues.length === 0,
    isHttps,
    isLocalhost,
    healthStatus: blockingIssues.length > 0 ? "unsafe" : health.healthStatus,
    relayerPublicKey: health.relayerPublicKey,
    supportedTargets: health.supportedTargets,
    maxFeePerTx: health.maxFeePerTx,
    warnings: [...warnings, ...health.warnings],
    blockingIssues: [...blockingIssues, ...health.blockingIssues],
  };
}
