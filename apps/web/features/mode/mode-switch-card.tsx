"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { Repeat } from "lucide-react";
import { useRouter } from "next/navigation";

import { MODE_COPY } from "./mode-config";
import { useAppMode } from "./mode-provider";
import { ModeSwitch } from "./mode-switch";

/** The only place the mode can be changed. Shown on the person's own profile pages. */
export function ModeSwitchCard() {
  const { mode } = useAppMode();
  const router = useRouter();
  const walletIdentity = useHighrableWalletIdentity();

  return (
    <section className="hr-mode-soft flex h-full flex-col justify-between gap-5 rounded-2xl border border-[var(--mode-border)] p-5 sm:p-6">
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
      <ModeSwitch
        size="large"
        fullWidth
        onChange={(nextMode) => {
          // Show the profile that matches the role that was just chosen.
          if (walletIdentity.walletAddress) {
            router.push(
              `/${nextMode === "client" ? "clients" : "freelancers"}/${encodeURIComponent(walletIdentity.walletAddress)}`,
            );
          }
        }}
      />
    </section>
  );
}
