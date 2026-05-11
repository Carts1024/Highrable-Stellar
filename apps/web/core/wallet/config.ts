import { env } from "@/core/config/env";

import type { TWalletNetwork } from "@/core/wallet/types";

const NETWORK = env.NEXT_PUBLIC_STELLAR_NETWORK;
const RAW_WALLETCONNECT_PROJECT_ID = env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const HAS_WALLETCONNECT_PROJECT_ID =
  !!RAW_WALLETCONNECT_PROJECT_ID &&
  RAW_WALLETCONNECT_PROJECT_ID !== "REPLACE_WITH_YOUR_WALLETCONNECT_PROJECT_ID";

if (NETWORK !== "testnet") {
  throw new Error(
    "Invalid NEXT_PUBLIC_STELLAR_NETWORK. This phase only supports testnet. Set NEXT_PUBLIC_STELLAR_NETWORK=testnet.",
  );
}

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

export const WALLET_NETWORK: TWalletNetwork = "testnet";
export const WALLETCONNECT_PROJECT_ID = HAS_WALLETCONNECT_PROJECT_ID
  ? RAW_WALLETCONNECT_PROJECT_ID
  : undefined;
