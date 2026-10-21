"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { RouteCallout } from "@/features/common";
import React, { useEffect, useRef } from "react";

export default function DisputesError({ reset }: { readonly reset: () => void }) {
  const { walletAddress } = useHighrableWalletIdentity();
  const failedWallet = useRef(walletAddress);

  useEffect(() => {
    if (failedWallet.current !== walletAddress) {
      failedWallet.current = walletAddress;
      reset();
    }
  }, [walletAddress, reset]);

  return (
    <div className="mx-auto max-w-5xl">
      <RouteCallout tone="danger" role="alert">
        <span>Unable to load disputes. Please try again.</span>
        <button type="button" className="ml-3 underline" onClick={reset}>
          Retry
        </button>
      </RouteCallout>
    </div>
  );
}
