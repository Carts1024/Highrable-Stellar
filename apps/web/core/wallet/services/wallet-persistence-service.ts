import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { LocalStorageKeys } from "@creit-tech/stellar-wallets-kit/types";
import { z } from "zod";

import type { TWalletAccount } from "@/core/wallet/types";

const TWalletModuleIdSchema = z.string().trim().min(1).max(256);

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

function readStorageValue(storage: Storage, key: LocalStorageKeys): string | null {
  try {
    const value = storage.getItem(key)?.trim();
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStorageValue(storage: Storage, key: LocalStorageKeys, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Browser privacy settings can deny storage access. Wallet restore remains optional.
  }
}

function removeStorageValue(storage: Storage, key: LocalStorageKeys): void {
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

    const address = readStorageValue(storage, LocalStorageKeys.activeAddress);
    const walletId = readStorageValue(storage, LocalStorageKeys.selectedModuleId);

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

    writeStorageValue(storage, LocalStorageKeys.activeAddress, parsedSelection.data.address);
    writeStorageValue(storage, LocalStorageKeys.selectedModuleId, parsedSelection.data.walletId);
  }

  public clearWalletSelection(): void {
    const storage = getBrowserStorage();

    if (!storage) {
      return;
    }

    removeStorageValue(storage, LocalStorageKeys.activeAddress);
    removeStorageValue(storage, LocalStorageKeys.selectedModuleId);
  }
}
