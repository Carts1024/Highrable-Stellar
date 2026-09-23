import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { z } from "zod";

import type { TWalletAccount } from "@/core/wallet/types";

const TWalletModuleIdSchema = z.string().trim().min(1).max(256);
const WALLET_STORAGE_KEYS = {
  activeAddress: "@StellarWalletsKit/activeAddress",
  selectedModuleId: "@StellarWalletsKit/selectedModuleId",
} as const;

type TWalletStorageKey = (typeof WALLET_STORAGE_KEYS)[keyof typeof WALLET_STORAGE_KEYS];

export type TStoredWalletSelection = {
  address: string;
  walletId: string;
};

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStorageValue(storage: Storage, key: TWalletStorageKey): string | null {
  try {
    const value = storage.getItem(key)?.trim();
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStorageValue(storage: Storage, key: TWalletStorageKey, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Browser privacy settings can deny storage access. Wallet restore remains optional.
  }
}

function removeStorageValue(storage: Storage, key: TWalletStorageKey): void {
  try {
    storage.removeItem(key);
  } catch {
    // Browser privacy settings can deny storage access. Wallet restore remains optional.
  }
}

export class WalletPersistenceService {
  public getWalletSelection(): TStoredWalletSelection | null {
    const storage = getBrowserStorage();

    if (!storage) {
      return null;
    }

    const address = readStorageValue(storage, WALLET_STORAGE_KEYS.activeAddress);
    const walletId = readStorageValue(storage, WALLET_STORAGE_KEYS.selectedModuleId);

    const parsedSelection = z
      .object({
        address: TStellarPublicKeySchema,
        walletId: TWalletModuleIdSchema,
      })
      .safeParse({
        address,
        walletId,
      });

    if (!parsedSelection.success) {
      this.clearWalletSelection();
      return null;
    }

    return parsedSelection.data;
  }

  public saveWalletSelection(account: Pick<TWalletAccount, "address" | "walletId">): void {
    const storage = getBrowserStorage();

    if (!storage || !account.walletId) {
      return;
    }

    const parsedSelection = z
      .object({
        address: TStellarPublicKeySchema,
        walletId: TWalletModuleIdSchema,
      })
      .safeParse({
        address: account.address,
        walletId: account.walletId,
      });

    if (!parsedSelection.success) {
      return;
    }

    writeStorageValue(storage, WALLET_STORAGE_KEYS.activeAddress, parsedSelection.data.address);
    writeStorageValue(storage, WALLET_STORAGE_KEYS.selectedModuleId, parsedSelection.data.walletId);
  }

  public clearWalletSelection(): void {
    const storage = getBrowserStorage();

    if (!storage) {
      return;
    }

    removeStorageValue(storage, WALLET_STORAGE_KEYS.activeAddress);
    removeStorageValue(storage, WALLET_STORAGE_KEYS.selectedModuleId);
  }
}
