"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { TermHint } from "@/features/common";
import { Wallet } from "lucide-react";

export function WalletRequiredNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <div className="rounded-2xl border border-border p-12 shadow-md transition-shadow hover:shadow-lg">
        <div className="hr-mode-soft hr-mode-text mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl">
          <Wallet className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mb-4 font-sans text-3xl font-bold text-foreground">{title}</h1>
        <p className="mb-8 font-sans text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
        <WalletConnectTrigger />
        <p className="mt-6 font-sans text-xs leading-relaxed text-muted-foreground">
          Your <TermHint term="wallet">wallet</TermHint> is your Highrable account. There is no
          password to remember.
        </p>
      </div>
    </div>
  );
}
