import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TUserRole, TWalletType } from "./schema";

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

export async function ensureUserWithRole(
  ctx: MutationCtx,
  walletAddress: string,
  role: TUserRole,
  walletType?: TWalletType,
) {
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", walletAddress))
    .unique();

  if (existingUser) {
    if (walletType !== undefined && existingUser.walletType !== walletType) {
      await ctx.db.patch(existingUser._id, { walletType });
    }

    return existingUser._id;
  }

  return await ctx.db.insert("users", {
    walletAddress,
    role,
    ...(walletType !== undefined ? { walletType } : {}),
    createdAt: Date.now(),
  });
}
