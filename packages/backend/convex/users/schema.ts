import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const roleEnum = createStringEnum(["client", "freelancer"] as const);
const walletTypeEnum = createStringEnum(["external_wallet", "passkey_smart_account"] as const);

export const USER_ROLES = roleEnum.map;
export const roleValidator = roleEnum.validator;
export const walletTypeValidator = walletTypeEnum.validator;

export type TUserRole = Infer<typeof roleValidator>;
export type TWalletType = Infer<typeof walletTypeValidator>;

export default defineTable({
  walletAddress: v.string(),
  role: roleValidator,
  name: v.optional(v.string()),
  companyName: v.optional(v.string()),
  bio: v.optional(v.string()),
  skills: v.optional(v.array(v.string())),
  avatarUrl: v.optional(v.string()),
  websiteUrl: v.optional(v.string()),
  portfolioUrl: v.optional(v.string()),
  location: v.optional(v.string()),
  walletType: v.optional(walletTypeValidator),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_walletAddress", ["walletAddress"])
  .index("by_role", ["role"]);
