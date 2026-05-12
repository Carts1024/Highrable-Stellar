import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TUserRole } from "./schema";

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

export async function ensureUserWithRole(ctx: MutationCtx, walletAddress: string, role: TUserRole) {
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", walletAddress))
    .unique();

  if (existingUser) {
    return existingUser._id;
  }

  return await ctx.db.insert("users", {
    walletAddress,
    role,
    createdAt: Date.now(),
  });
}
