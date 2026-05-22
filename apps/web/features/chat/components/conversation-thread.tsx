"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import {
  AttachmentFileIcon,
  AttachmentTypeBadge,
  AttachmentUploader,
} from "@/features/attachments/components";
import { formatAttachmentSize } from "@/features/attachments/lib";
import { getReadableChatError } from "@/features/chat/lib/errors";
import { showWarningToast } from "@/features/common";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, Loader2, MessageCircle, Paperclip, Reply, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { TDraftAttachment } from "@/features/attachments/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";
import type { KeyboardEvent } from "react";

type TConversationParentType =
  | "job"
  | "micro_gig"
  | "milestone"
  | "escrow"
  | "work_submission"
  | "dispute"
  | "direct";

interface IConversationThreadProps {
  parentType: TConversationParentType;
  parentId: string;
  title?: string;
}

type TMessageWithAttachments = TConvexDoc<"messages"> & {
  attachments: Array<TConvexDoc<"attachments"> & { url?: string | null }>;
};

type TMessageAttachment = TMessageWithAttachments["attachments"][number];

interface IMessageAttachmentListProps {
  attachments: readonly TMessageAttachment[];
  isOwnMessage: boolean;
}

interface IMessageComposerProps {
  conversationId: TConvexId<"conversations">;
  disabled?: boolean;
  senderRole: "client" | "freelancer";
  replyToMessage: TReplyTarget | null;
  onCancelReply: () => void;
}

interface IMessageBubbleProps {
  message: TMessageWithAttachments;
  currentWallet: string;
  replyToMessage: TReplyTarget | null;
  onReply: (message: TMessageWithAttachments) => void;
}

type TReplyTarget = Pick<
  TMessageWithAttachments,
  "_id" | "body" | "senderRole" | "senderWallet" | "attachmentIds"
>;

function getReplyPreview(message: TReplyTarget): string {
  const body = message.body.trim().replace(/\s+/g, " ");
  if (body.length > 0) {
    return body.length > 86 ? `${body.slice(0, 83)}...` : body;
  }

  if (message.attachmentIds.length > 0) {
    return `${message.attachmentIds.length} attachment${message.attachmentIds.length === 1 ? "" : "s"}`;
  }

  return "Message";
}

function isPreviewableImage(attachment: TMessageAttachment): boolean {
  return attachment.type === "image" && Boolean(attachment.url);
}

function isPreviewableVideo(attachment: TMessageAttachment): boolean {
  return attachment.type === "video" && Boolean(attachment.url);
}

function getAttachmentHref(attachment: TMessageAttachment): string | null {
  return attachment.externalUrl ?? attachment.url ?? null;
}

function WalletTypeBadge({ walletType }: { walletType?: string }) {
  if (!walletType || walletType === "system") {
    return null;
  }

  return (
    <Badge className="rounded-full border border-[#e8e8e8] bg-white px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.04em] text-[#5f5f5f] uppercase hover:bg-white">
      {walletType === "passkey_smart_account" ? "Passkey" : "Wallet"}
    </Badge>
  );
}

