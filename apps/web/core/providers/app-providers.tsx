"use client";

import UiProviders from "@repo/ui/ui-providers";
import dynamic from "next/dynamic";

const WalletProvider = dynamic(
  () => import("@/core/providers/wallet-provider").then((module) => module.WalletProvider),
  { ssr: false },
);

/** Composes shared UI concerns with Highrable's wallet runtime. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <UiProviders>{children}</UiProviders>
    </WalletProvider>
  );
}
