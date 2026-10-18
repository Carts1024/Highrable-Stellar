"use client";

import { cn } from "@repo/ui/lib/utils";

import { MODE_COPY } from "./mode-config";
import { useAppMode } from "./mode-provider";

/** Slim, always-visible strip under the header that names the active mode in its colour. */
export function ModeBanner() {
  const { mode, isReady } = useAppMode();
  const copy = MODE_COPY[mode];
  const Icon = copy.icon;

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
          ? "border-[#facc15]/60 bg-[#fef9c3] text-[#713f12]"
          : "border-[#ff7003]/30 bg-[#fff1e5] text-[#9a3f00]",
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-6 py-1.5 text-xs">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="font-mono font-semibold tracking-[0.06em] uppercase">{copy.label}</span>
        <span className="hidden sm:inline">· {copy.tagline}</span>
      </div>
    </div>
  );
}
