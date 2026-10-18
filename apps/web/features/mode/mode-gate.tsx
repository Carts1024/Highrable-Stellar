"use client";

import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";

import type { ReactNode } from "react";

import { MODE_COPY, type TAppMode } from "./mode-config";
import { useAppMode } from "./mode-provider";
import { ModeSwitch } from "./mode-switch";

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
  const { mode, isReady, setMode } = useAppMode();

  if (!isReady) {
    return <p className="font-sans text-sm text-muted-foreground">Loading…</p>;
  }

  if (mode === allow) {
    return <>{children}</>;
  }

  const needed = MODE_COPY[allow];
  const other: TAppMode = allow === "client" ? "freelancer" : "client";

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            allow === "client" ? "bg-[#fef9c3] text-[#a16207]" : "bg-[#fff1e5] text-[#e85d00]"
          }`}
        >
          <Lock className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="hr-text-primary mt-5 font-sans text-2xl font-bold">
          This page is for {needed.shortLabel} mode
        </h1>
        <p className="hr-text-secondary mt-2 text-sm leading-relaxed">
          You are currently in {MODE_COPY[other].label}. To {purpose}, switch to {needed.label}. You
          can switch back at any time.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <AppButton
            type="button"
            onClick={() => setMode(allow)}
            className="hr-v2-button-primary rounded-lg px-6 font-mono"
          >
            Switch to {needed.label}
          </AppButton>
          <Link
            href="/dashboard"
            className="hr-text-secondary text-xs underline-offset-4 hover:underline"
          >
            Stay in {MODE_COPY[other].shortLabel} mode and go to my dashboard
          </Link>
        </div>
        <div className="mt-6 flex justify-center border-t border-border pt-5">
          <ModeSwitch size="large" />
        </div>
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
