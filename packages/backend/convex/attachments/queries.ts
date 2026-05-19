import { v } from "convex/values";

import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { NotFoundError } from "../_shared/errors";
import {
  assertCanViewAttachment,
  getAttachmentsForParent,
  sanitizeParentReference,
} from "./helpers";
import { attachmentParentTypeValidator } from "./schema";

async function withAttachmentUrl(
  ctx: QueryCtx,
  attachment: Awaited<ReturnType<typeof getAttachmentsForParent>>[number],
) {
  return {
    ...attachment,
    url: attachment.storageId ? await ctx.storage.getUrl(attachment.storageId) : null,
  };
}

export const listByParent = query({
  args: {
    parentType: attachmentParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parent = sanitizeParentReference(args);
    const attachments = await getAttachmentsForParent(ctx, {
      ...parent,
      viewerWallet: args.viewerWallet,
    });

    return await Promise.all(attachments.map((attachment) => withAttachmentUrl(ctx, attachment)));
  },
});

export const getById = query({
  args: {
    attachmentId: v.id("attachments"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new NotFoundError("Attachment not found.");
    }

    await assertCanViewAttachment(ctx, attachment, args.viewerWallet);
    return await withAttachmentUrl(ctx, attachment);
  },
});

export const getManyByIds = query({
  args: {
    attachmentIds: v.array(v.id("attachments")),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const attachmentId of args.attachmentIds) {
      const attachment = await ctx.db.get(attachmentId);
      if (!attachment) {
        continue;
      }

      await assertCanViewAttachment(ctx, attachment, args.viewerWallet);
      results.push(await withAttachmentUrl(ctx, attachment));
    }

    return results;
  },
});
