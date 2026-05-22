import { env } from "@/core/config/env";

function getExplorerNetworkPath(): "public" | "testnet" {
  const network = env.NEXT_PUBLIC_STELLAR_NETWORK.trim().toLowerCase();
  return network === "mainnet" || network === "public" ? "public" : "testnet";
}

export function getTxExplorerUrl(txHash: string): string {
  return `https://stellar.expert/explorer/${getExplorerNetworkPath()}/tx/${encodeURIComponent(txHash)}`;
}
