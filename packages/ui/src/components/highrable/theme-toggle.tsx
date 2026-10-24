"use client";

import { Moon, Sun } from "lucide-react";

import { useThemeMode } from "../../hooks/use-theme-mode";
import { cn } from "../../lib/utils";

interface IThemeToggleProps {
  readonly className?: string;
}

/** Switches between light and dark mode. Shows the mode you would switch to. */
export function ThemeToggle({ className }: IThemeToggleProps) {
  const { isDarkMode, isMounted, setDarkMode } = useThemeMode();
  const label = isDarkMode ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setDarkMode(!isDarkMode)}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted",
        className,
      )}
    >
      {/* Icons wait for mount so server and client markup match. */}
      {isMounted ? (
        isDarkMode ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )
      ) : (
        <span className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
