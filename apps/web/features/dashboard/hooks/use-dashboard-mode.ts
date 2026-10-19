"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  IDashboardModeState,
  TDashboardMode,
  TDashboardRole,
} from "@/features/dashboard/types";

const DASHBOARD_MODE_STORAGE_PREFIX = "highrable:dashboard:mode";

function sanitizeDashboardMode(value: string | null): TDashboardMode | null {
  if (value === "client" || value === "freelancer") {
    return value;
  }

  return null;
}

function resolveFallbackMode(role: TDashboardRole | null): TDashboardMode {
  return role === "client" ? "client" : "freelancer";
}

function buildStorageKey(address: string): string {
  return `${DASHBOARD_MODE_STORAGE_PREFIX}:${address.trim().toUpperCase()}`;
}

/** Reads the mode last chosen for this wallet, or null when none was saved. */
export function readStoredDashboardMode(address: string): TDashboardMode | null {
  try {
    return sanitizeDashboardMode(window.localStorage.getItem(buildStorageKey(address)));
  } catch {
    return null;
  }
}

/** The mode a wallet opens in: its last choice, else its role's default. */
export function resolveDashboardMode(
  address: string,
  role: TDashboardRole | null,
): TDashboardMode {
  return readStoredDashboardMode(address) ?? resolveFallbackMode(role);
}

interface IUseDashboardModeArgs {
  readonly role: TDashboardRole | null;
  readonly address: string | null;
  readonly isConnected: boolean;
  /** A mode the visitor asked for (e.g. from a link). Wins over the stored choice and is saved. */
  readonly preferredMode?: TDashboardMode | null;
}

export function useDashboardMode({
  role,
  address,
  isConnected,
  preferredMode = null,
}: IUseDashboardModeArgs): IDashboardModeState {
  const fallbackMode = useMemo(() => resolveFallbackMode(role), [role]);
  const [selectedMode, setSelectedModeState] = useState<TDashboardMode>(fallbackMode);
  const [isReady, setIsReady] = useState(false);

  const storageKey = useMemo(() => {
    if (!address) {
      return null;
    }

    return buildStorageKey(address);
  }, [address]);

  useEffect(() => {
    if (!isConnected || !storageKey) {
      setSelectedModeState(preferredMode ?? fallbackMode);
      setIsReady(true);
      return;
    }

    const stored = sanitizeDashboardMode(window.localStorage.getItem(storageKey));
    const nextMode = preferredMode ?? stored ?? fallbackMode;

    setSelectedModeState(nextMode);
    setIsReady(true);

    if (stored !== nextMode) {
      window.localStorage.setItem(storageKey, nextMode);
    }
  }, [fallbackMode, isConnected, preferredMode, storageKey]);

  const setSelectedMode = useCallback(
    (mode: TDashboardMode) => {
      setSelectedModeState(mode);

      if (storageKey) {
        window.localStorage.setItem(storageKey, mode);
      }
    },
    [storageKey],
  );

  return {
    selectedMode,
    isReady,
    setSelectedMode,
  };
}
