"use client";

import { WalletContextProvider } from "@/core/wallet/context/wallet-context";
import { PasskeySmartAccountProvider } from "@/core/wallet/passkey-smart-account-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/** Provides wallet and query clients to the Highrable app shell. */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WalletContextProvider>
        <PasskeySmartAccountProvider>{children}</PasskeySmartAccountProvider>
      </WalletContextProvider>
    </QueryClientProvider>
  );
}
