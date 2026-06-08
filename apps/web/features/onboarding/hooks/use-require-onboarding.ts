"use client";

import { useOnboardingState } from "@/features/onboarding/hooks/use-onboarding-state";
import {
  buildOnboardingRedirectPath,
  isOnboardingExemptRoute,
} from "@/features/onboarding/lib/onboarding-routes";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireOnboarding(): {
  readonly isCheckingOnboarding: boolean;
  readonly isOnboardingComplete: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const onboardingState = useOnboardingState();
  const isExemptRoute = isOnboardingExemptRoute(pathname);

  useEffect(() => {
    if (
      !onboardingState.isConnected ||
      onboardingState.isLoading ||
      onboardingState.isComplete ||
      isExemptRoute
    ) {
      return;
    }

    const search = typeof window === "undefined" ? "" : window.location.search.slice(1);
    router.replace(buildOnboardingRedirectPath(pathname, search));
  }, [
    isExemptRoute,
    onboardingState.isComplete,
    onboardingState.isConnected,
    onboardingState.isLoading,
    pathname,
    router,
  ]);

  return {
    isCheckingOnboarding:
      onboardingState.isConnected &&
      !isExemptRoute &&
      (onboardingState.isLoading || !onboardingState.isComplete),
    isOnboardingComplete: onboardingState.isComplete,
  };
}
