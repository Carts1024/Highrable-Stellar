"use client";

import { cn } from "@repo/ui/lib/utils";
import React from "react";

import { MODE_COPY } from "./mode-config";
import { useAppMode } from "./mode-provider";

/** Slim, always-visible strip under the header that names the active mode in its colour. */
export function ModeBanner() {
  const { mode, isReady } = useAppMode();
  const copy = MODE_COPY[mode];

  if (!isReady) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "border-b",
        mode === "client"
          ? "border-[#facc15]/50 bg-[#fefce8] text-[#713f12] dark:text-[#4a2a0c]"
          : "border-[#ff7003]/25 bg-[#fff7ef] text-[#9a3f00] dark:text-[#5c2600]",
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-1 text-xs sm:px-6">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mode-solid)]"
          aria-hidden="true"
        />
        <span className="font-medium">{copy.label}</span>
        <span className="hidden opacity-80 sm:inline dark:opacity-100">· {copy.tagline}</span>
      </div>
    </div>
  );
}
