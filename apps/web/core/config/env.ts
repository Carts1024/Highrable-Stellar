import { z } from "zod";

/**
 * Interface for the validated client-side application environment.
 */
export interface IClientEnv {
  readonly NEXT_PUBLIC_STELLAR_NETWORK: "local" | "testnet" | "mainnet" | "public";
  readonly NEXT_PUBLIC_STELLAR_RPC_URL: string;
  readonly NEXT_PUBLIC_STELLAR_HORIZON_URL: string;
  readonly NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: string;
  readonly NEXT_PUBLIC_CONVEX_URL: string;
  readonly NEXT_PUBLIC_STABLECOIN_ASSET_CODE: string;
  readonly NEXT_PUBLIC_STABLECOIN_ISSUER: string;
  readonly NEXT_PUBLIC_USDC_ASSET_CODE?: string;
  readonly NEXT_PUBLIC_USDC_ASSET_ISSUER?: string;
  readonly NEXT_PUBLIC_STABLECOIN_SYMBOL?: string;
  readonly NEXT_PUBLIC_STABLECOIN_DECIMALS?: number;
  readonly NEXT_PUBLIC_APP_DOMAIN: string;
  readonly NEXT_PUBLIC_REPUTATION_CONTRACT_ID?: string;
  readonly NEXT_PUBLIC_ESCROW_CONTRACT_ID?: string;
  readonly NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID?: string;
  readonly NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID?: string;
  readonly NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?: string;
  readonly NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH?: string;
  readonly NEXT_PUBLIC_SMART_ACCOUNT_FACTORY_CONTRACT_ID?: string;
  readonly NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_LABEL?: string;
  readonly NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_VERSION?: string;
  readonly NEXT_PUBLIC_SMART_ACCOUNT_SOURCE_REPO?: string;
  readonly NEXT_PUBLIC_SMART_ACCOUNT_WASM_SHA256?: string;
  readonly NEXT_PUBLIC_WEBAUTHN_VERIFIER_WASM_SHA256?: string;
  readonly NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID?: string;
  readonly NEXT_PUBLIC_PASSKEY_RP_NAME?: string;
  readonly NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL?: string;
  readonly NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND?:
    | "none"
    | "custom"
    | "openzeppelin_channels"
    | "sdk_source_account"
    | "unknown";
  readonly NEXT_PUBLIC_ENABLE_HIGHRABLE_DEBUGGER?: boolean;
  readonly NODE_ENV: "development" | "production" | "test";
}

/**
 * Interface for the validated server-side application environment.
 */
export interface IServerEnv extends IClientEnv {
  readonly WALLET_SESSION_SECRET?: string;
  readonly HIGHRABLE_ADMIN_WALLET_ADDRESS?: string;
  readonly HIGHRABLE_ADMIN_CONVEX_SECRET?: string;
  readonly SMART_ACCOUNT_RELAYER_PRIVATE_KEY?: string;
  readonly SMART_ACCOUNT_RELAYER_PUBLIC_KEY?: string;
  readonly SMART_ACCOUNT_CHANNELS_API_KEY?: string;
  readonly SMART_ACCOUNT_ALLOWED_TARGET_CONTRACTS?: string;
  readonly SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_TX?: string;
  readonly SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_ACCOUNT_DAILY?: string;
  readonly SMART_ACCOUNT_RELAY_RATE_LIMIT_PER_MINUTE?: string;
}

const TContractIdSchema = z
  .string()
  .trim()
  .regex(/^C[A-Z2-7]{55}$/, "Invalid Stellar contract ID format");

const TStellarPublicKeySchema = z
  .string()
  .trim()
  .regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key format");

const TStellarContractOrPublicKeySchema = z
  .string()
  .trim()
  .regex(/^[CG][A-Z2-7]{55}$/, "Invalid Stellar contract ID or public key format");
const Hash64Schema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{64}$/, "Invalid 32-byte hash format");

function normalizeOptionalBooleanEnv(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return value;
}

const OptionalBooleanEnvSchema = z.preprocess(normalizeOptionalBooleanEnv, z.boolean().optional());

