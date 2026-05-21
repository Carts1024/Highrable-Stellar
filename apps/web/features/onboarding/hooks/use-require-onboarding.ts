"use client";

import { useOnboardingState } from "@/features/onboarding/hooks/use-onboarding-state";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireOnboarding(): {
  readonly isCheckingOnboarding: boolean;
  readonly isOnboardingComplete: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const onboardingState = useOnboardingState();

  useEffect(() => {
    if (
      !onboardingState.isConnected ||
      onboardingState.isLoading ||
      onboardingState.isComplete ||
      pathname === "/onboarding"
    ) {
      return;
    }

    router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
  }, [
    onboardingState.isComplete,
    onboardingState.isConnected,
    onboardingState.isLoading,
    pathname,
    router,
  ]);

  return {
    isCheckingOnboarding:
      onboardingState.isConnected && (onboardingState.isLoading || !onboardingState.isComplete),
    isOnboardingComplete: onboardingState.isComplete,
  };
}

