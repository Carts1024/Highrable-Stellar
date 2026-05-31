"use client";

import { HighrableDebugger } from "@/core/debugger/highrable-debugger";
import { OnboardingRouteGuard } from "@/features/onboarding/components/onboarding-route-guard";
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
        <UiProviders>
          <OnboardingRouteGuard>{children}</OnboardingRouteGuard>
          <HighrableDebugger />
        </UiProviders>
      </WalletProvider>
    </ConvexProvider>
  );
}
