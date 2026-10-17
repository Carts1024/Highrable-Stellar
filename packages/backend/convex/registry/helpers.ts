import type { QueryCtx } from "../_generated/server";

import { normalizeWalletAddress } from "../_shared/input";

const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;

export type TRegistryScope = {
  network: string;
  registryContractId: string;
};

export function getConfiguredRegistryScope(): TRegistryScope {
  const configuredNetwork = process.env.STELLAR_NETWORK?.trim().toLowerCase();
  const network = configuredNetwork === "public" ? "mainnet" : configuredNetwork;
  const registryContractId = process.env.REGISTRY_CONTRACT_ID?.trim().toUpperCase();

  if (!network) {
    throw new Error("Missing Convex environment variable: STELLAR_NETWORK.");
  }
  if (network !== "local" && network !== "testnet" && network !== "mainnet") {
    throw new Error("STELLAR_NETWORK must be local, testnet, mainnet, or public.");
  }
  if (!registryContractId) {
    throw new Error("Missing Convex environment variable: REGISTRY_CONTRACT_ID.");
  }
  if (!CONTRACT_ID_PATTERN.test(registryContractId)) {
    throw new Error("REGISTRY_CONTRACT_ID must be a valid Stellar contract address.");
  }

  return { network, registryContractId };
}

export function sanitizeRegistryScope(scope: TRegistryScope): TRegistryScope {
  const network = scope.network.trim().toLowerCase();
  const registryContractId = scope.registryContractId.trim().toUpperCase();
  if (!network || !CONTRACT_ID_PATTERN.test(registryContractId)) {
    throw new Error("Registry scope is invalid.");
  }
  return { network, registryContractId };
}

export function sanitizeRegistryWalletAddress(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}

export async function findRegistryRegistration(
  ctx: QueryCtx,
  params: TRegistryScope & { walletAddress: string },
) {
  const scope = sanitizeRegistryScope(params);
  const walletAddress = sanitizeRegistryWalletAddress(params.walletAddress);
  return await ctx.db
    .query("registryRegistrations")
    .withIndex("by_scope_wallet", (q) =>
      q
        .eq("network", scope.network)
        .eq("registryContractId", scope.registryContractId)
        .eq("walletAddress", walletAddress),
    )
    .unique();
}
