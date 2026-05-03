"use client";

import { StellarAuthService } from "@/core/wallet/auth/stellar-auth-service";
import { StellarWalletKitClient } from "@/core/wallet/clients/stellar-wallet-kit-client";
import { STELLAR_TESTNET_NETWORK_LABEL } from "@/core/wallet/config";
import { FriendbotService } from "@/core/wallet/services/friendbot-service";
import { HorizonAccountService } from "@/core/wallet/services/horizon-account-service";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  IWalletAuthService,
  IWalletClient,
  IWalletFriendbotService,
  IWalletFundingService,
  TAuthSession,
  TWalletAccount,
  TWalletState,
} from "@/core/wallet/types";

const FRIEND_BOT_FUNDING_RETRY_DELAYS_MS = [1000, 2000, 3000] as const;

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

type TWalletContextValue = {
  walletState: TWalletState;
  authSession: TAuthSession | null;
  isConnected: boolean;
  address: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  checkFundingStatus: (address?: string) => Promise<boolean | null>;
  fundTestnetAccount: () => Promise<void>;
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
  isFundingWithFriendbot: false,
  friendbotError: null,
  friendbotSuccess: false,
  lastFriendbotResponse: null,
  error: null,
  lastTxStatus: "idle",
  account: null,
};

const WalletContext = createContext<TWalletContextValue | null>(null);

function toErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const objectWithMessage = error as {
      message?: unknown;
      error?: {
        message?: unknown;
      };
      code?: unknown;
    };

    if (
      typeof objectWithMessage.message === "string" &&
      objectWithMessage.message.trim().length > 0
    ) {
      return objectWithMessage.message.trim();
    }

    if (
      typeof objectWithMessage.error?.message === "string" &&
      objectWithMessage.error.message.trim().length > 0
    ) {
      return objectWithMessage.error.message.trim();
    }

    if (typeof objectWithMessage.code === "number" || typeof objectWithMessage.code === "string") {
      return `Wallet request failed (${String(objectWithMessage.code)}).`;
    }
  }

  return "Wallet request failed. Please try again.";
}

