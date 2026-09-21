import { defineTable } from "convex/server";
import { v } from "convex/values";

export default defineTable({
  email: v.string(),
  normalizedEmail: v.string(),
  emailId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
}).index("by_normalizedEmail", ["normalizedEmail"]);
