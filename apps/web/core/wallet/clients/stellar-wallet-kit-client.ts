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
import { FreighterModule } from "@creit-tech/stellar-wallets-kit/modules/freighter";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import {
  WalletConnectModule,
  WalletConnectTargetChain,
} from "@creit-tech/stellar-wallets-kit/modules/wallet-connect";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { LocalStorageKeys, Networks } from "@creit-tech/stellar-wallets-kit/types";

import type { IWalletClient, TWalletAccount } from "@/core/wallet/types";
import type { ModuleInterface } from "@creit-tech/stellar-wallets-kit/types";

declare const window:
  | (Window &
      typeof globalThis & {
        stellar?: {
          provider?: string;
          platform?: string;
        };
      })
  | undefined;

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "object" && error !== null) {
    const objectWithErrorMessage = error as {
      message?: unknown;
      error?: {
        message?: unknown;
      };
    };

    if (
      typeof objectWithErrorMessage.message === "string" &&
      objectWithErrorMessage.message.trim().length > 0
    ) {
      return objectWithErrorMessage.message.trim();
    }

    if (
      typeof objectWithErrorMessage.error?.message === "string" &&
      objectWithErrorMessage.error.message.trim().length > 0
    ) {
      return objectWithErrorMessage.error.message.trim();
    }
  }

  return "Wallet request failed. Please try again.";
}

function isStaleWalletConnectSessionError(error: unknown): boolean {
  const normalizedMessage = getErrorMessage(error).toLowerCase();

  return (
    normalizedMessage.includes("session topic doesn't exist") ||
    normalizedMessage.includes("no matching key") ||
    normalizedMessage.includes("no walletconnect session found")
  );
}

function clearWalletConnectStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  const storageMatchers = ["walletconnect", "wc@", "WALLETCONNECT_DEEPLINK_CHOICE"];

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keysToDelete: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (!key) {
        continue;
      }

      const normalizedKey = key.toLowerCase();

      if (storageMatchers.some((matcher) => normalizedKey.includes(matcher.toLowerCase()))) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      storage.removeItem(key);
    }
  }
}

function getStoredWalletSelection(): {
  address: string | null;
  walletId: string | null;
} {
  if (typeof window === "undefined") {
    return {
      address: null,
      walletId: null,
    };
  }

  return {
    address: window.localStorage.getItem(LocalStorageKeys.activeAddress),
    walletId: window.localStorage.getItem(LocalStorageKeys.selectedModuleId),
  };
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

class SafeFreighterModule extends FreighterModule {
  public override async isAvailable(): Promise<boolean> {
    if (
      typeof window !== "undefined" &&
      window.stellar?.provider === "freighter" &&
      window.stellar?.platform === "mobile"
    ) {
      return false;
    }

    const originalConsoleError = console.error;

    try {
      console.error = () => undefined;
      return await super.isAvailable();
    } catch {
      return false;
    } finally {
      console.error = originalConsoleError;
    }
  }
}

function ensureKitInitialized(): void {
  if (walletKitInitialized) {
    return;
  }

  const modules = defaultModules().map(
    (module): ModuleInterface =>
      module.productId === "freighter" ? new SafeFreighterModule() : module,
  );
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
  private async clearStaleWalletConnectState(): Promise<void> {
    clearWalletConnectStorage();

    try {
      await StellarWalletsKit.disconnect();
    } catch {
      // Ignore disconnect failures while clearing broken WalletConnect state.
    }
  }

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

    try {
      const response = await StellarWalletsKit.authModal();
      return this.resolveActiveWallet(response.address);
    } catch (error) {
      if (!isStaleWalletConnectSessionError(error)) {
        throw new Error(getErrorMessage(error));
      }

      await this.clearStaleWalletConnectState();

      try {
        const retryResponse = await StellarWalletsKit.authModal();
        return this.resolveActiveWallet(retryResponse.address);
      } catch (retryError) {
        throw new Error(getErrorMessage(retryError));
      }
    }
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

  public async restoreConnection(): Promise<TWalletAccount | null> {
    ensureKitInitialized();

    const storedWalletSelection = getStoredWalletSelection();

    if (!storedWalletSelection.address || !storedWalletSelection.walletId) {
      return null;
    }

    try {
      StellarWalletsKit.setWallet(storedWalletSelection.walletId);
      const selectedModule = StellarWalletsKit.selectedModule;

      if (!(await selectedModule.isAvailable())) {
        return null;
      }

      return await this.resolveActiveWallet(storedWalletSelection.address);
    } catch {
      return null;
    }
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
