"use client";

import { Repeat } from "lucide-react";

import { MODE_COPY } from "./mode-config";
import { useAppMode } from "./mode-provider";
import { ModeSwitch } from "./mode-switch";

/** The only place the mode can be changed. Shown on the person's own profile pages. */
export function ModeSwitchCard() {
  const { mode } = useAppMode();

  return (
    <section className="hr-mode-soft flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--mode-border)] p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--mode-text)]">
          <Repeat className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="hr-text-primary font-sans text-base font-bold">
            How are you using Highrable?
          </h2>
          <p className="hr-text-secondary mt-0.5 text-sm">
            You are in {MODE_COPY[mode].label}. {MODE_COPY[mode].tagline} Switch to see the pages
            for the other role.
          </p>
        </div>
      </div>
      <ModeSwitch size="large" />
    </section>
  );
}
