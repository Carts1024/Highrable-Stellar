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

interface IUseDashboardModeArgs {
  readonly role: TDashboardRole | null;
  readonly address: string | null;
  readonly isConnected: boolean;
}

export function useDashboardMode({
  role,
  address,
  isConnected,
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
      setSelectedModeState(fallbackMode);
      setIsReady(true);
      return;
    }

    const stored = sanitizeDashboardMode(window.localStorage.getItem(storageKey));
    const nextMode = stored ?? fallbackMode;

    setSelectedModeState(nextMode);
    setIsReady(true);

    if (stored === null) {
      window.localStorage.setItem(storageKey, nextMode);
    }
  }, [fallbackMode, isConnected, storageKey]);

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
