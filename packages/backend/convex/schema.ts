import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  starterMessages: defineTable({
    text: v.string(),
  }),
});
