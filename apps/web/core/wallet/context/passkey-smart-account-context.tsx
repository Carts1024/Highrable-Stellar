"use client";

import {
  createPasskeySmartAccount,
  disconnectPasskeySmartAccount,
  isSmartAccountConfigError,
  reconnectPasskeySmartAccount,
  refreshPasskeySmartAccountSession,
} from "@/core/stellar/smart-account-kit";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { TPasskeySmartAccountSession } from "@/core/stellar/smart-account-kit";

export type THighrableWalletType = "external_wallet" | "passkey_smart_account";

export type TPasskeySmartAccountMode = THighrableWalletType | null;

export type TPasskeySmartAccountState = {
  smartAccountAddress: string | null;
  credentialId: string | null;
  isPasskeyConnected: boolean;
  isCreating: boolean;
  isReconnecting: boolean;
  error: string | null;
  mode: TPasskeySmartAccountMode;
};

type TPasskeySmartAccountContextValue = TPasskeySmartAccountState & {
  createPasskeyAccount: () => Promise<TPasskeySmartAccountSession | null>;
  reconnectPasskeyAccount: () => Promise<TPasskeySmartAccountSession | null>;
  disconnectPasskeyAccount: () => Promise<void>;
  refreshPasskeySession: () => Promise<TPasskeySmartAccountSession | null>;
  clearPasskeyError: () => void;
};

const DEFAULT_PASSKEY_STATE: TPasskeySmartAccountState = {
  smartAccountAddress: null,
  credentialId: null,
  isPasskeyConnected: false,
  isCreating: false,
  isReconnecting: false,
  error: null,
  mode: null,
};

const PasskeySmartAccountContext = createContext<TPasskeySmartAccountContextValue | null>(null);

function toPasskeyErrorMessage(error: unknown): string {
  if (isSmartAccountConfigError(error)) {
    if (process.env.NODE_ENV === "development" && error.missingKeys.length > 0) {
      return `Passkey smart account config is missing. Add: ${error.missingKeys.join(", ")}.`;
    }

    return "Passkey smart account config is missing. Add the required smart account env variables.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return "Passkey smart account request failed. Please try again.";
}

function toConnectedState(
  session: TPasskeySmartAccountSession,
): Pick<
  TPasskeySmartAccountState,
  "smartAccountAddress" | "credentialId" | "isPasskeyConnected" | "mode" | "error"
> {
  return {
    smartAccountAddress: session.smartAccountAddress,
    credentialId: session.credentialId,
    isPasskeyConnected: true,
    mode: "passkey_smart_account",
    error: null,
  };
}

export function PasskeySmartAccountProvider({ children }: { children: React.ReactNode }) {
  const { disconnectWallet, isConnected: isExternalWalletConnected } = useWallet();
  const [state, setState] = useState<TPasskeySmartAccountState>(DEFAULT_PASSKEY_STATE);
  const hasAttemptedSessionRestoreRef = useRef(false);

  const clearPasskeyError = useCallback(() => {
    setState((currentValue) => ({ ...currentValue, error: null }));
  }, []);

  const createPasskeyAccount = useCallback(async () => {
    if (state.isCreating || state.isReconnecting) {
      return null;
    }

    setState((currentValue) => ({
      ...currentValue,
      isCreating: true,
      error: null,
    }));

    try {
      if (isExternalWalletConnected) {
        await disconnectWallet();
      }

      const session = await createPasskeySmartAccount();
      setState((currentValue) => ({
        ...currentValue,
        ...toConnectedState(session),
        isCreating: false,
      }));
      return session;
    } catch (error) {
      setState((currentValue) => ({
        ...currentValue,
        isCreating: false,
        error: toPasskeyErrorMessage(error),
      }));
      return null;
    }
  }, [disconnectWallet, isExternalWalletConnected, state.isCreating, state.isReconnecting]);

  const reconnectPasskeyAccount = useCallback(async () => {
    if (state.isCreating || state.isReconnecting) {
      return null;
    }

    setState((currentValue) => ({
      ...currentValue,
      isReconnecting: true,
      error: null,
    }));

    try {
      if (isExternalWalletConnected) {
        await disconnectWallet();
      }

      const session = await reconnectPasskeySmartAccount();
      setState((currentValue) => ({
        ...currentValue,
        ...toConnectedState(session),
        isReconnecting: false,
      }));
      return session;
    } catch (error) {
      setState((currentValue) => ({
        ...currentValue,
        isReconnecting: false,
        error: toPasskeyErrorMessage(error),
      }));
      return null;
    }
  }, [disconnectWallet, isExternalWalletConnected, state.isCreating, state.isReconnecting]);

  const disconnectPasskeyAccount = useCallback(async () => {
    setState((currentValue) => ({
      ...currentValue,
      isCreating: false,
      isReconnecting: false,
      error: null,
    }));

    try {
      await disconnectPasskeySmartAccount();
    } finally {
      setState({ ...DEFAULT_PASSKEY_STATE });
    }
  }, []);

  const refreshPasskeySession = useCallback(async () => {
    if (state.isCreating || state.isReconnecting) {
      return null;
    }

    setState((currentValue) => ({ ...currentValue, isReconnecting: true, error: null }));

    try {
      const session = await refreshPasskeySmartAccountSession();
      setState((currentValue) => ({
        ...currentValue,
        ...(session ? toConnectedState(session) : DEFAULT_PASSKEY_STATE),
        isReconnecting: false,
      }));
      return session;
    } catch (error) {
      setState((currentValue) => ({
        ...currentValue,
        isReconnecting: false,
        error: toPasskeyErrorMessage(error),
      }));
      return null;
    }
  }, [state.isCreating, state.isReconnecting]);

  useEffect(() => {
    if (hasAttemptedSessionRestoreRef.current) {
      return;
    }

    hasAttemptedSessionRestoreRef.current = true;
    let isMounted = true;

    const restorePasskeySession = async () => {
      try {
        const session = await refreshPasskeySmartAccountSession();
        if (!isMounted || !session) {
          return;
        }

        setState((currentValue) => ({
          ...currentValue,
          ...toConnectedState(session),
        }));
      } catch {
        // Missing config or no stored session should not block the app.
      }
    };

    void restorePasskeySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const contextValue = useMemo<TPasskeySmartAccountContextValue>(
    () => ({
      ...state,
      createPasskeyAccount,
      reconnectPasskeyAccount,
      disconnectPasskeyAccount,
      refreshPasskeySession,
      clearPasskeyError,
    }),
    [
      state,
      createPasskeyAccount,
      reconnectPasskeyAccount,
      disconnectPasskeyAccount,
      refreshPasskeySession,
      clearPasskeyError,
    ],
  );

  return (
    <PasskeySmartAccountContext.Provider value={contextValue}>
      {children}
    </PasskeySmartAccountContext.Provider>
  );
}

export function usePasskeySmartAccountContext(): TPasskeySmartAccountContextValue {
  const contextValue = useContext(PasskeySmartAccountContext);
  if (!contextValue) {
    throw new Error("usePasskeySmartAccount must be used within PasskeySmartAccountProvider");
  }

  return contextValue;
}
