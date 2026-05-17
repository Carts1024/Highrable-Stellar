"use client";

import { isWebAuthnSupported } from "@/core/passkeys/webauthn-support";
import {
  hasSmartAccountConfig,
  PasskeyConfigError,
  SMART_ACCOUNT_CONFIG_MISSING_MESSAGE,
} from "@/core/stellar/smart-account-config";
import {
  clearSmartAccountLocalSession,
  getSmartAccountKit,
} from "@/core/stellar/smart-account-kit";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type THighrableWalletType = "external_wallet" | "passkey_smart_account";
export type TActiveWalletMode = THighrableWalletType;

export type TPasskeySmartAccountState = {
  smartAccountAddress: string | null;
  credentialId: string | null;
  sessionStatus: "none" | "restored" | "created" | "reconnected";
  isPasskeyConnected: boolean;
  isCreating: boolean;
  isReconnecting: boolean;
  isRestoring: boolean;
  error: string | null;
  walletType: "passkey_smart_account";
};

type TPasskeySmartAccountContextValue = TPasskeySmartAccountState & {
  isSupported: boolean;
  hasConfig: boolean;
  activeWalletMode: TActiveWalletMode;
  createPasskeyAccount: () => Promise<string>;
  reconnectPasskeyAccount: () => Promise<string | null>;
  restorePasskeySession: () => Promise<string | null>;
  disconnectPasskeyAccount: () => Promise<void>;
  clearLocalPasskeySession: () => Promise<void>;
  clearPasskeyError: () => void;
  setActiveWalletMode: (mode: TActiveWalletMode) => void;
};

const PASSKEY_CANCELLED_PATTERNS = [
  "notallowed",
  "abort",
  "cancel",
  "timed out",
  "operation either timed out",
] as const;
const PASSKEY_USER_NAME_PREFIX = "hr";
const PASSKEY_USER_NAME_RANDOM_LENGTH = 8;

const DEFAULT_STATE: TPasskeySmartAccountState = {
  smartAccountAddress: null,
  credentialId: null,
  sessionStatus: "none",
  isPasskeyConnected: false,
  isCreating: false,
  isReconnecting: false,
  isRestoring: false,
  error: null,
  walletType: "passkey_smart_account",
};

const PasskeySmartAccountContext = createContext<TPasskeySmartAccountContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (error instanceof PasskeyConfigError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "Could not complete passkey smart account request.";
}

function isCancellationError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return PASSKEY_CANCELLED_PATTERNS.some((pattern) => message.includes(pattern));
}

function ensurePasskeyReady(): void {
  if (!isWebAuthnSupported()) {
    throw new Error("Browser does not support passkeys/WebAuthn.");
  }

  if (!hasSmartAccountConfig()) {
    throw new PasskeyConfigError();
  }
}

function formatCreateError(error: unknown): string {
  if (isCancellationError(error)) {
    return "Passkey creation cancelled.";
  }

  const message = getErrorMessage(error);
  return message === SMART_ACCOUNT_CONFIG_MISSING_MESSAGE
    ? "Smart account configuration missing."
    : `Could not create smart account. ${message}`;
}

function formatReconnectError(error: unknown): string {
  if (isCancellationError(error)) {
    return "Passkey connection cancelled.";
  }

  const message = getErrorMessage(error);
  return message === SMART_ACCOUNT_CONFIG_MISSING_MESSAGE
    ? "Smart account configuration missing."
    : `Could not reconnect passkey smart account. ${message}`;
}

function createPasskeyUserName(): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "").slice(0, PASSKEY_USER_NAME_RANDOM_LENGTH)
      : Math.random()
          .toString(16)
          .slice(2, 2 + PASSKEY_USER_NAME_RANDOM_LENGTH);

  return `${PASSKEY_USER_NAME_PREFIX}-${randomId}`;
}

