import { z } from "zod";

/**
 * Interface for the validated client-side application environment.
 */
export interface IClientEnv {
  readonly NEXT_PUBLIC_STELLAR_NETWORK: "testnet" | "public";
  readonly NEXT_PUBLIC_STELLAR_RPC_URL: string;
  readonly NEXT_PUBLIC_STELLAR_HORIZON_URL: string;
  readonly NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: string;
  readonly NEXT_PUBLIC_CONVEX_URL: string;
  readonly NEXT_PUBLIC_STABLECOIN_ASSET_CODE: string;
  readonly NEXT_PUBLIC_STABLECOIN_ISSUER: string;
  readonly NEXT_PUBLIC_APP_DOMAIN: string;
  readonly NEXT_PUBLIC_REPUTATION_CONTRACT_ID?: string;
  readonly NEXT_PUBLIC_ESCROW_CONTRACT_ID?: string;
  readonly NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID?: string;
  readonly NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?: string;
  readonly NODE_ENV: "development" | "production" | "test";
}

/**
 * Interface for the validated server-side application environment.
 */
export interface IServerEnv extends IClientEnv {
  readonly WALLET_SESSION_SECRET?: string;
}

const TContractIdSchema = z
  .string()
  .trim()
  .regex(/^C[A-Z2-7]{55}$/, "Invalid Stellar contract ID format");

const TStellarPublicKeySchema = z
  .string()
  .trim()
  .regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key format");

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["testnet", "public"]).default("testnet"),
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().url().default("https://soroban-testnet.stellar.org"),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: z.string().url().default("https://horizon-testnet.stellar.org"),
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: z
    .string()
    .min(1)
    .default("Test SDF Network ; September 2015"),
  NEXT_PUBLIC_CONVEX_URL: z.string().url().default("http://127.0.0.1:3210"),
  NEXT_PUBLIC_STABLECOIN_ASSET_CODE: z.string().min(1).default("USDC"),
  NEXT_PUBLIC_STABLECOIN_ISSUER: TStellarPublicKeySchema.default(
    "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  ),
  NEXT_PUBLIC_APP_DOMAIN: z.string().min(1).default("localhost"),
  NEXT_PUBLIC_REPUTATION_CONTRACT_ID: TContractIdSchema.optional(),
  NEXT_PUBLIC_ESCROW_CONTRACT_ID: TContractIdSchema.optional(),
  NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID: TContractIdSchema.optional(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().trim().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const ServerEnvSchema = ClientEnvSchema.extend({
  WALLET_SESSION_SECRET: z.string().min(1).optional(),
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
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN,
    NEXT_PUBLIC_REPUTATION_CONTRACT_ID: process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID,
    NEXT_PUBLIC_ESCROW_CONTRACT_ID: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID,
    NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID: process.env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NODE_ENV: process.env.NODE_ENV,
    WALLET_SESSION_SECRET: process.env.WALLET_SESSION_SECRET,
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
  stablecoinTokenContractId: string;
} {
  const missing = [
    !env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID && "NEXT_PUBLIC_REPUTATION_CONTRACT_ID",
    !env.NEXT_PUBLIC_ESCROW_CONTRACT_ID && "NEXT_PUBLIC_ESCROW_CONTRACT_ID",
    !env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID && "NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Required contract IDs are missing: ${missing.join(", ")}`);
  }

  return {
    reputationContractId: env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID!,
    escrowContractId: env.NEXT_PUBLIC_ESCROW_CONTRACT_ID!,
    stablecoinTokenContractId: env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID!,
  };
}
