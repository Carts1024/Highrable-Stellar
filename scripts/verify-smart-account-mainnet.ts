import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type TNetwork = "testnet" | "mainnet" | "local" | "unknown";
type TRelayerKind = "none" | "custom" | "openzeppelin_channels" | "sdk_source_account";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;
const PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;
const HASH_PATTERN = /^[a-fA-F0-9]{64}$/;
const SUPPORTED_RELAYER_KINDS = new Set<TRelayerKind>([
  "none",
  "custom",
  "openzeppelin_channels",
  "sdk_source_account",
]);

type TArtifact = {
  network?: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  horizonUrl?: string;
  accountWasmHash?: string;
  accountWasmSha256?: string;
  webauthnVerifierContractId?: string;
  webauthnVerifierWasmSha256?: string;
  factoryContractId?: string;
  deploymentLabel?: string;
  deploymentVersion?: string;
  sourceRepo?: string;
  deployerAddress?: string;
  relayerKind?: string;
  relayerPublicKey?: string;
  allowedTargetContracts?: string[];
  notes?: string[];
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function normalizeNetwork(value: string | undefined): TNetwork {
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

function loadArtifact(network: TNetwork): TArtifact {
  if (network !== "mainnet" && network !== "testnet") {
    return {};
  }

  const artifactPath = resolve(process.cwd(), "deployments", "smart-accounts", `${network}.json`);
  return JSON.parse(readFileSync(artifactPath, "utf8")) as TArtifact;
}

function looksLikeTestnet(value: string | undefined): boolean {
  const normalized = value?.toLowerCase() ?? "";
  return normalized.includes("testnet") || normalized.includes("futurenet");
}

function requireValue(issues: string[], name: string, value: string | undefined): void {
  if (!value) {
    issues.push(`${name} is missing.`);
  }
}

function validateDomain(issues: string[], domain: string | undefined): void {
  requireValue(issues, "NEXT_PUBLIC_APP_DOMAIN", domain);
  if (!domain) {
    return;
  }

  const url = new URL(domain.match(/^https?:\/\//iu) ? domain : `https://${domain}`);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    issues.push(
      "Mainnet passkeys require a production HTTPS domain. Localhost is only valid for development.",
    );
  }
  if (!domain.startsWith("https://")) {
    issues.push("NEXT_PUBLIC_APP_DOMAIN must be an HTTPS URL on mainnet.");
  }
}

function validateMainnet(): number {
  const issues: string[] = [];
  const warnings: string[] = [];
  const network = normalizeNetwork(readEnv("NEXT_PUBLIC_STELLAR_NETWORK"));
  const artifact = loadArtifact(network === "unknown" ? "mainnet" : network);
  const relayerKind = readEnv("NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND") ?? artifact.relayerKind;

  if (network !== "mainnet") {
    issues.push("NEXT_PUBLIC_STELLAR_NETWORK must be mainnet or public for this verification.");
  }
  if (readEnv("NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE") !== MAINNET_PASSPHRASE) {
    issues.push("NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE is not the Stellar mainnet passphrase.");
  }
  if (looksLikeTestnet(readEnv("NEXT_PUBLIC_STELLAR_RPC_URL"))) {
    issues.push(
      "NEXT_PUBLIC_STELLAR_RPC_URL points to testnet or futurenet while mainnet is selected.",
    );
  }
  if (looksLikeTestnet(readEnv("NEXT_PUBLIC_STELLAR_HORIZON_URL"))) {
    issues.push(
      "NEXT_PUBLIC_STELLAR_HORIZON_URL points to testnet or futurenet while mainnet is selected.",
    );
  }

  requireValue(issues, "NEXT_PUBLIC_STELLAR_RPC_URL", readEnv("NEXT_PUBLIC_STELLAR_RPC_URL"));
  requireValue(
    issues,
    "NEXT_PUBLIC_STELLAR_HORIZON_URL",
    readEnv("NEXT_PUBLIC_STELLAR_HORIZON_URL"),
  );
  requireValue(
    issues,
    "NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH",
    readEnv("NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH"),
  );
  requireValue(
    issues,
    "NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID",
    readEnv("NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID"),
  );
  requireValue(issues, "NEXT_PUBLIC_PASSKEY_RP_NAME", readEnv("NEXT_PUBLIC_PASSKEY_RP_NAME"));
  requireValue(issues, "NEXT_PUBLIC_ESCROW_CONTRACT_ID", readEnv("NEXT_PUBLIC_ESCROW_CONTRACT_ID"));
  requireValue(
    issues,
    "NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID",
    readEnv("NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID"),
  );
  requireValue(issues, "NEXT_PUBLIC_USDC_ASSET_CODE", readEnv("NEXT_PUBLIC_USDC_ASSET_CODE"));
  requireValue(issues, "NEXT_PUBLIC_USDC_ASSET_ISSUER", readEnv("NEXT_PUBLIC_USDC_ASSET_ISSUER"));
  validateDomain(issues, readEnv("NEXT_PUBLIC_APP_DOMAIN"));

  const wasmHash = readEnv("NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH");
  if (wasmHash && !HASH_PATTERN.test(wasmHash)) {
    issues.push("NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH must be a 64-character hex hash.");
  }

  for (const [name, value] of [
    [
      "NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID",
      readEnv("NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID"),
    ],
    ["NEXT_PUBLIC_ESCROW_CONTRACT_ID", readEnv("NEXT_PUBLIC_ESCROW_CONTRACT_ID")],
    [
      "NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID",
      readEnv("NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID"),
    ],
  ] as const) {
    if (value && !CONTRACT_ID_PATTERN.test(value)) {
      issues.push(`${name} must be a valid C... contract ID.`);
    }
  }

  if (!relayerKind || !SUPPORTED_RELAYER_KINDS.has(relayerKind as TRelayerKind)) {
    issues.push(
      relayerKind === "launchtube"
        ? "Launchtube is legacy and is not supported. Use OpenZeppelin Relayer with the Channels Plugin instead."
        : "NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND must be none, custom, openzeppelin_channels, or sdk_source_account.",
    );
  }

  if (relayerKind === "openzeppelin_channels" && !readEnv("SMART_ACCOUNT_CHANNELS_API_KEY")) {
    issues.push(
      "SMART_ACCOUNT_CHANNELS_API_KEY must be present server-side for OpenZeppelin Channels.",
    );
  }
  if (relayerKind === "custom" && !readEnv("SMART_ACCOUNT_RELAYER_PRIVATE_KEY")) {
    issues.push(
      "SMART_ACCOUNT_RELAYER_PRIVATE_KEY must be present server-side for a custom relayer.",
    );
  }
  if (
    readEnv("SMART_ACCOUNT_RELAYER_PUBLIC_KEY") &&
    !PUBLIC_KEY_PATTERN.test(readEnv("SMART_ACCOUNT_RELAYER_PUBLIC_KEY")!)
  ) {
    issues.push("SMART_ACCOUNT_RELAYER_PUBLIC_KEY must be a valid G... account.");
  }

  if (artifact.network && artifact.network !== "mainnet") {
    issues.push("Deployment artifact network does not match mainnet.");
  }
  if (artifact.networkPassphrase && artifact.networkPassphrase !== MAINNET_PASSPHRASE) {
    issues.push("Deployment artifact passphrase is not mainnet.");
  }
  if (artifact.relayerKind === "launchtube") {
    issues.push("Deployment artifact uses unsupported launchtube relayerKind.");
  }
  if (!artifact.allowedTargetContracts || artifact.allowedTargetContracts.length === 0) {
    warnings.push("Deployment artifact has no allowedTargetContracts yet.");
  }
  if (!artifact.notes?.some((note) => note.toLowerCase().includes("domain"))) {
    warnings.push("Mainnet artifact should include production domain notes.");
  }

  for (const publicName of [
    "NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_PRIVATE_KEY",
    "NEXT_PUBLIC_SMART_ACCOUNT_CHANNELS_API_KEY",
  ]) {
    if (readEnv(publicName)) {
      issues.push(
        `${publicName} must not exist. Private relayer credentials cannot use NEXT_PUBLIC_.`,
      );
    }
  }

  console.log("Highrable mainnet smart-account readiness verification");
  for (const warning of warnings) {
    console.warn(`WARN: ${warning}`);
  }
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`FAIL: ${issue}`);
    }
    return 1;
  }

  console.log("PASS: mainnet smart-account configuration gate passed.");
  console.log(
    "Mainnet readiness checks reduce configuration risk. They do not replace audits, monitoring, incident response, or legal/compliance review.",
  );
  return 0;
}

if (readEnv("NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE") === TESTNET_PASSPHRASE) {
  console.warn("WARN: testnet passphrase detected while running mainnet verifier.");
}

process.exitCode = validateMainnet();
