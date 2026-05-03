"use client";

import { getConvexClient } from "@repo/convex-client";
import UiProviders from "@repo/ui/ui-providers";
import { ConvexProvider } from "convex/react";
import dynamic from "next/dynamic";
import { useState } from "react";

const WalletProvider = dynamic(
  () => import("@/core/providers/wallet-provider").then((module) => module.WalletProvider),
  { ssr: false },
);

/** Composes shared UI concerns with Highrable's wallet runtime. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [convexClient] = useState(() => getConvexClient());

  return (
    <ConvexProvider client={convexClient}>
      <WalletProvider>
        <UiProviders>{children}</UiProviders>
      </WalletProvider>
    </ConvexProvider>
  );
}
