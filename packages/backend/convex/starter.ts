import { mutation, query } from "./_generated/server";

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const latestMessage = await ctx.db.query("starterMessages").order("desc").take(1);

    return {
      ok: true,
      message: latestMessage[0]?.text ?? "Convex starter is ready.",
      now: Date.now(),
    };
  },
});

export const seedStarterMessage = mutation({
  args: {},
  handler: async (ctx) => {
    const existingMessage = await ctx.db.query("starterMessages").take(1);

    if (existingMessage.length > 0) {
      return existingMessage[0]._id;
    }

    return await ctx.db.insert("starterMessages", {
      text: "Convex starter is ready.",
    });
  },
});
