"use client";

import { PasskeySmartAccountProvider } from "@/core/wallet/context/passkey-smart-account-context";
import { WalletContextProvider } from "@/core/wallet/context/wallet-context";
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
