import { getStablecoinConfigOrThrow } from "@/core/stellar/stablecoin-config";

import { env, ensureContractConfig } from "./env";

export const STELLAR_RPC_URL = env.NEXT_PUBLIC_STELLAR_RPC_URL;
export const STELLAR_HORIZON_URL = env.NEXT_PUBLIC_STELLAR_HORIZON_URL;
export const STELLAR_NETWORK_PASSPHRASE = env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
export const STELLAR_NETWORK = env.NEXT_PUBLIC_STELLAR_NETWORK;
export const STABLECOIN_ASSET_CODE =
  env.NEXT_PUBLIC_USDC_ASSET_CODE ?? env.NEXT_PUBLIC_STABLECOIN_ASSET_CODE;
export const STABLECOIN_ISSUER =
  env.NEXT_PUBLIC_USDC_ASSET_ISSUER ??
  env.NEXT_PUBLIC_STABLECOIN_ISSUER ??
  (env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID?.startsWith("G")
    ? env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID
    : "");
export const STABLECOIN_SYMBOL = env.NEXT_PUBLIC_STABLECOIN_SYMBOL ?? "Mock USDC";
export const STABLECOIN_DECIMALS = env.NEXT_PUBLIC_STABLECOIN_DECIMALS ?? 7;
export const REPUTATION_CONTRACT_ID = env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID;
export const ESCROW_CONTRACT_ID = env.NEXT_PUBLIC_ESCROW_CONTRACT_ID;
export const REGISTRY_CONTRACT_ID = env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
export const STABLECOIN_TOKEN_CONTRACT_ID = env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID;

export function getRequiredRegistryConfig(): {
  rpcUrl: string;
  network: string;
  networkPassphrase: string;
  registryContractId: string;
} {
  const registryContractId = REGISTRY_CONTRACT_ID;
  if (!registryContractId) {
    throw new Error(
      "On-chain registration is not configured. Set NEXT_PUBLIC_REGISTRY_CONTRACT_ID to enable signup completion.",
    );
  }
  return {
    rpcUrl: STELLAR_RPC_URL,
    network: STELLAR_NETWORK === "public" ? "mainnet" : STELLAR_NETWORK,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    registryContractId,
  };
}

export function getRequiredContractIds(): {
  reputationContractId: string;
  escrowContractId: string;
} {
  const config = ensureContractConfig();
  return {
    reputationContractId: config.reputationContractId,
    escrowContractId: config.escrowContractId,
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
  const config = ensureContractConfig();
  const stablecoin = getStablecoinConfigOrThrow();

  return {
    rpcUrl: STELLAR_RPC_URL,
    horizonUrl: STELLAR_HORIZON_URL,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    reputationContractId: config.reputationContractId,
    escrowContractId: config.escrowContractId,
    stablecoinTokenContractId: stablecoin.tokenContractId,
  };
}

export function getRequiredAdminContractConfig(): {
  rpcUrl: string;
  network: string;
  networkPassphrase: string;
  escrowContractId: string;
} {
  const config = ensureContractConfig();
  if (!STELLAR_RPC_URL || !STELLAR_NETWORK_PASSPHRASE || !STELLAR_NETWORK) {
    throw new Error("Stellar network configuration is incomplete.");
  }
  return {
    rpcUrl: STELLAR_RPC_URL,
    network: STELLAR_NETWORK,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    escrowContractId: config.escrowContractId,
  };
}
