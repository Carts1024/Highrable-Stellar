import type { QueryCtx } from "../_generated/server";

import { normalizeWalletAddress, optionalNonEmptyString } from "../_shared/input";

export function sanitizeUserName(name: string | undefined): string | undefined {
  return optionalNonEmptyString(name, "name");
}

export function sanitizeUserWalletAddress(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}

export async function findUserByWallet(ctx: QueryCtx, walletAddress: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", walletAddress))
    .unique();
}
