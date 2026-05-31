import { env } from "@/core/config/env";

import type { TWalletNetwork, TWalletState } from "@/core/wallet/types";

const NETWORK =
  env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? "mainnet" : env.NEXT_PUBLIC_STELLAR_NETWORK;
const RAW_WALLETCONNECT_PROJECT_ID = env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const HAS_WALLETCONNECT_PROJECT_ID =
  !!RAW_WALLETCONNECT_PROJECT_ID &&
  RAW_WALLETCONNECT_PROJECT_ID !== "REPLACE_WITH_YOUR_WALLETCONNECT_PROJECT_ID";

if (env.NODE_ENV === "production" && !HAS_WALLETCONNECT_PROJECT_ID) {
  throw new Error(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required in production when WalletConnect is enabled.",
  );
}

if (env.NODE_ENV !== "production" && !HAS_WALLETCONNECT_PROJECT_ID) {
  // eslint-disable-next-line no-console
  console.warn(
    "WalletConnect project ID is not set. WalletConnect will be unavailable until NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is provided.",
  );
}

export const STELLAR_TESTNET_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const STELLAR_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
export const STELLAR_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";
export const STELLAR_TESTNET_NETWORK_LABEL = "Stellar Testnet";
export const STELLAR_MAINNET_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";
export const STELLAR_MAINNET_NETWORK_LABEL = "Stellar Mainnet";

export const WALLET_NETWORK: TWalletNetwork =
  NETWORK === "local" || NETWORK === "mainnet" ? NETWORK : "testnet";
export const WALLET_NETWORK_PASSPHRASE = env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
export const WALLET_NETWORK_LABEL =
  WALLET_NETWORK === "mainnet"
    ? STELLAR_MAINNET_NETWORK_LABEL
    : WALLET_NETWORK === "local"
      ? "Local Stellar Network"
      : STELLAR_TESTNET_NETWORK_LABEL;
export const WALLETCONNECT_PROJECT_ID = HAS_WALLETCONNECT_PROJECT_ID
  ? RAW_WALLETCONNECT_PROJECT_ID
  : undefined;

export function isWalletOnConfiguredNetwork(wallet: Pick<TWalletState, "isTestnet">): boolean {
  return WALLET_NETWORK === "mainnet" ? !wallet.isTestnet : wallet.isTestnet;
}

export function getWalletNetworkMismatchMessage(action = "continue"): string {
  return `Switch your wallet to ${WALLET_NETWORK_LABEL} before ${action}.`;
}
