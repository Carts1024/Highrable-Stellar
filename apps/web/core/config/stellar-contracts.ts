import { z } from "zod";

const TStellarContractsEnvSchema = z.object({
  NEXT_PUBLIC_STELLAR_NETWORK: z.string().default("testnet"),
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().default("https://soroban-testnet.stellar.org"),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: z.string().default("https://horizon-testnet.stellar.org"),
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: z.string().default("Test SDF Network ; September 2015"),
  NEXT_PUBLIC_STABLECOIN_ASSET_CODE: z.string().default("USDC"),
  NEXT_PUBLIC_STABLECOIN_ISSUER: z
    .string()
    .default("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"),
  NEXT_PUBLIC_REPUTATION_CONTRACT_ID: z.string().optional(),
  NEXT_PUBLIC_ESCROW_CONTRACT_ID: z.string().optional(),
  NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID: z.string().optional(),
});

const TContractIdSchema = z.string().regex(/^C[A-Z2-7]{55}$/);
const TStellarPublicKeySchema = z.string().regex(/^G[A-Z2-7]{55}$/);

const ENV = TStellarContractsEnvSchema.parse({
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  NEXT_PUBLIC_STELLAR_RPC_URL: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
  NEXT_PUBLIC_STELLAR_HORIZON_URL: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL,
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
  NEXT_PUBLIC_STABLECOIN_ASSET_CODE: process.env.NEXT_PUBLIC_STABLECOIN_ASSET_CODE,
  NEXT_PUBLIC_STABLECOIN_ISSUER: process.env.NEXT_PUBLIC_STABLECOIN_ISSUER,
  NEXT_PUBLIC_REPUTATION_CONTRACT_ID: process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID,
  NEXT_PUBLIC_ESCROW_CONTRACT_ID: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID,
  NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID: process.env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID,
});

const sanitize = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const parseContractId = (value: string | undefined, envName: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = TContractIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${envName} must be a valid Stellar contract ID (C...).`);
  }

  return parsed.data;
};

const parseStellarPublicKey = (value: string, envName: string): string => {
  const parsed = TStellarPublicKeySchema.safeParse(value.trim());
  if (!parsed.success) {
    throw new Error(`${envName} must be a valid Stellar public key (G...).`);
  }

  return parsed.data;
};

const reputationContractId = parseContractId(
  sanitize(ENV.NEXT_PUBLIC_REPUTATION_CONTRACT_ID),
  "NEXT_PUBLIC_REPUTATION_CONTRACT_ID",
);
const escrowContractId = parseContractId(
  sanitize(ENV.NEXT_PUBLIC_ESCROW_CONTRACT_ID),
  "NEXT_PUBLIC_ESCROW_CONTRACT_ID",
);

if (process.env.NODE_ENV === "production" && (!reputationContractId || !escrowContractId)) {
  throw new Error(
    "Missing contract IDs. Set NEXT_PUBLIC_REPUTATION_CONTRACT_ID and NEXT_PUBLIC_ESCROW_CONTRACT_ID.",
  );
}

export const STELLAR_RPC_URL = ENV.NEXT_PUBLIC_STELLAR_RPC_URL.trim();
export const STELLAR_HORIZON_URL = ENV.NEXT_PUBLIC_STELLAR_HORIZON_URL.trim();
export const STELLAR_NETWORK_PASSPHRASE = ENV.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE.trim();
export const STELLAR_NETWORK = ENV.NEXT_PUBLIC_STELLAR_NETWORK.trim().toLowerCase();
export const STABLECOIN_ASSET_CODE = ENV.NEXT_PUBLIC_STABLECOIN_ASSET_CODE.trim();
export const STABLECOIN_ISSUER = parseStellarPublicKey(
  ENV.NEXT_PUBLIC_STABLECOIN_ISSUER,
  "NEXT_PUBLIC_STABLECOIN_ISSUER",
);
export const REPUTATION_CONTRACT_ID = reputationContractId;
export const ESCROW_CONTRACT_ID = escrowContractId;
export const STABLECOIN_TOKEN_CONTRACT_ID = parseContractId(
  sanitize(ENV.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID),
  "NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID",
);

export function getRequiredContractIds(): {
  reputationContractId: string;
  escrowContractId: string;
} {
  if (!REPUTATION_CONTRACT_ID || !ESCROW_CONTRACT_ID) {
    throw new Error(
      "Contract IDs are not configured. Run deployment and set NEXT_PUBLIC_REPUTATION_CONTRACT_ID and NEXT_PUBLIC_ESCROW_CONTRACT_ID.",
    );
  }

  return {
    reputationContractId: REPUTATION_CONTRACT_ID,
    escrowContractId: ESCROW_CONTRACT_ID,
  };
}

export function getRequiredEscrowActionConfig(): {
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  reputationContractId: string;
  escrowContractId: string;
  stablecoinTokenContractId: string;
} {
  const { reputationContractId, escrowContractId } = getRequiredContractIds();

  if (!STABLECOIN_TOKEN_CONTRACT_ID) {
    throw new Error(
      "Stablecoin token contract ID is not configured. Set NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID to the Stellar Asset Contract ID for configured USDC.",
    );
  }

  return {
    rpcUrl: STELLAR_RPC_URL,
    horizonUrl: STELLAR_HORIZON_URL,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    reputationContractId,
    escrowContractId,
    stablecoinTokenContractId: STABLECOIN_TOKEN_CONTRACT_ID,
  };
}
