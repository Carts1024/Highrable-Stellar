"use client";

import { useWalletContext } from "@/core/wallet/context/wallet-context";

export function useWallet() {
  return useWalletContext();
}
