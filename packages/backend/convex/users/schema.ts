import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const roleEnum = createStringEnum(["client", "freelancer"] as const);
const walletTypeEnum = createStringEnum(["external_wallet", "passkey_smart_account"] as const);

export const USER_ROLES = roleEnum.map;
export const roleValidator = roleEnum.validator;
export const WALLET_TYPES = walletTypeEnum.map;
export const walletTypeValidator = walletTypeEnum.validator;

export type TUserRole = Infer<typeof roleValidator>;
export type TUserWalletType = Infer<typeof walletTypeValidator>;

export default defineTable({
  walletAddress: v.string(),
  walletType: v.optional(walletTypeValidator),
  smartAccountAddress: v.optional(v.string()),
  createdWithPasskey: v.optional(v.boolean()),
  role: roleValidator,
  name: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_walletAddress", ["walletAddress"])
  .index("by_role", ["role"]);