function SystemMessage({ message }: { message: TMessageWithAttachments }) {
  return (
    <div className="mx-auto max-w-[80%] rounded-full border border-[#ffe1cc] bg-[#fff8f3] px-3 py-1.5 text-center">
      <p className="text-xs font-medium text-[#7a3500]">{message.body}</p>
      <p className="mt-0.5 font-mono text-[0.6rem] tracking-[0.04em] text-[#a05a20] uppercase">
        {new Date(message.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

function InlineAttachmentPreview({
  attachment,
  isOwnMessage,
}: {
  attachment: TMessageAttachment;
  isOwnMessage: boolean;
}) {
  const href = getAttachmentHref(attachment);
  const meta = [formatAttachmentSize(attachment.size), attachment.mimeType]
    .filter(Boolean)
    .join(" · ");

  if (isPreviewableImage(attachment)) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-[#d8d8d8] bg-white">
        <img
          src={attachment.url ?? undefined}
          alt={attachment.name}
          loading="lazy"
          className="max-h-56 w-full bg-[#f7f7f7] object-contain"
        />
        <figcaption className="flex items-center justify-between gap-2 border-t border-[#e8e8e8] px-3 py-1.5">
          <span className="truncate text-xs font-medium text-[#0a0a0a]">{attachment.name}</span>
          <AttachmentTypeBadge type={attachment.type} />
        </figcaption>
      </figure>
    );
  }

  if (isPreviewableVideo(attachment)) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-[#d8d8d8] bg-white">
        {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- Chat uploads do not collect caption tracks yet. */}
        <video
          controls
          preload="metadata"
          className="max-h-56 w-full bg-black"
          aria-label={attachment.name}
        >
          <source src={attachment.url ?? undefined} type={attachment.mimeType ?? undefined} />
        </video>
        <figcaption className="flex items-center justify-between gap-2 border-t border-[#e8e8e8] px-3 py-1.5">
          <span className="truncate text-xs font-medium text-[#0a0a0a]">{attachment.name}</span>
          <AttachmentTypeBadge type={attachment.type} />
        </figcaption>
      </figure>
    );
  }

  return (
    <a
      href={href ?? undefined}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer" : undefined}
      className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${
        isOwnMessage
          ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
          : "border-[#e8e8e8] bg-white text-[#0a0a0a] hover:border-[#FF7003]/70"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          isOwnMessage ? "border-white/20 bg-white/10" : "border-[#e8e8e8] bg-[#fafafa]"
        }`}
      >
        <AttachmentFileIcon type={attachment.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{attachment.name}</span>
        <span
          className={`mt-0.5 block font-mono text-[0.68rem] ${isOwnMessage ? "text-white/60" : "text-[#7f7f7f]"}`}
        >
          {meta || "Link"}
        </span>
      </span>
      {href ? <ExternalLink className="h-4 w-4 shrink-0" /> : null}
    </a>
  );
}

function MessageAttachmentList({ attachments, isOwnMessage }: IMessageAttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment) => (
        <InlineAttachmentPreview
          key={attachment._id}
          attachment={attachment}
          isOwnMessage={isOwnMessage}
        />
      ))}
    </div>
  );
}

function ReplyPreview({
  replyToMessage,
  isOwnMessage,
}: {
  replyToMessage: TReplyTarget | null;
  isOwnMessage: boolean;
}) {
  if (!replyToMessage) {
    return null;
  }

  return (
    <div
      className={`mb-1.5 border-l-2 py-1 pr-2 pl-2 ${
        isOwnMessage
          ? "border-white/60 bg-white/10 text-white/85"
          : "border-[#FF7003] bg-[#fff6ef] text-[#5f2a00]"
      }`}
    >
      <p className="font-mono text-[0.58rem] tracking-[0.04em] uppercase opacity-80">
        Replying to {replyToMessage.senderRole} ·{" "}
        {shortenWalletAddress(replyToMessage.senderWallet)}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-snug">
        {getReplyPreview(replyToMessage)}
      </p>
    </div>
  );
}

function MessageBubble({ message, currentWallet, replyToMessage, onReply }: IMessageBubbleProps) {
  if (message.kind !== "user") {
    return <SystemMessage message={message} />;
  }

  const isOwnMessage = message.senderWallet === currentWallet.toUpperCase();

  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <article
        className={`group max-w-[78%] rounded-[1.25rem] px-3 py-2 ${
          isOwnMessage
            ? "rounded-br-md bg-[#FF7003] text-white"
            : "rounded-bl-md border border-[#ececec] bg-white text-[#0a0a0a]"
        }`}
      >
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.04em] uppercase opacity-80">
            {message.senderRole} · {shortenWalletAddress(message.senderWallet)}
          </span>
          <WalletTypeBadge walletType={message.senderWalletType} />
        </div>
        <ReplyPreview replyToMessage={replyToMessage} isOwnMessage={isOwnMessage} />
        {message.status === "deleted" ? (
          <p
            className={
              isOwnMessage ? "text-sm text-white/70 italic" : "text-sm text-[#7f7f7f] italic"
            }
          >
            Message deleted.
          </p>
        ) : message.body.trim() ? (
          <p className="text-[0.84rem] leading-snug whitespace-pre-wrap">{message.body}</p>
        ) : null}
        <MessageAttachmentList attachments={message.attachments} isOwnMessage={isOwnMessage} />
        <p
          className={`mt-1.5 text-right font-mono text-[0.58rem] ${
            isOwnMessage ? "text-white/60" : "text-[#7f7f7f]"
          }`}
        >
          {new Date(message.createdAt).toLocaleString()}
        </p>
        {message.status !== "deleted" ? (
          <button
            type="button"
            onClick={() => onReply(message)}
            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] transition-colors ${
              isOwnMessage
                ? "text-white/70 hover:bg-white/10 hover:text-white"
                : "text-[#7f7f7f] hover:bg-[#fff3eb] hover:text-[#FF7003]"
            }`}
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
        ) : null}
      </article>
    </div>
  );
}

function EmptyConversationState() {
  return (
    <div className="rounded-xl border border-dashed border-[#d8d8d8] bg-[#fafafa] p-6 text-center">
      <p className="text-sm font-semibold text-[#0a0a0a]">No messages yet.</p>
      <p className="mt-1 text-sm text-[#5f5f5f]">
        Start with a short update or attach a file for the work context.
      </p>
    </div>
  );
}

