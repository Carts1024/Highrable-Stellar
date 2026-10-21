"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { ProfileAvatar } from "@/features/common/components/profile/profile-avatar";
import { useAppMode } from "@/features/mode";
import { api } from "@repo/convex-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "convex/react";
import { ChevronDown, LogOut, User } from "lucide-react";
import Link from "next/link";

interface IHeaderProfileLinkProps {
  readonly className?: string;
  /** Show the full "My Profile" text (used in the mobile menu). */
  readonly showLabel?: boolean;
  /** Called after a menu item is chosen (the mobile menu uses it to close itself). */
  readonly onNavigate?: () => void;
}

/**
 * Avatar + "My Profile" menu with a Profile link and Log Out for the active wallet.
 * The app shell redirects home once the wallet disconnects.
 */
export function HeaderProfileLink({
  className,
  showLabel = false,
  onNavigate,
}: IHeaderProfileLinkProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const { disconnectWallet } = useWallet();
  const { disconnectPasskeyAccount } = usePasskeySmartAccount();
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

  const handleLogOut = async () => {
    onNavigate?.();
    if (walletIdentity.walletType === "passkey_smart_account") {
      await disconnectPasskeyAccount();
    } else {
      await disconnectWallet();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`My ${mode} profile menu${displayName ? ` (${displayName})` : ""}`}
          className={cn(
            "inline-flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm text-foreground transition-colors hover:bg-muted",
            className,
          )}
        >
          <ProfileAvatar
            className="h-7 w-7 rounded-full border-0 shadow-none"
            displayName={displayName}
            fallbackLabel="ME"
            {...(onboardingState?.avatarUrl ? { avatarUrl: onboardingState.avatarUrl } : {})}
          />
          <span className={cn(showLabel ? "" : "hidden lg:inline")}>My profile</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem asChild>
          <Link href={href} onClick={onNavigate}>
            <User className="h-4 w-4" aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void handleLogOut()}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
