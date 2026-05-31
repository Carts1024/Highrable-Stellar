"use client";

import {
  STELLAR_MAINNET_NETWORK_LABEL,
  STELLAR_MAINNET_NETWORK_PASSPHRASE,
  STELLAR_TESTNET_NETWORK_LABEL,
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
  WALLET_NETWORK,
  WALLET_NETWORK_LABEL,
  WALLET_NETWORK_PASSPHRASE,
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
import { Networks } from "@creit-tech/stellar-wallets-kit/types";

import type { IWalletClient, TWalletAccount } from "@/core/wallet/types";
import type { ModuleInterface } from "@creit-tech/stellar-wallets-kit/types";

import { WalletPersistenceService } from "../services/wallet-persistence-service";

const WALLET_CONNECT_MODULE_ID = "wallet_connect";
const WALLET_RESTORE_RETRY_DELAYS_MS = [0, 150, 500, 1000] as const;

declare const window:
  | (Window &
      typeof globalThis & {
        stellar?: {
          provider?: string;
          platform?: string;
        };
      })
  | undefined;

type TWalletKitInitOptions = {
  includeWalletConnect: boolean;
};

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

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

function getBrowserStorage(kind: "localStorage" | "sessionStorage"): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[kind];
  } catch {
    return null;
  }
}

function clearWalletConnectStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  const storageMatchers = ["walletconnect", "wc@", "wcsession", "WALLETCONNECT_DEEPLINK_CHOICE"];

  for (const storage of [getBrowserStorage("localStorage"), getBrowserStorage("sessionStorage")]) {
    if (!storage) {
      continue;
    }

    const keysToDelete: string[] = [];

    try {
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
    } catch {
      // Browser privacy settings can deny storage access. Wallet restore remains optional.
    }
  }
}

function isWalletConnectModule(walletId: string): boolean {
  return walletId === WALLET_CONNECT_MODULE_ID;
}

