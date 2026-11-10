import { defineTable } from "convex/server";
import { v } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const authMethodEnum = createStringEnum(["external_wallet", "passkey"] as const);
const walletTypeEnum = createStringEnum(["external_wallet", "passkey_smart_account"] as const);

export const authMethodValidator = authMethodEnum.validator;
export const authWalletTypeValidator = walletTypeEnum.validator;

export const authChallenges = defineTable({
  challengeId: v.string(),
  nonce: v.string(),
  message: v.optional(v.string()),
  webauthnChallenge: v.optional(v.string()),
  walletAddress: v.string(),
  walletType: authWalletTypeValidator,
  authMethod: authMethodValidator,
  browserBinding: v.string(),
  credentialId: v.optional(v.string()),
  createdAt: v.number(),
  expiresAt: v.number(),
  consumedAt: v.optional(v.number()),
})
  .index("by_challengeId", ["challengeId"])
  .index("by_nonce", ["nonce"]);

export const authSessions = defineTable({
  sessionId: v.string(),
  walletAddress: v.string(),
  walletType: authWalletTypeValidator,
  authMethod: authMethodValidator,
  createdAt: v.number(),
  expiresAt: v.number(),
  revokedAt: v.optional(v.number()),
})
  .index("by_sessionId", ["sessionId"])
  .index("by_walletAddress", ["walletAddress"]);

export const authRateLimits = defineTable({
  key: v.string(),
  windowStartedAt: v.number(),
  count: v.number(),
}).index("by_key", ["key"]);
