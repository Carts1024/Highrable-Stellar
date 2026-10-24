import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import {
  findRegistryRegistration,
  getConfiguredRegistryScope,
  sanitizeRegistryScope,
  sanitizeRegistryWalletAddress,
} from "./helpers";

export const applyVerifiedRegistration = internalMutation({
  args: {
    network: v.string(),
    registryContractId: v.string(),
    walletAddress: v.string(),
    registeredAt: v.number(),
    verifiedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const scope = sanitizeRegistryScope(args);
    const configuredScope = getConfiguredRegistryScope();
    if (
      scope.network !== configuredScope.network ||
      scope.registryContractId !== configuredScope.registryContractId
    ) {
      throw new Error("Verified registration is outside the configured registry scope.");
    }
    const walletAddress = sanitizeRegistryWalletAddress(args.walletAddress);
    if (!Number.isSafeInteger(args.verifiedAt) || args.verifiedAt < 0) {
      throw new Error("Registry verification time is invalid.");
    }
    const existing = await findRegistryRegistration(ctx, {
      ...scope,
      walletAddress,
    });
    const registeredAt = args.registeredAt;
    if (!Number.isSafeInteger(registeredAt) || registeredAt < 0) {
      throw new Error("Verified registration timestamp is invalid.");
    }

    if (existing) {
      if (existing.registeredAt !== registeredAt) {
        throw new Error("Registry mirror conflicts with the immutable on-chain timestamp.");
      }
      await ctx.db.patch(existing._id, { verifiedAt: args.verifiedAt });
      return existing._id;
    }

    return await ctx.db.insert("registryRegistrations", {
      ...scope,
      walletAddress,
      registeredAt,
      verifiedAt: args.verifiedAt,
    });
  },
});
