"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { resolveDashboardMode } from "@/features/dashboard/hooks/use-dashboard-mode";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { useOnboardingState } from "@/features/onboarding";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface ILandingConnectButtonProps {
  readonly className: string;
}

/**
 * The single landing-page "Login" action: opens the wallet picker, or the app once connected.
 * Freelancers land on Find Work, clients on the dashboard. Accounts that still need onboarding
 * go to the dashboard, which sends them through onboarding first.
 */
export function LandingConnectButton({ className }: ILandingConnectButtonProps) {
  const router = useRouter();
  const walletIdentity = useHighrableWalletIdentity();
  const onboardingState = useOnboardingState();
  const { role, isLoading: isRoleLoading } = useDashboardRole();
  // Only redirect after a login started here, not when a saved session restores on page load.
  const hasStartedLogin = useRef(false);

  const isDestinationReady =
    walletIdentity.isConnected && !onboardingState.isLoading && !isRoleLoading;
  const destination =
    isDestinationReady &&
    onboardingState.isComplete &&
    walletIdentity.walletAddress &&
    resolveDashboardMode(walletIdentity.walletAddress, role) === "freelancer"
      ? "/marketplace"
      : "/dashboard";

  useEffect(() => {
    if (hasStartedLogin.current && isDestinationReady) {
      hasStartedLogin.current = false;
      router.push(destination);
    }
  }, [destination, isDestinationReady, router]);

  if (walletIdentity.isConnected) {
    return (
      <Link href={destination} className={className}>
        Login
      </Link>
    );
  }

  return (
    <WalletConnectTrigger
      className={className}
      label="Login"
      onOpen={() => {
        hasStartedLogin.current = true;
      }}
    />
  );
}
