"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useDashboardMode } from "@/features/dashboard/hooks/use-dashboard-mode";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { createContext, useContext, useMemo } from "react";

import type { TAppMode } from "./mode-config";
import type { ReactNode } from "react";

interface IAppModeContextValue {
  readonly mode: TAppMode;
  readonly isReady: boolean;
  readonly setMode: (mode: TAppMode) => void;
}

const AppModeContext = createContext<IAppModeContextValue | null>(null);

/**
 * Holds the one place that says whether the person is currently acting as a freelancer or a
 * client. The choice is remembered per wallet (same storage key the dashboard already used).
 */
export function AppModeProvider({ children }: { readonly children: ReactNode }) {
  const walletIdentity = useHighrableWalletIdentity();
  const { role } = useDashboardRole();
  const { selectedMode, isReady, setSelectedMode } = useDashboardMode({
    role,
    address: walletIdentity.walletAddress ?? null,
    isConnected: walletIdentity.isConnected,
  });

  const value = useMemo<IAppModeContextValue>(
    () => ({ mode: selectedMode, isReady, setMode: setSelectedMode }),
    [selectedMode, isReady, setSelectedMode],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): IAppModeContextValue {
  const context = useContext(AppModeContext);

  if (!context) {
    // Rendered outside the shell (e.g. isolated tests): behave as freelancer without switching.
    return { mode: "freelancer", isReady: true, setMode: () => {} };
  }

  return context;
}
