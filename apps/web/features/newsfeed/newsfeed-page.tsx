"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { RouteCallout, RoutePanel, RoutePanelHeader } from "@/features/common";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { LockKeyhole, Newspaper } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type TNewsfeedAccess =
  | { state: "loading" }
  | { state: "disabled" }
  | { state: "guest" }
  | { state: "incomplete"; next: string }
  | { state: "ready" };

export function NewsfeedPage() {
  const [access, setAccess] = useState<TNewsfeedAccess>({ state: "loading" });

  useEffect(() => {
    let isCurrent = true;
    void fetch("/api/newsfeed/access", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          next?: string;
        } | null;
        if (!isCurrent) return;
        if (response.status === 404) {
          setAccess({ state: "disabled" });
        } else if (response.status === 403) {
          setAccess({ state: "incomplete", next: body?.next ?? "/onboarding?next=%2Fnewsfeed" });
        } else if (response.status === 401) {
          setAccess({ state: "guest" });
        } else if (response.ok) {
          setAccess({ state: "ready" });
        } else {
          setAccess({ state: "guest" });
        }
      })
      .catch(() => {
        if (isCurrent) setAccess({ state: "guest" });
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (access.state === "loading") {
    return <p className="text-sm text-muted-foreground">Checking Newsfeed access…</p>;
  }

  if (access.state === "disabled") {
    return (
      <RoutePanel className="max-w-2xl">
        <RoutePanelHeader
          eyebrow="Newsfeed"
          title="Community is coming soon"
          description="The community shell is deployed behind a release flag while verified identity and profile access are being validated."
          icon={<Newspaper />}
        />
      </RoutePanel>
    );
  }

  if (access.state === "guest") {
    return (
      <RoutePanel className="max-w-2xl">
        <RoutePanelHeader
          eyebrow="Verified members"
          title="Sign in to enter Newsfeed"
          description="Newsfeed is a private community space for members with a verified wallet or passkey session."
          icon={<LockKeyhole />}
        />
        <div className="space-y-4 px-5 py-5">
          <RouteCallout tone="neutral">No community content is loaded until access is verified.</RouteCallout>
          <WalletConnectTrigger className="hr-v2-button-primary rounded-md px-4 py-2 text-sm" />
        </div>
      </RoutePanel>
    );
  }

  if (access.state === "incomplete") {
    return (
      <RoutePanel className="max-w-2xl">
        <RoutePanelHeader
          eyebrow="Profile required"
          title="Finish your profile first"
          description="Newsfeed uses your named profile for attribution. Wallet addresses are never used as the author fallback."
          icon={<LockKeyhole />}
        />
        <div className="px-5 py-5">
          <AppButton asChild className="hr-v2-button-primary rounded-md">
            <Link href={access.next}>Complete profile</Link>
          </AppButton>
        </div>
      </RoutePanel>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="hr-text-muted font-mono text-xs uppercase">Community</p>
        <h1 className="hr-text-primary text-2xl font-semibold tracking-tight">Newsfeed</h1>
        <p className="hr-text-secondary text-sm">The text community feed will appear here in Sprint 2.</p>
      </header>
      <RouteCallout tone="neutral" icon={<Newspaper className="h-4 w-4" />}>
        Your verified member access is active. Posts and interactions are intentionally not enabled in this shell release.
      </RouteCallout>
    </div>
  );
}
