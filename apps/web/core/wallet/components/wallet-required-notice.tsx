"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
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
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-highrable-orange-2/20 text-highrable-orange-2">
          <Wallet className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mb-4 font-sans text-3xl font-bold text-foreground">{title}</h1>
        <p className="mb-8 font-sans text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
        <WalletConnectTrigger />
      </div>
    </div>
  );
}
