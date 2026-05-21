import { v } from "convex/values";

import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import { assertCanViewAttachment, serializeAttachmentForViewer } from "../attachments/helpers";
import {
  assertParticipant,
  getConversationByParent as findConversationByParent,
  getConversationOrThrow,
} from "./helpers";
import { conversationParentTypeValidator } from "./schema";

async function withMessageAttachments(
  ctx: QueryCtx,
  message: Awaited<ReturnType<typeof ctx.db.get<"messages">>>,
  viewerWallet: string,
) {
  if (!message) {
    return null;
  }

  const attachments = [];
  for (const attachmentId of message.attachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) {
      continue;
    }
    await assertCanViewAttachment(ctx, attachment, viewerWallet);
    attachments.push(await serializeAttachmentForViewer(ctx, attachment, viewerWallet));
  }

  return { ...message, attachments };
}

export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await getConversationOrThrow(ctx, args.conversationId);
    assertParticipant(conversation, args.viewerWallet);
    return conversation;
  },
});

export const getConversationByParent = query({
  args: {
    parentType: conversationParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await findConversationByParent(ctx, args.parentType, args.parentId);
    if (!conversation) {
      return null;
    }

    assertParticipant(conversation, args.viewerWallet);
    return conversation;
  },
});

export const getConversationsForCurrentWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const [asClient, asFreelancer] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_clientWallet", (q) => q.eq("clientWallet", walletAddress))
        .order("desc")
        .take(100),
      ctx.db
        .query("conversations")
        .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", walletAddress))
        .order("desc")
        .take(100),
    ]);

    const conversations = new Map<string, (typeof asClient)[number]>();
    for (const conversation of [...asClient, ...asFreelancer]) {
      if (conversation.participantWallets.includes(walletAddress)) {
        conversations.set(conversation._id, conversation);
      }
    }

    return Array.from(conversations.values()).sort(
      (left, right) => right.updatedAt - left.updatedAt,
    );
  },
});

export const getMessagesForConversation = query({
  args: {
    conversationId: v.id("conversations"),
    viewerWallet: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const conversation = await getConversationOrThrow(ctx, args.conversationId);
    const viewerWallet = assertParticipant(conversation, args.viewerWallet);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .take(limit);

    const visibleMessages = messages.filter((message) => message.status !== "hidden");
    const withAttachments = await Promise.all(
      visibleMessages.map((message) => withMessageAttachments(ctx, message, viewerWallet)),
    );

    return withAttachments.filter((message) => message !== null);
  },
});

export const getUnreadConversationCount = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const [asClient, asFreelancer] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_clientWallet", (q) => q.eq("clientWallet", walletAddress))
        .take(100),
      ctx.db
        .query("conversations")
        .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", walletAddress))
        .take(100),
    ]);

    const byId = new Map<string, (typeof asClient)[number]>();
    for (const conversation of [...asClient, ...asFreelancer]) {
      if (conversation.participantWallets.includes(walletAddress)) {
        byId.set(conversation._id, conversation);
      }
    }
    let unread = 0;
    for (const conversation of byId.values()) {
      const read = await ctx.db
        .query("conversationReads")
        .withIndex("by_conversation_wallet", (q) =>
          q.eq("conversationId", conversation._id).eq("walletAddress", walletAddress),
        )
        .first();
      if (
        conversation.lastMessageAt !== undefined &&
        (!read || conversation.lastMessageAt > read.lastReadAt)
      ) {
        unread += 1;
      }
    }

    return unread;
  },
});

export const getConversationParticipants = query({
  args: {
    conversationId: v.id("conversations"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await getConversationOrThrow(ctx, args.conversationId);
    assertParticipant(conversation, args.viewerWallet);

    return {
      participantWallets: conversation.participantWallets,
      participantWalletTypes: conversation.participantWalletTypes ?? [],
      clientWallet: conversation.clientWallet,
      freelancerWallet: conversation.freelancerWallet,
    };
  },
});