function MessageComposer({
  conversationId,
  disabled,
  senderRole,
  replyToMessage,
  onCancelReply,
}: IMessageComposerProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const sendMessage = useMutation(api.conversations.sendMessage);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<TDraftAttachment[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyAttachmentIds = useMemo(
    () =>
      attachments
        .filter((attachment) => attachment.status === "ready")
        .map((attachment) => attachment.id as TConvexId<"attachments">),
    [attachments],
  );
  const hasUploadingAttachments = attachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const canSend = body.trim().length > 0 || readyAttachmentIds.length > 0;

  const handleSend = async () => {
    if (!walletIdentity.walletAddress || !walletIdentity.walletType) {
      const nextWarning = "Missing wallet identity.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }
    if (!canSend) {
      const nextWarning = "Write a message or attach a file before sending.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      await sendMessage({
        conversationId,
        senderWallet: walletIdentity.walletAddress,
        senderWalletType: walletIdentity.walletType,
        body,
        attachmentIds: readyAttachmentIds,
        ...(replyToMessage ? { replyToMessageId: replyToMessage._id } : {}),
      });
      setBody("");
      setAttachments([]);
      setShowAttachments(false);
      onCancelReply();
    } catch (error) {
      setError(getReadableChatError(error, "One or more attachments could not be sent."));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isSending && !hasUploadingAttachments) {
        void handleSend();
      }
    }
  };

  return (
    <div className="space-y-2 border-t border-[#e8e8e8] bg-white pt-3">
      {showAttachments ? (
        <div className="max-h-72 overflow-y-auto rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="font-mono text-[0.65rem] tracking-[0.08em] text-[#7f7f7f] uppercase">
              Attachments
            </p>
            <AppButton
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowAttachments(false)}
              className="h-7 w-7 rounded-full text-[#5f5f5f] hover:bg-white"
              aria-label="Hide attachments"
            >
              <X className="h-4 w-4" />
            </AppButton>
          </div>
          <AttachmentUploader
            value={attachments}
            onChange={setAttachments}
            disabled={disabled || isSending}
            ownerRole={senderRole}
          />
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <AppButton
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isSending}
          onClick={() => setShowAttachments((current) => !current)}
          className={`h-10 w-10 shrink-0 rounded-full border ${
            showAttachments || readyAttachmentIds.length > 0
              ? "border-[#FF7003] bg-[#fff3eb] text-[#E85D00] hover:bg-[#ffe6d6]"
              : "border-[#e1e1e1] bg-white text-[#5f5f5f] hover:bg-[#fafafa]"
          }`}
          aria-label={showAttachments ? "Hide attachment uploader" : "Show attachment uploader"}
        >
          <Paperclip className="h-4 w-4" />
        </AppButton>
        <Textarea
          value={body}
          disabled={disabled || isSending}
          onChange={(event) => {
            setBody(event.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="max-h-28 min-h-10 flex-1 resize-none rounded-full border-[#e1e1e1] bg-white px-4 py-2.5 text-sm leading-5 shadow-none focus-visible:ring-[#FF7003]/30"
        />
        <AppButton
          type="button"
          disabled={disabled || isSending || hasUploadingAttachments || !canSend}
          onClick={() => void handleSend()}
          className="h-10 w-10 shrink-0 rounded-full bg-[#FF7003] p-0 text-white shadow-none hover:bg-[#E85D00] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Send message"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </AppButton>
      </div>
      {readyAttachmentIds.length > 0 && !showAttachments ? (
        <p className="px-12 text-[0.7rem] text-[#E85D00]">
          {readyAttachmentIds.length} attachment{readyAttachmentIds.length === 1 ? "" : "s"} ready
          to send.
        </p>
      ) : null}
      {replyToMessage ? (
        <div className="mx-12 flex items-start gap-2 rounded-xl border border-[#ffd7bd] bg-[#fff7f1] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.62rem] tracking-[0.05em] text-[#a74600] uppercase">
              Replying to {replyToMessage.senderRole}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#5f2a00]">
              {getReplyPreview(replyToMessage)}
            </p>
          </div>
          <AppButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancelReply}
            className="h-6 w-6 shrink-0 rounded-full text-[#a74600] hover:bg-[#ffe8d8]"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </AppButton>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function ConversationThread({ parentType, parentId, title }: IConversationThreadProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const getOrCreateConversation = useMutation(api.conversations.getOrCreateConversationForParent);
  const markConversationRead = useMutation(api.conversations.markConversationRead);
  const [conversationId, setConversationId] = useState<TConvexId<"conversations"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<TReplyTarget | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const viewerWallet = walletIdentity.walletAddress;
  const conversation = useQuery(
    api.conversations.getConversationByParent,
    viewerWallet
      ? {
          parentType,
          parentId,
          viewerWallet,
        }
      : "skip",
  );
  const activeConversationId = conversation?._id ?? conversationId;
  const messages = useQuery(
    api.conversations.getMessagesForConversation,
    activeConversationId && viewerWallet
      ? {
          conversationId: activeConversationId,
          viewerWallet,
        }
      : "skip",
  ) as TMessageWithAttachments[] | undefined;
  const messagesById = useMemo(() => {
    const byId = new Map<string, TMessageWithAttachments>();
    for (const message of messages ?? []) {
      byId.set(message._id, message);
    }
    return byId;
  }, [messages]);
  const latestMessageId = messages?.at(-1)?._id;

  useEffect(() => {
    if (conversation?._id) {
      setConversationId(conversation._id);
    }
  }, [conversation?._id]);

  useEffect(() => {
    if (!viewerWallet || !walletIdentity.walletType || activeConversationId) {
      return;
    }

    let cancelled = false;
    void getOrCreateConversation({
      parentType,
      parentId,
      walletAddress: viewerWallet,
      walletType: walletIdentity.walletType,
      ...(title ? { title } : {}),
    })
      .then((id) => {
        if (!cancelled) setConversationId(id);
      })
      .catch((error) => {
        if (!cancelled)
          setError(
            getReadableChatError(
              error,
              "Only the client and assigned freelancer can use this chat.",
            ),
          );
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeConversationId,
    getOrCreateConversation,
    parentId,
    parentType,
    title,
    viewerWallet,
    walletIdentity.walletType,
  ]);

  useEffect(() => {
    latestMessageRef.current?.scrollIntoView({ block: "end" });
  }, [activeConversationId, latestMessageId]);

  useEffect(() => {
    if (!activeConversationId || !viewerWallet) {
      return;
    }
    void markConversationRead({
      conversationId: activeConversationId,
      walletAddress: viewerWallet,
      ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
      ...(conversation?.lastMessageId ? { lastReadMessageId: conversation.lastMessageId } : {}),
    });
  }, [
    activeConversationId,
    conversation?.lastMessageId,
    markConversationRead,
    viewerWallet,
    walletIdentity.walletType,
  ]);

  const senderRole =
    viewerWallet && conversation?.clientWallet?.toUpperCase() === viewerWallet.toUpperCase()
      ? "client"
      : "freelancer";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <AppButton
          type="button"
          aria-label="Open work chat"
          className="fixed right-5 bottom-5 z-40 h-14 rounded-full border border-[#FF7003] bg-[#FF7003] px-5 text-sm font-semibold text-white shadow-none hover:border-[#E85D00] hover:bg-[#E85D00]"
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          Messages
        </AppButton>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[460px]"
        aria-describedby="work-chat-description"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-[#E85D00] bg-[#FF7003] p-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs tracking-[0.08em] text-white/75 uppercase">
                Messages
              </p>
              <SheetTitle className="mt-1 truncate text-lg font-semibold text-white">
                {title ?? "Work chat"}
              </SheetTitle>
              <SheetDescription id="work-chat-description" className="mt-1 text-xs text-white/80">
                Client and freelancer updates for this work context.
              </SheetDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {conversation?.status ? (
                <Badge className="rounded-full border border-white/20 bg-white/15 text-white hover:bg-white/15">
                  {conversation.status}
                </Badge>
              ) : null}
              <SheetClose asChild>
                <AppButton
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-white hover:bg-white/15 hover:text-white"
                  aria-label="Close work chat"
                >
                  <X className="h-4 w-4" />
                </AppButton>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {!viewerWallet ? (
            <p className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Connect the wallet assigned to this work to view messages.
            </p>
          ) : error ? (
            <p className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {error}
            </p>
          ) : !activeConversationId || messages === undefined ? (
            <p className="p-4 text-sm text-[#5f5f5f]">Loading conversation...</p>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#f3f3f5] p-4">
                {messages.length === 0 ? (
                  <EmptyConversationState />
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message._id}
                      message={message}
                      currentWallet={viewerWallet}
                      replyToMessage={
                        message.replyToMessageId
                          ? (messagesById.get(message.replyToMessageId) ?? null)
                          : null
                      }
                      onReply={setReplyToMessage}
                    />
                  ))
                )}
                <div ref={latestMessageRef} />
              </div>
              <div className="bg-white px-3 pb-3">
                <MessageComposer
                  conversationId={activeConversationId}
                  disabled={
                    conversation?.status === "locked" || conversation?.status === "archived"
                  }
                  senderRole={senderRole}
                  replyToMessage={replyToMessage}
                  onCancelReply={() => setReplyToMessage(null)}
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