export function WalletContextProvider({
  children,
  walletClient,
  walletAuthService,
  walletFriendbotService,
  walletFundingService,
}: {
  children: React.ReactNode;
  walletClient?: IWalletClient;
  walletAuthService?: IWalletAuthService;
  walletFriendbotService?: IWalletFriendbotService;
  walletFundingService?: IWalletFundingService;
}) {
  const [walletState, setWalletState] = useState<TWalletState>(DEFAULT_STATE);
  const [authSession, setAuthSession] = useState<TAuthSession | null>(null);
  const hasAttemptedWalletRestoreRef = useRef(false);
  const activeWalletAddressRef = useRef<string | null>(DEFAULT_STATE.walletAddress);
  const [wallet] = useState<IWalletClient>(() => walletClient ?? new StellarWalletKitClient());
  const [auth] = useState<IWalletAuthService>(() => walletAuthService ?? new StellarAuthService());
  const [friendbot] = useState<IWalletFriendbotService>(
    () => walletFriendbotService ?? new FriendbotService(),
  );
  const [fundingService] = useState<IWalletFundingService>(
    () => walletFundingService ?? new HorizonAccountService(),
  );

  useEffect(() => {
    activeWalletAddressRef.current = walletState.walletAddress;
  }, [walletState.walletAddress]);

  const setConnectedWalletState = useCallback(
    (account: TWalletAccount, overrides?: Partial<TWalletState>) => {
      setWalletState((currentValue) => {
        const shouldPreserveTransientState = currentValue.walletAddress === account.address;

        return {
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
          isFundingWithFriendbot:
            overrides?.isFundingWithFriendbot ??
            (shouldPreserveTransientState ? currentValue.isFundingWithFriendbot : false),
          friendbotError:
            overrides?.friendbotError ??
            (shouldPreserveTransientState ? currentValue.friendbotError : null),
          friendbotSuccess:
            overrides?.friendbotSuccess ??
            (shouldPreserveTransientState ? currentValue.friendbotSuccess : false),
          lastFriendbotResponse:
            overrides?.lastFriendbotResponse ??
            (shouldPreserveTransientState ? currentValue.lastFriendbotResponse : null),
          error: overrides?.error ?? null,
          lastTxStatus: overrides?.lastTxStatus ?? currentValue.lastTxStatus,
          account,
        };
      });
    },
    [],
  );

  const clearWalletError = useCallback(() => {
    setWalletState((currentValue) => ({
      ...currentValue,
      error: null,
      friendbotError: null,
    }));
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

  const refreshFundingStatusWithRetry = useCallback(
    async (address: string): Promise<boolean> => {
      for (const delayMs of FRIEND_BOT_FUNDING_RETRY_DELAYS_MS) {
        if (activeWalletAddressRef.current !== address) {
          return false;
        }

        await wait(delayMs);

        if (activeWalletAddressRef.current !== address) {
          return false;
        }

        const isFunded = await checkFundingStatus(address);

        if (isFunded) {
          return true;
        }
      }

      return false;
    },
    [checkFundingStatus],
  );

  const fundTestnetAccount = useCallback(async () => {
    const candidateAddress = walletState.walletAddress;

    if (walletState.isFundingWithFriendbot) {
      return;
    }

    if (!candidateAddress) {
      setWalletState((currentValue) => ({
        ...currentValue,
        friendbotError: "Connect a wallet before funding a testnet account.",
        friendbotSuccess: false,
      }));
      return;
    }

    if (!walletState.isTestnet) {
      setWalletState((currentValue) => ({
        ...currentValue,
        friendbotError: "Friendbot is only available on Stellar Testnet.",
        friendbotSuccess: false,
      }));
      return;
    }

    if (walletState.isFunded) {
      setWalletState((currentValue) => ({
        ...currentValue,
        friendbotError: null,
        friendbotSuccess: true,
      }));
      return;
    }

    try {
      const sanitizedAddress = TStellarPublicKeySchema.parse(candidateAddress);

      setWalletState((currentValue) =>
        currentValue.walletAddress === sanitizedAddress
          ? {
              ...currentValue,
              isFundingWithFriendbot: true,
              friendbotError: null,
              friendbotSuccess: false,
              lastFriendbotResponse: null,
              error: null,
            }
          : currentValue,
      );

      const friendbotResponse = await friendbot.fundAccount(sanitizedAddress);

      if (activeWalletAddressRef.current !== sanitizedAddress) {
        return;
      }

      setWalletState((currentValue) =>
        currentValue.walletAddress === sanitizedAddress
          ? {
              ...currentValue,
              lastFriendbotResponse: friendbotResponse,
            }
          : currentValue,
      );

      const isFunded = await refreshFundingStatusWithRetry(sanitizedAddress);

      if (activeWalletAddressRef.current !== sanitizedAddress) {
        return;
      }

      if (!isFunded) {
        throw new Error(
          "Friendbot succeeded, but Horizon has not confirmed the funding yet. Please try again in a moment.",
        );
      }

      setWalletState((currentValue) =>
        currentValue.walletAddress === sanitizedAddress
          ? {
              ...currentValue,
              isFunded: true,
              friendbotError: null,
              friendbotSuccess: true,
              error: null,
            }
          : currentValue,
      );
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      setWalletState((currentValue) =>
        currentValue.walletAddress === candidateAddress
          ? {
              ...currentValue,
              friendbotError: errorMessage,
              friendbotSuccess: false,
              error: null,
            }
          : currentValue,
      );
    } finally {
      setWalletState((currentValue) =>
        currentValue.walletAddress === candidateAddress
          ? {
              ...currentValue,
              isFundingWithFriendbot: false,
            }
          : currentValue,
      );
    }
  }, [
    friendbot,
    refreshFundingStatusWithRetry,
    walletState.isFunded,
    walletState.isFundingWithFriendbot,
    walletState.isTestnet,
    walletState.walletAddress,
  ]);

  const connectWallet = useCallback(async () => {
    setWalletState((currentValue) => ({
      ...currentValue,
      status: "connecting",
      isConnecting: true,
      friendbotError: null,
      friendbotSuccess: false,
      error: null,
    }));

    try {
      const account: TWalletAccount = await wallet.connect();
      setConnectedWalletState(account, {
        isCheckingFunding: account.isTestnet,
        isFundingWithFriendbot: false,
        isFunded: null,
        friendbotError: null,
        friendbotSuccess: false,
        lastFriendbotResponse: null,
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

  useEffect(() => {
    if (hasAttemptedWalletRestoreRef.current) {
      return;
    }

    hasAttemptedWalletRestoreRef.current = true;
    let isMounted = true;

    const restoreWalletConnection = async () => {
      try {
        const restoredWallet = await wallet.restoreConnection();

        if (!isMounted || !restoredWallet) {
          return;
        }

        setConnectedWalletState(restoredWallet, {
          isCheckingFunding: restoredWallet.isTestnet,
          isFundingWithFriendbot: false,
          isFunded: null,
          friendbotError: null,
          friendbotSuccess: false,
          lastFriendbotResponse: null,
        });

        if (restoredWallet.isTestnet) {
          await checkFundingStatus(restoredWallet.address);
        }
      } catch {
        // Ignore restore failures and let the user reconnect manually.
      }
    };

    void restoreWalletConnection();

    return () => {
      isMounted = false;
    };
  }, [checkFundingStatus, setConnectedWalletState, wallet]);

  const contextValue = useMemo<TWalletContextValue>(
    () => ({
      walletState,
      authSession,
      isConnected: walletState.isConnected,
      address: walletState.walletAddress,
      connectWallet,
      disconnectWallet,
      checkFundingStatus,
      fundTestnetAccount,
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
      fundTestnetAccount,
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