function normalizeWalletNetwork(network: string | null | undefined): {
  network: string;
  isTestnet: boolean;
} {
  const normalizedNetwork = network?.trim();

  if (!normalizedNetwork) {
    return {
      network: WALLET_NETWORK_LABEL,
      isTestnet: WALLET_NETWORK !== "mainnet",
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

  if (
    normalizedNetwork === STELLAR_MAINNET_NETWORK_PASSPHRASE ||
    normalizedNetwork.toLowerCase().includes("mainnet") ||
    normalizedNetwork.toLowerCase().includes("pubnet") ||
    normalizedNetwork.toLowerCase().includes("public")
  ) {
    return {
      network: STELLAR_MAINNET_NETWORK_LABEL,
      isTestnet: false,
    };
  }

  return {
    network: normalizedNetwork,
    isTestnet: false,
  };
}

let walletKitInitialized = false;
let walletKitIncludesWalletConnect = false;
const walletPersistenceService = new WalletPersistenceService();

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

function createWalletModules(includeWalletConnect: boolean): ModuleInterface[] {
  const modules = defaultModules().map(
    (module): ModuleInterface =>
      module.productId === "freighter" ? new SafeFreighterModule() : module,
  );

  if (!includeWalletConnect || !WALLETCONNECT_PROJECT_ID) {
    return modules;
  }

  const appOrigin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://highrable.local";

  modules.push(
    new WalletConnectModule({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: "Highrable",
        description: "Stellar-native freelancing marketplace.",
        url: appOrigin,
        icons: [`${appOrigin}/logo/stellar/Stellar_Symbol.png`],
      },
      allowedChains: [
        WALLET_NETWORK === "mainnet"
          ? WalletConnectTargetChain.PUBLIC
          : WalletConnectTargetChain.TESTNET,
      ],
    }),
  );

  return modules;
}

function ensureKitInitialized(options: TWalletKitInitOptions): void {
  if (walletKitInitialized && (!options.includeWalletConnect || walletKitIncludesWalletConnect)) {
    return;
  }

  StellarWalletsKit.init({
    modules: createWalletModules(options.includeWalletConnect),
    network: WALLET_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
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
  walletKitIncludesWalletConnect = options.includeWalletConnect && !!WALLETCONNECT_PROJECT_ID;
}

export class StellarWalletKitClient implements IWalletClient {
  private getSelectedModule(): ModuleInterface | null {
    try {
      return StellarWalletsKit.selectedModule;
    } catch {
      return null;
    }
  }

  private buildWalletAccount(
    address: string,
    selectedModule: Pick<ModuleInterface, "productId" | "productName"> | null,
    networkInput?: string | null,
  ): TWalletAccount {
    const normalizedNetwork = normalizeWalletNetwork(networkInput);
    const account: TWalletAccount = {
      address,
      displayAddress: formatAddress(address),
      walletId: selectedModule?.productId ?? null,
      walletName: selectedModule?.productName ?? null,
      network: normalizedNetwork.network,
      isTestnet: normalizedNetwork.isTestnet,
    };

    walletPersistenceService.saveWalletSelection(account);

    return account;
  }

  private async selectAvailableWalletModule(
    walletId: string,
    options: TWalletKitInitOptions,
  ): Promise<ModuleInterface | null> {
    ensureKitInitialized(options);

    for (const delayMs of WALLET_RESTORE_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await wait(delayMs);
      }

      try {
        StellarWalletsKit.setWallet(walletId);
        const selectedModule = this.getSelectedModule();

        if (selectedModule && (await selectedModule.isAvailable())) {
          return selectedModule;
        }
      } catch {
        // Wallet init can race with browser extension injection on refresh.
      }
    }

    return null;
  }

  private async clearStaleWalletConnectState(): Promise<void> {
    clearWalletConnectStorage();
    walletPersistenceService.clearWalletSelection();

    try {
      await StellarWalletsKit.disconnect();
    } catch {
      // Ignore disconnect failures while clearing broken WalletConnect state.
    }
  }

  private async resolveActiveWallet(addressInput?: string): Promise<TWalletAccount> {
    ensureKitInitialized({ includeWalletConnect: walletKitIncludesWalletConnect });

    const addressResponse = addressInput
      ? { address: addressInput }
      : await StellarWalletsKit.getAddress();
    const address = TStellarPublicKeySchema.parse(addressResponse.address);
    const networkResponse = await StellarWalletsKit.getNetwork().catch(() => ({
      network: WALLET_NETWORK_LABEL,
      networkPassphrase: WALLET_NETWORK_PASSPHRASE,
    }));
    return this.buildWalletAccount(
      address,
      this.getSelectedModule(),
      networkResponse.networkPassphrase || networkResponse.network,
    );
  }

  public async connect(): Promise<TWalletAccount> {
    ensureKitInitialized({ includeWalletConnect: true });

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
    ensureKitInitialized({ includeWalletConnect: walletKitIncludesWalletConnect });
    const { address } = await StellarWalletsKit.getAddress();
    return TStellarPublicKeySchema.parse(address);
  }

  public async getNetwork(): Promise<{ network: string | null; isTestnet: boolean }> {
    ensureKitInitialized({ includeWalletConnect: walletKitIncludesWalletConnect });
    const networkResponse = await StellarWalletsKit.getNetwork().catch(() => ({
      network: WALLET_NETWORK_LABEL,
      networkPassphrase: WALLET_NETWORK_PASSPHRASE,
    }));
    return normalizeWalletNetwork(networkResponse.networkPassphrase || networkResponse.network);
  }

  public async restoreConnection(): Promise<TWalletAccount | null> {
    const storedWalletSelection = walletPersistenceService.getWalletSelection();

    if (!storedWalletSelection) {
      return null;
    }

    const storedAddressResult = TStellarPublicKeySchema.safeParse(storedWalletSelection.address);

    if (!storedAddressResult.success) {
      return null;
    }

    if (isWalletConnectModule(storedWalletSelection.walletId)) {
      try {
        const selectedModule = await this.selectAvailableWalletModule(
          storedWalletSelection.walletId,
          { includeWalletConnect: true },
        );

        if (!selectedModule) {
          return null;
        }

        return this.buildWalletAccount(
          storedAddressResult.data,
          selectedModule,
          WALLET_NETWORK_LABEL,
        );
      } catch (error) {
        if (isStaleWalletConnectSessionError(error)) {
          await this.clearStaleWalletConnectState();
        }

        return null;
      }
    }

    try {
      const selectedModule = await this.selectAvailableWalletModule(
        storedWalletSelection.walletId,
        {
          includeWalletConnect: false,
        },
      );

      if (!selectedModule) {
        return null;
      }

      return await this.resolveActiveWallet(storedAddressResult.data);
    } catch {
      return null;
    }
  }

  public async disconnect(): Promise<void> {
    ensureKitInitialized({ includeWalletConnect: walletKitIncludesWalletConnect });
    await StellarWalletsKit.disconnect();
    walletPersistenceService.clearWalletSelection();
  }

  public async signMessage(message: string): Promise<string> {
    const sanitizedMessage = TMessageSchema.parse(message);
    ensureKitInitialized({ includeWalletConnect: walletKitIncludesWalletConnect });
    const messageResult = await StellarWalletsKit.signMessage(sanitizedMessage, {
      networkPassphrase: WALLET_NETWORK_PASSPHRASE,
    });
    return messageResult.signedMessage;
  }

  public async signTransaction(xdr: string, address?: string): Promise<string> {
    const sanitizedXdr = TTransactionXdrSchema.parse(xdr);
    const sanitizedAddress = address ? TStellarPublicKeySchema.parse(address) : undefined;
    ensureKitInitialized({ includeWalletConnect: walletKitIncludesWalletConnect });
    const transactionResult = await StellarWalletsKit.signTransaction(sanitizedXdr, {
      address: sanitizedAddress,
      networkPassphrase: WALLET_NETWORK_PASSPHRASE,
    });
    return transactionResult.signedTxXdr;
  }
}
