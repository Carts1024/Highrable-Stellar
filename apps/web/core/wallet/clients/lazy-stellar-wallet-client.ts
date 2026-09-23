"use client";

import { WalletPersistenceService } from "@/core/wallet/services/wallet-persistence-service";

import type { IWalletClient, TWalletAccount } from "@/core/wallet/types";

type TStellarWalletKitClientConstructor = new () => IWalletClient;

const walletPersistenceService = new WalletPersistenceService();

let walletClientPromise: Promise<IWalletClient> | null = null;

async function loadStellarWalletKitClient(): Promise<IWalletClient> {
  walletClientPromise ??= import("@/core/wallet/clients/stellar-wallet-kit-client").then(
    ({ StellarWalletKitClient }: { StellarWalletKitClient: TStellarWalletKitClientConstructor }) =>
      new StellarWalletKitClient(),
  );

  return walletClientPromise;
}

export class LazyStellarWalletClient implements IWalletClient {
  private async getWalletClient(): Promise<IWalletClient> {
    return await loadStellarWalletKitClient();
  }

  public async connect(): Promise<TWalletAccount> {
    return await (await this.getWalletClient()).connect();
  }

  public async getActiveWallet(): Promise<TWalletAccount> {
    return await (await this.getWalletClient()).getActiveWallet();
  }

  public async getPublicKey(): Promise<string> {
    return await (await this.getWalletClient()).getPublicKey();
  }

  public async getNetwork(): Promise<{ network: string | null; isTestnet: boolean }> {
    return await (await this.getWalletClient()).getNetwork();
  }

  public async restoreConnection(): Promise<TWalletAccount | null> {
    if (!walletPersistenceService.getWalletSelection()) {
      return null;
    }

    return await (await this.getWalletClient()).restoreConnection();
  }

  public async disconnect(): Promise<void> {
    if (!walletPersistenceService.getWalletSelection()) {
      return;
    }

    await (await this.getWalletClient()).disconnect();
  }

  public async signMessage(message: string): Promise<string> {
    return await (await this.getWalletClient()).signMessage(message);
  }

  public async signTransaction(xdr: string, address?: string): Promise<string> {
    return await (await this.getWalletClient()).signTransaction(xdr, address);
  }
}
