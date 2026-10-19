"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import Link from "next/link";
import React from "react";

import type { ReactNode } from "react";

import { MODE_COPY, type TAppMode } from "./mode-config";
import { useAppMode } from "./mode-provider";

interface IModeGateProps {
  /** The mode that is allowed to see `children`. */
  readonly allow: TAppMode;
  /** What this area is for, in plain words ("post a job"). */
  readonly purpose: string;
  readonly children: ReactNode;
}

/**
 * Shows the page only in the matching mode. In the other mode it explains why the page is
 * hidden and offers a one-click switch, so freelancers never see client tools and vice versa.
 */
export function ModeGate({ allow, purpose, children }: IModeGateProps) {
  const { mode, isReady } = useAppMode();
  const walletIdentity = useHighrableWalletIdentity();

  if (!isReady) {
    return <p className="font-sans text-sm text-muted-foreground">Loading…</p>;
  }

  if (mode === allow) {
    return <>{children}</>;
  }

  const needed = MODE_COPY[allow];
  const profileHref = walletIdentity.walletAddress
    ? `/${mode === "client" ? "clients" : "freelancers"}/${encodeURIComponent(walletIdentity.walletAddress)}`
    : "/dashboard";
  const other: TAppMode = allow === "client" ? "freelancer" : "client";

  return (
    <div className="max-w-lg py-6">
      <h1 className="hr-text-primary font-sans text-xl font-semibold">
        This page is for {needed.shortLabel} mode
      </h1>
      <p className="hr-text-secondary mt-2 text-sm leading-relaxed">
        You are currently in {MODE_COPY[other].label}. To {purpose}, change your mode to{" "}
        {needed.label} on your profile page.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <AppButton asChild className="hr-v2-button-primary rounded-md px-4">
          <Link href={profileHref}>Go to my profile</Link>
        </AppButton>
        <Link
          href="/dashboard"
          className="hr-text-secondary text-sm underline-offset-4 hover:underline"
        >
          Go to my dashboard
        </Link>
      </div>
    </div>
  );
}

/** Renders `children` only when the current mode matches. Use to hide buttons and panels. */
export function ModeOnly({
  mode: allowed,
  children,
}: {
  readonly mode: TAppMode;
  readonly children: ReactNode;
}) {
  const { mode } = useAppMode();

  return mode === allowed ? <>{children}</> : null;
}
