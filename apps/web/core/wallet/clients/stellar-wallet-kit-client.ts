"use client";

import {
  STELLAR_TESTNET_NETWORK_LABEL,
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
  WALLETCONNECT_PROJECT_ID,
} from "@/core/wallet/config";
import {
  TMessageSchema,
  TStellarPublicKeySchema,
  TTransactionXdrSchema,
} from "@/core/wallet/validation";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import {
  WalletConnectModule,
  WalletConnectTargetChain,
} from "@creit-tech/stellar-wallets-kit/modules/wallet-connect";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { Networks } from "@creit-tech/stellar-wallets-kit/types";

import type { IWalletClient, TWalletAccount } from "@/core/wallet/types";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeWalletNetwork(network: string | null | undefined): {
  network: string;
  isTestnet: boolean;
} {
  const normalizedNetwork = network?.trim();

  if (!normalizedNetwork) {
    return {
      network: STELLAR_TESTNET_NETWORK_LABEL,
      isTestnet: true,
    };
  }

  if (
    normalizedNetwork === STELLAR_TESTNET_NETWORK_PASSPHRASE ||
    normalizedNetwork.toLowerCase().includes("testnet")
  ) {
    return {
      network: STELLAR_TESTNET_NETWORK_LABEL,
      isTestnet: true,
    };
  }

  return {
    network: normalizedNetwork,
    isTestnet: false,
  };
}

let walletKitInitialized = false;

function ensureKitInitialized(): void {
  if (walletKitInitialized) {
    return;
  }

  const modules = defaultModules();
  const appOrigin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://highrable.local";
  if (WALLETCONNECT_PROJECT_ID) {
    modules.push(
      new WalletConnectModule({
        projectId: WALLETCONNECT_PROJECT_ID,
        metadata: {
          name: "Highrable",
          description: "Stellar-native freelancing marketplace on testnet.",
          url: appOrigin,
          icons: [`${appOrigin}/logo/stellar/Stellar_Symbol.png`],
        },
        allowedChains: [WalletConnectTargetChain.TESTNET],
      }),
    );
  }

  StellarWalletsKit.init({
    modules,
    network: Networks.TESTNET,
    theme: {
      background: "#ffffff",
      "background-secondary": "#fff7ed",
      "foreground-strong": "#111827",
      foreground: "#4b5563",
      "foreground-secondary": "#6b7280",
      primary: "#FF7003",
      "primary-foreground": "#ffffff",
      transparent: "rgba(0, 0, 0, 0)",
      lighter: "rgba(255, 112, 3, 0.05)",
      light: "rgba(255, 112, 3, 0.10)",
      "light-gray": "rgba(17, 24, 39, 0.08)",
      gray: "#9ca3af",
      danger: "#ef4444",
      border: "rgba(17, 24, 39, 0.08)",
      shadow: "0 24px 80px rgba(17, 24, 39, 0.18)",
      "border-radius": "1rem",
      "font-family": '"Space Grotesk", system-ui, sans-serif',
    },
    authModal: {
      showInstallLabel: true,
      hideUnsupportedWallets: false,
    },
  });

  walletKitInitialized = true;
}

export class StellarWalletKitClient implements IWalletClient {
  private async resolveActiveWallet(addressInput?: string): Promise<TWalletAccount> {
    ensureKitInitialized();

    const addressResponse = addressInput
      ? { address: addressInput }
      : await StellarWalletsKit.getAddress();
    const address = TStellarPublicKeySchema.parse(addressResponse.address);
    const networkResponse = await StellarWalletsKit.getNetwork().catch(() => ({
      network: STELLAR_TESTNET_NETWORK_LABEL,
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    }));
    const normalizedNetwork = normalizeWalletNetwork(
      networkResponse.networkPassphrase || networkResponse.network,
    );
    const selectedModule = (() => {
      try {
        return StellarWalletsKit.selectedModule;
      } catch {
        return null;
      }
    })();

    return {
      address,
      displayAddress: formatAddress(address),
      walletId: selectedModule?.productId ?? null,
      walletName: selectedModule?.productName ?? null,
      network: normalizedNetwork.network,
      isTestnet: normalizedNetwork.isTestnet,
    };
  }

  public async connect(): Promise<TWalletAccount> {
    ensureKitInitialized();

    if (!WALLETCONNECT_PROJECT_ID) {
      console.warn(
        "WalletConnect is disabled because NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not configured in apps/web/.env.local.",
      );
    }

    const response = await StellarWalletsKit.authModal();
    return this.resolveActiveWallet(response.address);
  }

  public async getActiveWallet(): Promise<TWalletAccount> {
    return this.resolveActiveWallet();
  }

  public async getPublicKey(): Promise<string> {
    ensureKitInitialized();
    const { address } = await StellarWalletsKit.getAddress();
    return TStellarPublicKeySchema.parse(address);
  }

  public async getNetwork(): Promise<{ network: string | null; isTestnet: boolean }> {
    ensureKitInitialized();
    const networkResponse = await StellarWalletsKit.getNetwork().catch(() => ({
      network: STELLAR_TESTNET_NETWORK_LABEL,
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    }));
    return normalizeWalletNetwork(networkResponse.networkPassphrase || networkResponse.network);
  }

  public async disconnect(): Promise<void> {
    ensureKitInitialized();
    await StellarWalletsKit.disconnect();
  }

  public async signMessage(message: string): Promise<string> {
    const sanitizedMessage = TMessageSchema.parse(message);
    ensureKitInitialized();
    const messageResult = await StellarWalletsKit.signMessage(sanitizedMessage, {
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    });
    return messageResult.signedMessage;
  }

  public async signTransaction(xdr: string, address?: string): Promise<string> {
    const sanitizedXdr = TTransactionXdrSchema.parse(xdr);
    const sanitizedAddress = address ? TStellarPublicKeySchema.parse(address) : undefined;
    ensureKitInitialized();
    const transactionResult = await StellarWalletsKit.signTransaction(sanitizedXdr, {
      address: sanitizedAddress,
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    });
    return transactionResult.signedTxXdr;
  }
}
