"use client";

import { useOnboardingState } from "@/features/onboarding/hooks/use-onboarding-state";
import {
  buildOnboardingRedirectPath,
  isOnboardingExemptRoute,
} from "@/features/onboarding/lib/onboarding-routes";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function OnboardingRouteGuard({ children }: { readonly children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const onboardingState = useOnboardingState();
  const isExemptRoute = isOnboardingExemptRoute(pathname);
  const shouldBlockRoute =
    onboardingState.isConnected &&
    !isExemptRoute &&
    (onboardingState.isLoading || !onboardingState.isComplete);

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

  if (shouldBlockRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-sm text-[#5f5f5f]">
        Checking onboarding...
      </div>
    );
  }

  return <>{children}</>;
}
