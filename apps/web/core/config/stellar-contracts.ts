import { getStablecoinConfigOrThrow } from "@/core/stellar/stablecoin-config";

import { env, ensureContractConfig } from "./env";

export const STELLAR_RPC_URL = env.NEXT_PUBLIC_STELLAR_RPC_URL;
export const STELLAR_HORIZON_URL = env.NEXT_PUBLIC_STELLAR_HORIZON_URL;
export const STELLAR_NETWORK_PASSPHRASE = env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
export const STELLAR_NETWORK = env.NEXT_PUBLIC_STELLAR_NETWORK;
export const STABLECOIN_ASSET_CODE = env.NEXT_PUBLIC_STABLECOIN_ASSET_CODE;
export const STABLECOIN_ISSUER = env.NEXT_PUBLIC_STABLECOIN_ISSUER;
export const STABLECOIN_SYMBOL = env.NEXT_PUBLIC_STABLECOIN_SYMBOL ?? "Mock USDC";
export const STABLECOIN_DECIMALS = env.NEXT_PUBLIC_STABLECOIN_DECIMALS ?? 7;
export const REPUTATION_CONTRACT_ID = env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID;
export const ESCROW_CONTRACT_ID = env.NEXT_PUBLIC_ESCROW_CONTRACT_ID;
export const STABLECOIN_TOKEN_CONTRACT_ID = env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID;

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
