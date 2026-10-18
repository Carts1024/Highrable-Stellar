"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useDashboardMode } from "@/features/dashboard/hooks/use-dashboard-mode";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { ReactNode } from "react";

import { MODE_QUERY_PARAM, parseAppMode, type TAppMode } from "./mode-config";

interface IAppModeContextValue {
  readonly mode: TAppMode;
  readonly isReady: boolean;
  readonly setMode: (mode: TAppMode) => void;
}

const AppModeContext = createContext<IAppModeContextValue | null>(null);

function readRequestedMode(): TAppMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  return parseAppMode(new URLSearchParams(window.location.search).get(MODE_QUERY_PARAM));
}

/**
 * Holds the one place that says whether the person is currently acting as a freelancer or a
 * client. The choice is remembered per wallet (same storage key the dashboard already used).
 * A link can ask for a mode with `?mode=client|freelancer`; that request is kept (so a wallet
 * reconnecting after load does not undo it) until the person switches mode themselves.
 */
export function AppModeProvider({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const walletIdentity = useHighrableWalletIdentity();
  const { role } = useDashboardRole();
  // Read on first render so the page never flashes the wrong mode.
  const [preferredMode, setPreferredMode] = useState<TAppMode | null>(readRequestedMode);
  const { selectedMode, isReady, setSelectedMode } = useDashboardMode({
    role,
    address: walletIdentity.walletAddress ?? null,
    isConnected: walletIdentity.isConnected,
    preferredMode,
  });

  // Pick up the request on later in-app navigations too, then drop it from the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = parseAppMode(params.get(MODE_QUERY_PARAM));

    if (!params.has(MODE_QUERY_PARAM)) {
      return;
    }

    if (requested) {
      setPreferredMode(requested);
    }

    params.delete(MODE_QUERY_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router]);

  const setMode = useCallback(
    (mode: TAppMode) => {
      setPreferredMode(null);
      setSelectedMode(mode);
    },
    [setSelectedMode],
  );

  const value = useMemo<IAppModeContextValue>(
    () => ({ mode: selectedMode, isReady, setMode }),
    [selectedMode, isReady, setMode],
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
