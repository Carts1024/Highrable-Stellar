"use client";

import { StellarAuthService } from "@/core/wallet/auth/stellar-auth-service";
import { StellarWalletKitClient } from "@/core/wallet/clients/stellar-wallet-kit-client";
import { STELLAR_TESTNET_NETWORK_LABEL } from "@/core/wallet/config";
import { HorizonAccountService } from "@/core/wallet/services/horizon-account-service";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type {
  IWalletAuthService,
  IWalletClient,
  IWalletFundingService,
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
  checkFundingStatus: (address?: string) => Promise<boolean | null>;
  refreshWalletState: () => Promise<void>;
  clearWalletError: () => void;
  getPublicKey: () => Promise<string | null>;
  signTransaction: (xdr: string) => Promise<string>;
  authenticateWallet: () => Promise<void>;
  logoutWallet: () => void;
};

const DEFAULT_STATE: TWalletState = {
  status: "idle",
  walletAddress: null,
  network: STELLAR_TESTNET_NETWORK_LABEL,
  isConnected: false,
  isTestnet: true,
  isFunded: null,
  selectedWallet: null,
  isConnecting: false,
  isCheckingFunding: false,
  error: null,
  lastTxStatus: "idle",
  account: null,
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
  walletFundingService,
}: {
  children: React.ReactNode;
  walletClient?: IWalletClient;
  walletAuthService?: IWalletAuthService;
  walletFundingService?: IWalletFundingService;
}) {
  const [walletState, setWalletState] = useState<TWalletState>(DEFAULT_STATE);
  const [authSession, setAuthSession] = useState<TAuthSession | null>(null);
  const [wallet] = useState<IWalletClient>(() => walletClient ?? new StellarWalletKitClient());
  const [auth] = useState<IWalletAuthService>(() => walletAuthService ?? new StellarAuthService());
  const [fundingService] = useState<IWalletFundingService>(
    () => walletFundingService ?? new HorizonAccountService(),
  );

  const setConnectedWalletState = useCallback(
    (account: TWalletAccount, overrides?: Partial<TWalletState>) => {
      setWalletState((currentValue) => ({
        ...currentValue,
        status: "connected",
        walletAddress: account.address,
        network: account.network ?? STELLAR_TESTNET_NETWORK_LABEL,
        isConnected: true,
        isTestnet: account.isTestnet,
        isFunded: account.isTestnet ? (overrides?.isFunded ?? currentValue.isFunded) : null,
        selectedWallet: account.walletName ?? account.walletId,
        isConnecting: false,
        isCheckingFunding: overrides?.isCheckingFunding ?? false,
        error: overrides?.error ?? null,
        lastTxStatus: overrides?.lastTxStatus ?? currentValue.lastTxStatus,
        account,
      }));
    },
    [],
  );

  const clearWalletError = useCallback(() => {
    setWalletState((currentValue) => ({ ...currentValue, error: null }));
  }, []);

  const checkFundingStatus = useCallback(
    async (address?: string): Promise<boolean | null> => {
      const candidateAddress = address ?? walletState.walletAddress;

      if (!candidateAddress) {
        setWalletState((currentValue) => ({
          ...currentValue,
          error: "Connect a wallet before checking funding status.",
        }));
        return null;
      }

      const normalizedCandidateAddress = candidateAddress.trim();

      try {
        const sanitizedAddress = TStellarPublicKeySchema.parse(normalizedCandidateAddress);
        setWalletState((currentValue) => ({
          ...currentValue,
          isCheckingFunding: true,
          error: null,
        }));

        const fundingStatus = await fundingService.getFundingStatus(sanitizedAddress);
        setWalletState((currentValue) =>
          currentValue.walletAddress === sanitizedAddress
            ? {
                ...currentValue,
                isFunded: fundingStatus.isFunded,
                isCheckingFunding: false,
                error: null,
              }
            : currentValue,
        );
        return fundingStatus.isFunded;
      } catch (error) {
        setWalletState((currentValue) =>
          currentValue.walletAddress === normalizedCandidateAddress
            ? {
                ...currentValue,
                isCheckingFunding: false,
                error: toErrorMessage(error),
              }
            : currentValue,
        );
        return null;
      }
    },
    [fundingService, walletState.walletAddress],
  );

  const connectWallet = useCallback(async () => {
    setWalletState((currentValue) => ({
      ...currentValue,
      status: "connecting",
      isConnecting: true,
      error: null,
    }));

    try {
      const account: TWalletAccount = await wallet.connect();
      setConnectedWalletState(account, {
        isCheckingFunding: account.isTestnet,
        isFunded: null,
        lastTxStatus: "idle",
      });

      if (account.isTestnet) {
        await checkFundingStatus(account.address);
      } else {
        setWalletState((currentValue) => ({
          ...currentValue,
          isCheckingFunding: false,
          isFunded: null,
        }));
      }
    } catch (error) {
      setWalletState({
        ...DEFAULT_STATE,
        status: "error",
        error: toErrorMessage(error),
      });
    }
  }, [checkFundingStatus, setConnectedWalletState, wallet]);

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
        error: toErrorMessage(error),
      }));
    }
  }, [wallet]);

  const refreshWalletState = useCallback(async () => {
    if (!walletState.walletAddress) {
      return;
    }

    try {
      const activeWallet = await wallet.getActiveWallet();
      setConnectedWalletState(activeWallet, {
        isCheckingFunding: activeWallet.isTestnet,
      });

      if (activeWallet.isTestnet) {
        await checkFundingStatus(activeWallet.address);
      } else {
        setWalletState((currentValue) => ({
          ...currentValue,
          isCheckingFunding: false,
          isFunded: null,
        }));
      }
    } catch (error) {
      setWalletState((currentValue) => ({
        ...currentValue,
        status: "error",
        error: toErrorMessage(error),
      }));
    }
  }, [checkFundingStatus, setConnectedWalletState, wallet, walletState.walletAddress]);

  const getPublicKey = useCallback(async () => {
    if (walletState.walletAddress) {
      return walletState.walletAddress;
    }

    try {
      return await wallet.getPublicKey();
    } catch {
      return null;
    }
  }, [wallet, walletState.walletAddress]);

  const signTransaction = useCallback(
    async (xdr: string) => {
      const address = walletState.walletAddress;

      if (!address) {
        throw new Error("Connect a wallet before signing a transaction.");
      }

      setWalletState((currentValue) => ({
        ...currentValue,
        lastTxStatus: "pending",
        error: null,
      }));

      try {
        const signedXdr = await wallet.signTransaction(xdr, address);
        setWalletState((currentValue) => ({
          ...currentValue,
          lastTxStatus: "success",
        }));
        return signedXdr;
      } catch (error) {
        setWalletState((currentValue) => ({
          ...currentValue,
          lastTxStatus: "failed",
          error: toErrorMessage(error),
        }));
        throw error;
      }
    },
    [wallet, walletState.walletAddress],
  );

  const authenticateWallet = useCallback(async () => {
    const address = walletState.walletAddress;
    if (!address) {
      setWalletState((currentValue) => ({
        ...currentValue,
        error: "Connect wallet before authentication.",
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
        error: toErrorMessage(error),
      }));
    }
  }, [auth, wallet, walletState.walletAddress]);

  const logoutWallet = useCallback(() => {
    setAuthSession(null);
  }, []);

  const contextValue = useMemo<TWalletContextValue>(
    () => ({
      walletState,
      authSession,
      isConnected: walletState.isConnected,
      address: walletState.walletAddress,
      connectWallet,
      disconnectWallet,
      checkFundingStatus,
      refreshWalletState,
      clearWalletError,
      getPublicKey,
      signTransaction,
      authenticateWallet,
      logoutWallet,
    }),
    [
      walletState,
      authSession,
      connectWallet,
      disconnectWallet,
      checkFundingStatus,
      refreshWalletState,
      clearWalletError,
      getPublicKey,
      signTransaction,
      authenticateWallet,
      logoutWallet,
    ],
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
