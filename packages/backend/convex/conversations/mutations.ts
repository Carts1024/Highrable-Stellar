import { v } from "convex/values";

import { internalMutation, mutation } from "../_generated/server";
import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress } from "../_shared/input";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanAttachToMessage,
  assertCanSendMessage,
  assertParticipant,
  buildMessagePreview,
  createSystemMessageForEvent,
  getConversationByParent,
  getConversationOrThrow,
  getParticipantWallets,
  resolveConversationParticipants,
  validateMessagePayload,
} from "./helpers";
import { conversationParentTypeValidator, messageEventTypeValidator } from "./schema";

export const getOrCreateConversationForParent = mutation({
  args: {
    parentType: conversationParentTypeValidator,
    parentId: v.string(),
    walletAddress: v.string(),
    walletType: v.optional(walletTypeValidator),
    title: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const existing = await getConversationByParent(ctx, args.parentType, args.parentId);
    if (existing) {
      assertParticipant(existing, walletAddress);
      return existing._id;
    }

    const resolved = await resolveConversationParticipants(ctx, args);
    if (!resolved.participants.some((participant) => participant.walletAddress === walletAddress)) {
      throw new ForbiddenError("Only the client and assigned freelancer can use this chat.");
    }

    const participantWallets = getParticipantWallets(resolved.participants);
    const now = Date.now();
    return await ctx.db.insert("conversations", {
      parentType: resolved.parentType,
      parentId: resolved.parentId,
      ...(resolved.jobId !== undefined ? { jobId: resolved.jobId } : {}),
      ...(resolved.microGigId !== undefined ? { microGigId: resolved.microGigId } : {}),
      ...(resolved.milestoneId !== undefined ? { milestoneId: resolved.milestoneId } : {}),
      ...(resolved.escrowId !== undefined ? { escrowId: resolved.escrowId } : {}),
      ...(resolved.workSubmissionId !== undefined
        ? { workSubmissionId: resolved.workSubmissionId }
        : {}),
      ...(resolved.disputeId !== undefined ? { disputeId: resolved.disputeId } : {}),
      participantWallets,
      participantWalletTypes: resolved.participants.map((participant) => ({
        walletAddress: participant.walletAddress,
        ...(participant.walletAddress === walletAddress && args.walletType !== undefined
          ? { walletType: args.walletType }
          : participant.walletType !== undefined
            ? { walletType: participant.walletType }
            : {}),
      })),
      ...(resolved.clientWallet !== undefined ? { clientWallet: resolved.clientWallet } : {}),
      ...(resolved.freelancerWallet !== undefined
        ? { freelancerWallet: resolved.freelancerWallet }
        : {}),
      ...(args.title?.trim()
        ? { title: args.title.trim().slice(0, 160) }
        : resolved.title
          ? { title: resolved.title }
          : {}),
      status: "active",
      createdByWallet: walletAddress,
      ...(args.walletType !== undefined ? { createdByWalletType: args.walletType } : {}),
      createdAt: now,
      updatedAt: now,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderWallet: v.string(),
    senderWalletType: walletTypeValidator,
    body: v.string(),
    attachmentIds: v.array(v.id("attachments")),
    replyToMessageId: v.optional(v.id("messages")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const conversation = await getConversationOrThrow(ctx, args.conversationId);
    const sender = assertCanSendMessage(conversation, args.senderWallet);
    const body = validateMessagePayload({
      body: args.body,
      attachmentIds: args.attachmentIds,
    });
    if (args.replyToMessageId !== undefined) {
      const repliedMessage = await ctx.db.get(args.replyToMessageId);
      if (
        !repliedMessage ||
        repliedMessage.conversationId !== conversation._id ||
        repliedMessage.status === "hidden"
      ) {
        throw new BadRequestError("The message you are replying to is no longer available.");
      }
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: conversation._id,
      parentType: conversation.parentType,
      parentId: conversation.parentId,
      senderWallet: sender.walletAddress,
      senderWalletType: args.senderWalletType,
      senderRole: sender.senderRole,
      kind: "user",
      body,
      attachmentIds: args.attachmentIds,
      ...(args.replyToMessageId !== undefined ? { replyToMessageId: args.replyToMessageId } : {}),
      status: "sent",
      createdAt: now,
      updatedAt: now,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });

    try {
      await assertCanAttachToMessage(ctx, {
        attachmentIds: args.attachmentIds,
        walletAddress: sender.walletAddress,
        messageId,
      });
    } catch (error) {
      await ctx.db.patch(messageId, {
        status: "hidden",
        updatedAt: Date.now(),
        metadata: { sendError: "attachment_link_failed" },
      });
      throw error;
    }

    await ctx.db.patch(conversation._id, {
      lastMessageId: messageId,
      lastMessagePreview: buildMessagePreview({
        body,
        attachmentCount: args.attachmentIds.length,
      }),
      lastMessageAt: now,
      updatedAt: now,
    });

    return messageId;
  },
});

export const markConversationRead = mutation({
  args: {
    conversationId: v.id("conversations"),
    walletAddress: v.string(),
    walletType: v.optional(walletTypeValidator),
    lastReadMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const conversation = await getConversationOrThrow(ctx, args.conversationId);
    const walletAddress = assertParticipant(conversation, args.walletAddress);
    const now = Date.now();

    const existing = await ctx.db
      .query("conversationReads")
      .withIndex("by_conversation_wallet", (q) =>
        q.eq("conversationId", args.conversationId).eq("walletAddress", walletAddress),
      )
      .first();

    const patch = {
      ...(args.walletType !== undefined ? { walletType: args.walletType } : {}),
      ...(args.lastReadMessageId !== undefined
        ? { lastReadMessageId: args.lastReadMessageId }
        : {}),
      lastReadAt: now,
      unreadCountSnapshot: 0,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("conversationReads", {
      conversationId: args.conversationId,
      walletAddress,
      ...patch,
    });
  },
});

export const softDeleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new NotFoundError("Message not found.");
    }
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    if (message.senderWallet !== walletAddress) {
      throw new ForbiddenError("You can only delete your own messages.");
    }
    if (message.kind !== "user") {
      throw new BadRequestError("System messages cannot be deleted.");
    }

    await ctx.db.patch(args.messageId, {
      status: "deleted",
      body: "",
      updatedAt: Date.now(),
    });

    return true;
  },
});

export const sendSystemMessage = internalMutation({
  args: {
    parentType: conversationParentTypeValidator,
    parentId: v.string(),
    eventType: messageEventTypeValidator,
    body: v.optional(v.string()),
    eventPayload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await createSystemMessageForEvent(ctx, {
      parentType: args.parentType,
      parentId: args.parentId,
      eventType: args.eventType,
      ...(args.body !== undefined ? { body: args.body } : {}),
      eventPayload: args.eventPayload,
    });
  },
});
