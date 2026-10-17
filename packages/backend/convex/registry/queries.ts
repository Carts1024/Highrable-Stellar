import { v } from "convex/values";

import { query } from "../_generated/server";
import { getConfiguredRegistryScope, findRegistryRegistration } from "./helpers";

export const getVerifiedRegistration = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    let scope;
    try {
      scope = getConfiguredRegistryScope();
    } catch {
      return null;
    }
    return await findRegistryRegistration(ctx, {
      ...scope,
      walletAddress: args.walletAddress,
    });
  },
});
