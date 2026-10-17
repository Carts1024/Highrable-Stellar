import { defineTable } from "convex/server";
import { v } from "convex/values";

export default defineTable({
  network: v.string(),
  registryContractId: v.string(),
  walletAddress: v.string(),
  registeredAt: v.number(),
  verifiedAt: v.number(),
})
  .index("by_scope_wallet", ["network", "registryContractId", "walletAddress"])
  .index("by_wallet", ["walletAddress"]);
