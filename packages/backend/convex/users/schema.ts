import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const roleEnum = createStringEnum(["client", "freelancer"] as const);

export const USER_ROLES = roleEnum.map;
export const roleValidator = roleEnum.validator;

export type TUserRole = Infer<typeof roleValidator>;

export default defineTable({
  walletAddress: v.string(),
  role: roleValidator,
  name: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_walletAddress", ["walletAddress"])
  .index("by_role", ["role"]);
