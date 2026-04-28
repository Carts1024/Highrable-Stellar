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

function useThemeMode() {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const themeMode = sanitizeThemeMode(theme);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && theme !== themeMode) {
      setTheme(themeMode);
    }
  }, [isMounted, setTheme, theme, themeMode]);

  return {
    isMounted,
    isDarkMode: themeMode === "dark",
    setDarkMode: (enabled: boolean) => setTheme(enabled ? "dark" : "light"),
    themeMode,
  };
}

export { DEFAULT_THEME_MODE, sanitizeThemeMode, useThemeMode };
