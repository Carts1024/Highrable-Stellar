"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const DEFAULT_THEME_MODE: ThemeMode = "light";
const THEME_MODES = new Set<string>(["light", "dark"]);

function sanitizeThemeMode(value: unknown): ThemeMode {
  return typeof value === "string" && THEME_MODES.has(value)
    ? (value as ThemeMode)
    : DEFAULT_THEME_MODE;
}

/**
 * The theme follows the browser until the user picks one; after that the
 * choice is stored and wins. `themeMode` is always the theme actually shown.
 */
function useThemeMode() {
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const themeMode = sanitizeThemeMode(resolvedTheme);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return {
    isMounted,
    isDarkMode: isMounted && themeMode === "dark",
    setDarkMode: (enabled: boolean) => setTheme(enabled ? "dark" : "light"),
    themeMode,
  };
}

export { DEFAULT_THEME_MODE, sanitizeThemeMode, useThemeMode };
