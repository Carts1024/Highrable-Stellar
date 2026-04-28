"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

import type { ThemeProviderProps } from "next-themes";

const THEME_STORAGE_KEY = "task-mgt-theme";

function ThemeProvider({ children }: Pick<ThemeProviderProps, "children">) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

export { THEME_STORAGE_KEY, ThemeProvider };
