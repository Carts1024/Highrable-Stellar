"use client";

import { StellarAuthService } from "@/core/wallet/auth/stellar-auth-service";
import { StellarWalletKitClient } from "@/core/wallet/clients/stellar-wallet-kit-client";
import { WALLET_NETWORK } from "@/core/wallet/config";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type {
  IWalletAuthService,
  IWalletClient,
  TAuthSession,
  TWalletAccount,
  TWalletState,
} from "@/core/wallet/types";

type TWalletContextValue = {
  walletState: TWalletState;
  authSession: TAuthSession | null;
  isConnected: boolean;
  address: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  authenticateWallet: () => Promise<void>;
  logoutWallet: () => void;
};

const DEFAULT_STATE: TWalletState = {
  status: "idle",
  network: WALLET_NETWORK,
  account: null,
  error: null,
};

const WalletContext = createContext<TWalletContextValue | null>(null);

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unexpected wallet error";
}

export function WalletContextProvider({
  children,
  walletClient,
  walletAuthService,
}: {
  children: React.ReactNode;
  walletClient?: IWalletClient;
  walletAuthService?: IWalletAuthService;
}) {
  const [walletState, setWalletState] = useState<TWalletState>(DEFAULT_STATE);
  const [authSession, setAuthSession] = useState<TAuthSession | null>(null);
  const [wallet] = useState<IWalletClient>(() => walletClient ?? new StellarWalletKitClient());
  const [auth] = useState<IWalletAuthService>(() => walletAuthService ?? new StellarAuthService());

  const connectWallet = useCallback(async () => {
    setWalletState((currentValue) => ({ ...currentValue, status: "connecting", error: null }));

    try {
      const account: TWalletAccount = await wallet.connect();
      setWalletState({
        status: "connected",
        network: WALLET_NETWORK,
        account,
        error: null,
      });
    } catch (error) {
      setWalletState((currentValue) => ({
        ...currentValue,
        status: "error",
        error: { code: "CONNECT_FAILED", message: toErrorMessage(error) },
      }));
    }
  }, [wallet]);

  const disconnectWallet = useCallback(async () => {
    setWalletState((currentValue) => ({ ...currentValue, status: "disconnecting" }));

    try {
      await wallet.disconnect();
      setWalletState({ ...DEFAULT_STATE });
      setAuthSession(null);
    } catch (error) {
      setWalletState((currentValue) => ({
        ...currentValue,
        status: "error",
        error: { code: "DISCONNECT_FAILED", message: toErrorMessage(error) },
      }));
    }
  }, [wallet]);

  const authenticateWallet = useCallback(async () => {
    const address = walletState.account?.address;
    if (!address) {
      setWalletState((currentValue) => ({
        ...currentValue,
        error: { code: "AUTH_FAILED", message: "Connect wallet before authentication." },
      }));
      return;
    }

    try {
      const challenge = await auth.createChallenge(address);
      const signature = await wallet.signMessage(challenge.message);
      const session = await auth.verifySignature({
        address,
        signature,
        message: challenge.message,
        nonce: challenge.nonce,
      });

      setAuthSession(session);
      setWalletState((currentValue) => ({ ...currentValue, error: null }));
    } catch (error) {
      setWalletState((currentValue) => ({
        ...currentValue,
        error: { code: "AUTH_FAILED", message: toErrorMessage(error) },
      }));
    }
  }, [auth, wallet, walletState.account?.address]);

  const logoutWallet = useCallback(() => {
    setAuthSession(null);
  }, []);

  const contextValue = useMemo<TWalletContextValue>(
    () => ({
      walletState,
      authSession,
      isConnected: walletState.account !== null,
      address: walletState.account?.address ?? null,
      connectWallet,
      disconnectWallet,
      authenticateWallet,
      logoutWallet,
    }),
    [walletState, authSession, connectWallet, disconnectWallet, authenticateWallet, logoutWallet],
  );

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): TWalletContextValue {
  const contextValue = useContext(WalletContext);
  if (!contextValue) {
    throw new Error("useWalletContext must be used within WalletContextProvider");
  }

  return contextValue;
}