export function PasskeySmartAccountProvider({ children }: { readonly children: React.ReactNode }) {
  const [state, setState] = useState<TPasskeySmartAccountState>(DEFAULT_STATE);
  const [activeWalletMode, setActiveWalletMode] = useState<TActiveWalletMode>("external_wallet");
  const restoreAttemptedRef = useRef(false);
  const recordWalletIdentity = useMutation(api.users.recordWalletIdentity);
  const isSupported = isWebAuthnSupported();
  const hasConfig = hasSmartAccountConfig();

  const setConnectedState = useCallback(
    (input: {
      contractId: string;
      credentialId: string;
      sessionStatus: TPasskeySmartAccountState["sessionStatus"];
    }) => {
      setState((currentValue) => ({
        ...currentValue,
        smartAccountAddress: input.contractId,
        credentialId: input.credentialId,
        sessionStatus: input.sessionStatus,
        isPasskeyConnected: true,
        isCreating: false,
        isReconnecting: false,
        isRestoring: false,
        error: null,
      }));
      setActiveWalletMode("passkey_smart_account");
    },
    [],
  );

  const persistIdentity = useCallback(
    async (walletAddress: string) => {
      await recordWalletIdentity({
        walletAddress,
        walletType: "passkey_smart_account",
      });
    },
    [recordWalletIdentity],
  );

  const restorePasskeySession = useCallback(async (): Promise<string | null> => {
    if (!isSupported || !hasConfig) {
      return null;
    }

    setState((currentValue) => ({ ...currentValue, isRestoring: true }));

    try {
      const result = await getSmartAccountKit().connectWallet();

      if (!result) {
        setState((currentValue) => ({ ...currentValue, isRestoring: false }));
        return null;
      }

      setConnectedState({ ...result, sessionStatus: "restored" });
      return result.contractId;
    } catch (error) {
      setState((currentValue) => ({
        ...currentValue,
        isRestoring: false,
        error: isCancellationError(error)
          ? null
          : "Could not restore passkey session. Try reconnecting.",
      }));
      return null;
    }
  }, [hasConfig, isSupported, setConnectedState]);

  const createPasskeyAccount = useCallback(async (): Promise<string> => {
    try {
      ensurePasskeyReady();
      setState((currentValue) => ({ ...currentValue, isCreating: true, error: null }));

      const result = await getSmartAccountKit().createWallet("Highrable", createPasskeyUserName(), {
        autoSubmit: true,
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      setConnectedState({ ...result, sessionStatus: "created" });
      await persistIdentity(result.contractId);
      return result.contractId;
    } catch (error) {
      const message = formatCreateError(error);
      setState((currentValue) => ({
        ...currentValue,
        isCreating: false,
        error: message,
      }));
      throw new Error(message);
    }
  }, [persistIdentity, setConnectedState]);

  const reconnectPasskeyAccount = useCallback(async (): Promise<string | null> => {
    try {
      ensurePasskeyReady();
      setState((currentValue) => ({ ...currentValue, isReconnecting: true, error: null }));

      const result = await getSmartAccountKit().connectWallet({ prompt: true });

      if (!result) {
        setState((currentValue) => ({ ...currentValue, isReconnecting: false }));
        return null;
      }

      setConnectedState({ ...result, sessionStatus: "reconnected" });
      await persistIdentity(result.contractId);
      return result.contractId;
    } catch (error) {
      const message = formatReconnectError(error);
      setState((currentValue) => ({
        ...currentValue,
        isReconnecting: false,
        error: message,
      }));
      throw new Error(message);
    }
  }, [persistIdentity, setConnectedState]);

  const disconnectPasskeyAccount = useCallback(async () => {
    try {
      await getSmartAccountKit().disconnect();
    } catch {
      // Local UI state should clear even if the SDK session was already gone.
    }

    setState(DEFAULT_STATE);
    setActiveWalletMode("external_wallet");
  }, []);

  const clearLocalPasskeySession = useCallback(async () => {
    try {
      await clearSmartAccountLocalSession();
      setState(DEFAULT_STATE);
      setActiveWalletMode("external_wallet");
    } catch (error) {
      setState((currentValue) => ({
        ...currentValue,
        isCreating: false,
        isReconnecting: false,
        isRestoring: false,
        error: getErrorMessage(error),
      }));
    }
  }, []);

  const clearPasskeyError = useCallback(() => {
    setState((currentValue) => ({ ...currentValue, error: null }));
  }, []);

  useEffect(() => {
    if (restoreAttemptedRef.current) {
      return;
    }

    restoreAttemptedRef.current = true;
    void restorePasskeySession();
  }, [restorePasskeySession]);

  const value = useMemo<TPasskeySmartAccountContextValue>(
    () => ({
      ...state,
      isSupported,
      hasConfig,
      activeWalletMode,
      createPasskeyAccount,
      reconnectPasskeyAccount,
      restorePasskeySession,
      disconnectPasskeyAccount,
      clearLocalPasskeySession,
      clearPasskeyError,
      setActiveWalletMode,
    }),
    [
      activeWalletMode,
      clearPasskeyError,
      createPasskeyAccount,
      clearLocalPasskeySession,
      disconnectPasskeyAccount,
      hasConfig,
      isSupported,
      reconnectPasskeyAccount,
      restorePasskeySession,
      state,
    ],
  );

  return (
    <PasskeySmartAccountContext.Provider value={value}>
      {children}
    </PasskeySmartAccountContext.Provider>
  );
}

export function usePasskeySmartAccount() {
  const context = useContext(PasskeySmartAccountContext);

  if (!context) {
    throw new Error("usePasskeySmartAccount must be used within PasskeySmartAccountProvider.");
  }

  return context;
}
