"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useRouter } from "next/navigation";
import React from "react";

import { MODE_COPY } from "./mode-config";
import { useAppMode } from "./mode-provider";
import { ModeSwitch } from "./mode-switch";

/** The only place the mode can be changed. Shown on the person's own profile pages. */
export function ModeSwitchCard() {
  const { mode } = useAppMode();
  const router = useRouter();
  const walletIdentity = useHighrableWalletIdentity();

  return (
    <section className="flex h-full flex-col justify-between gap-4 rounded-lg border p-5">
      <div>
        <h2 className="hr-text-primary font-sans text-sm font-semibold">Mode</h2>
        <p className="hr-text-secondary mt-1 text-sm">
          You are in {MODE_COPY[mode].label}. {MODE_COPY[mode].tagline} Switch to see the pages for
          the other role.
        </p>
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
