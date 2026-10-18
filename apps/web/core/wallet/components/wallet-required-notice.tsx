"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { TermHint } from "@/features/common";
import React from "react";

export function WalletRequiredNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-lg space-y-4 py-6">
      <div className="space-y-1">
        <h1 className="hr-text-primary font-sans text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="hr-text-secondary font-sans text-sm leading-relaxed">{description}</p>
      </div>
      <WalletConnectTrigger />
      <p className="hr-text-muted font-sans text-xs leading-relaxed">
        Your <TermHint term="wallet">wallet</TermHint> is your Highrable account. There is no
        password to remember.
      </p>
    </div>
  );
}
