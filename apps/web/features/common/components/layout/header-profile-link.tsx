"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { ProfileAvatar } from "@/features/common/components/profile/profile-avatar";
import { useAppMode } from "@/features/mode";
import { api } from "@repo/convex-client";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "convex/react";
import Link from "next/link";

interface IHeaderProfileLinkProps {
  readonly className?: string;
  /** Show the full "My Profile" text (used in the mobile menu). */
  readonly showLabel?: boolean;
}

/** Avatar + "My Profile" shortcut. Opens the public profile that matches the current mode. */
export function HeaderProfileLink({ className, showLabel = false }: IHeaderProfileLinkProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const { mode } = useAppMode();
  const onboardingState = useQuery(
    api.users.queries.getOnboardingState,
    walletIdentity.walletAddress ? { walletAddress: walletIdentity.walletAddress } : "skip",
  );

  if (!walletIdentity.isConnected || !walletIdentity.walletAddress) {
    return null;
  }

  const user = onboardingState?.user;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const href = `/${mode === "client" ? "clients" : "freelancers"}/${encodeURIComponent(
    walletIdentity.walletAddress,
  )}`;

  return (
    <Link
      href={href}
      aria-label={`My ${mode} profile${displayName ? ` (${displayName})` : ""}`}
      className={cn(
        "hr-mode-soft inline-flex items-center gap-2 rounded-full border border-[var(--mode-border)] py-1 pr-3 pl-1 text-xs font-semibold text-foreground transition-colors hover:border-highrable-orange-3",
        className,
      )}
    >
      <ProfileAvatar
        className="h-8 w-8 rounded-full border-0 shadow-none"
        displayName={displayName}
        fallbackLabel="ME"
        {...(onboardingState?.avatarUrl ? { avatarUrl: onboardingState.avatarUrl } : {})}
      />
      <span
        className={cn("font-mono tracking-[0.06em] uppercase", showLabel ? "" : "hidden lg:inline")}
      >
        My Profile
      </span>
    </Link>
  );
}