function resolveAppDomainEnvValue(): string | undefined {
  const configuredValue = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim();

  if (configuredValue && configuredValue.length > 0) {
    return configuredValue;
  }

  const vercelDomain = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value && value.length > 0));

  if (vercelDomain && vercelDomain.length > 0) {
    return vercelDomain;
  }

  return process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000";
}

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["local", "testnet", "mainnet", "public"]).default("testnet"),
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().url().default("https://soroban-testnet.stellar.org"),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: z.string().url().default("https://horizon-testnet.stellar.org"),
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: z
    .string()
    .min(1)
    .default("Test SDF Network ; September 2015"),
  NEXT_PUBLIC_CONVEX_URL: z.string().url().default("http://127.0.0.1:3210"),
  NEXT_PUBLIC_STABLECOIN_ASSET_CODE: z.string().min(1).default("USDC"),
  NEXT_PUBLIC_STABLECOIN_ISSUER: TStellarPublicKeySchema.optional(),
  NEXT_PUBLIC_USDC_ASSET_CODE: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_USDC_ASSET_ISSUER: TStellarPublicKeySchema.optional(),
  NEXT_PUBLIC_STABLECOIN_SYMBOL: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_STABLECOIN_DECIMALS: z.coerce.number().int().min(0).max(18).optional(),
  NEXT_PUBLIC_APP_DOMAIN: z.string().trim().min(1),
  NEXT_PUBLIC_REPUTATION_CONTRACT_ID: TContractIdSchema.optional(),
  NEXT_PUBLIC_ESCROW_CONTRACT_ID: TContractIdSchema.optional(),
  NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID: TStellarContractOrPublicKeySchema.optional(),
  NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID: TContractIdSchema.optional(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().trim().optional(),
  NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH: Hash64Schema.optional(),
  NEXT_PUBLIC_SMART_ACCOUNT_FACTORY_CONTRACT_ID: TContractIdSchema.optional(),
  NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_LABEL: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_VERSION: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_SMART_ACCOUNT_SOURCE_REPO: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_SMART_ACCOUNT_WASM_SHA256: Hash64Schema.optional(),
  NEXT_PUBLIC_WEBAUTHN_VERIFIER_WASM_SHA256: Hash64Schema.optional(),
  NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID: TContractIdSchema.optional(),
  NEXT_PUBLIC_PASSKEY_RP_NAME: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL: z.string().url().optional(),
  NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND: z
    .enum(["none", "custom", "openzeppelin_channels", "sdk_source_account", "unknown"])
    .optional(),
  NEXT_PUBLIC_ENABLE_HIGHRABLE_DEBUGGER: OptionalBooleanEnvSchema,
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const ServerEnvSchema = ClientEnvSchema.extend({
  WALLET_SESSION_SECRET: z.string().min(1).optional(),
  HIGHRABLE_ADMIN_WALLET_ADDRESS: TStellarPublicKeySchema.optional(),
  HIGHRABLE_ADMIN_CONVEX_SECRET: z.string().trim().min(1).optional(),
  SMART_ACCOUNT_RELAYER_PRIVATE_KEY: z.string().trim().min(1).optional(),
  SMART_ACCOUNT_RELAYER_PUBLIC_KEY: TStellarPublicKeySchema.optional(),
  SMART_ACCOUNT_CHANNELS_API_KEY: z.string().trim().min(1).optional(),
  SMART_ACCOUNT_ALLOWED_TARGET_CONTRACTS: z.string().trim().min(1).optional(),
  SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_TX: z.string().trim().min(1).optional(),
  SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_ACCOUNT_DAILY: z.string().trim().min(1).optional(),
  SMART_ACCOUNT_RELAY_RATE_LIMIT_PER_MINUTE: z.string().trim().min(1).optional(),
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

function validateEnv(): IServerEnv {
  const isServer = typeof window === "undefined";
  const schema = isServer ? ServerEnvSchema : ClientEnvSchema;

  const result = schema.safeParse({
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_STELLAR_RPC_URL: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
    NEXT_PUBLIC_STELLAR_HORIZON_URL: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL,
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_STABLECOIN_ASSET_CODE: process.env.NEXT_PUBLIC_STABLECOIN_ASSET_CODE,
    NEXT_PUBLIC_STABLECOIN_ISSUER: process.env.NEXT_PUBLIC_STABLECOIN_ISSUER,
    NEXT_PUBLIC_USDC_ASSET_CODE: process.env.NEXT_PUBLIC_USDC_ASSET_CODE,
    NEXT_PUBLIC_USDC_ASSET_ISSUER: process.env.NEXT_PUBLIC_USDC_ASSET_ISSUER,
    NEXT_PUBLIC_STABLECOIN_SYMBOL: process.env.NEXT_PUBLIC_STABLECOIN_SYMBOL,
    NEXT_PUBLIC_STABLECOIN_DECIMALS: process.env.NEXT_PUBLIC_STABLECOIN_DECIMALS,
    NEXT_PUBLIC_APP_DOMAIN: resolveAppDomainEnvValue(),
    NEXT_PUBLIC_REPUTATION_CONTRACT_ID: process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID,
    NEXT_PUBLIC_ESCROW_CONTRACT_ID: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID,
    NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID: process.env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID,
    NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID: process.env.NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH: process.env.NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH,
    NEXT_PUBLIC_SMART_ACCOUNT_FACTORY_CONTRACT_ID:
      process.env.NEXT_PUBLIC_SMART_ACCOUNT_FACTORY_CONTRACT_ID,
    NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_LABEL:
      process.env.NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_LABEL,
    NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_VERSION:
      process.env.NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_VERSION,
    NEXT_PUBLIC_SMART_ACCOUNT_SOURCE_REPO: process.env.NEXT_PUBLIC_SMART_ACCOUNT_SOURCE_REPO,
    NEXT_PUBLIC_SMART_ACCOUNT_WASM_SHA256: process.env.NEXT_PUBLIC_SMART_ACCOUNT_WASM_SHA256,
    NEXT_PUBLIC_WEBAUTHN_VERIFIER_WASM_SHA256:
      process.env.NEXT_PUBLIC_WEBAUTHN_VERIFIER_WASM_SHA256,
    NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID:
      process.env.NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID,
    NEXT_PUBLIC_PASSKEY_RP_NAME: process.env.NEXT_PUBLIC_PASSKEY_RP_NAME,
    NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL: process.env.NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL,
    NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND: process.env.NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND,
    NEXT_PUBLIC_ENABLE_HIGHRABLE_DEBUGGER: process.env.NEXT_PUBLIC_ENABLE_HIGHRABLE_DEBUGGER,
    NODE_ENV: process.env.NODE_ENV,
    WALLET_SESSION_SECRET: process.env.WALLET_SESSION_SECRET,
    HIGHRABLE_ADMIN_WALLET_ADDRESS: process.env.HIGHRABLE_ADMIN_WALLET_ADDRESS,
    HIGHRABLE_ADMIN_CONVEX_SECRET: process.env.HIGHRABLE_ADMIN_CONVEX_SECRET,
    SMART_ACCOUNT_RELAYER_PRIVATE_KEY: process.env.SMART_ACCOUNT_RELAYER_PRIVATE_KEY,
    SMART_ACCOUNT_RELAYER_PUBLIC_KEY: process.env.SMART_ACCOUNT_RELAYER_PUBLIC_KEY,
    SMART_ACCOUNT_CHANNELS_API_KEY: process.env.SMART_ACCOUNT_CHANNELS_API_KEY,
    SMART_ACCOUNT_ALLOWED_TARGET_CONTRACTS: process.env.SMART_ACCOUNT_ALLOWED_TARGET_CONTRACTS,
    SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_TX: process.env.SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_TX,
    SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_ACCOUNT_DAILY:
      process.env.SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_ACCOUNT_DAILY,
    SMART_ACCOUNT_RELAY_RATE_LIMIT_PER_MINUTE:
      process.env.SMART_ACCOUNT_RELAY_RATE_LIMIT_PER_MINUTE,
  });

  if (!result.success) {
    const message = `[Config Error] Invalid environment variables:\n${formatZodError(result.error)}`;
    console.error(message);

    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    // Return partially parsed data as best effort for development
    return (result.data ?? {}) as IServerEnv;
  }

  return result.data as IServerEnv;
}
export const env: IServerEnv = validateEnv();

export function ensureContractConfig(): {
  reputationContractId: string;
  escrowContractId: string;
} {
  const missing = [
    !env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID && "NEXT_PUBLIC_REPUTATION_CONTRACT_ID",
    !env.NEXT_PUBLIC_ESCROW_CONTRACT_ID && "NEXT_PUBLIC_ESCROW_CONTRACT_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Required contract IDs are missing: ${missing.join(", ")}`);
  }

  return {
    reputationContractId: env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID!,
    escrowContractId: env.NEXT_PUBLIC_ESCROW_CONTRACT_ID!,
  };
}
