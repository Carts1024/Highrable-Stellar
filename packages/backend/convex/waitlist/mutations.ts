import { Resend } from "@convex-dev/resend";
import { getWaitlistConfirmationEmail } from "@repo/ui/emails";
import { v } from "convex/values";

import { components } from "../_generated/api";
import { mutation } from "../_generated/server";
import {
  normalizeWaitlistEmail,
  requireWaitlistEmailFrom,
  resolveHighrableAppUrl,
  sanitizeWaitlistEmail,
} from "./helpers";

const WAITLIST_CONFIRMATION_SUBJECT = "You're on the Highrable waitlist";

const resend: Resend = new Resend(components.resend, {
  testMode: false,
});

async function sendWaitlistConfirmation(
  ctx: Parameters<typeof resend.sendEmail>[0],
  email: string,
): Promise<string> {
  return await resend.sendEmail(ctx, {
    from: requireWaitlistEmailFrom(),
    to: email,
    subject: WAITLIST_CONFIRMATION_SUBJECT,
    html: getWaitlistConfirmationEmail({
      email,
      siteUrl: resolveHighrableAppUrl(),
    }),
  });
}

export const joinWaitlist = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = sanitizeWaitlistEmail(args.email);
    const normalizedEmail = normalizeWaitlistEmail(email);
    const existingEntry = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", normalizedEmail))
      .unique();

    if (existingEntry) {
      const emailId = await sendWaitlistConfirmation(ctx, email);
      await ctx.db.patch(existingEntry._id, {
        email,
        emailId,
        updatedAt: Date.now(),
      });

      return {
        status: "confirmation_resent" as const,
        waitlistEntryId: existingEntry._id,
      };
    }

    const now = Date.now();
    const emailId = await sendWaitlistConfirmation(ctx, email);

    const waitlistEntryId = await ctx.db.insert("waitlistEntries", {
      email,
      normalizedEmail,
      emailId,
      createdAt: now,
    });

    return {
      status: "joined" as const,
      waitlistEntryId,
    };
  },
});
