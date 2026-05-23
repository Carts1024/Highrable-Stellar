"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import {
  AttachmentFileIcon,
  AttachmentTypeBadge,
  AttachmentUploader,
} from "@/features/attachments/components";
import { formatAttachmentSize } from "@/features/attachments/lib";
import { getReadableChatError } from "@/features/chat/lib/errors";
import { sanitizeMultilineInput, showWarningToast } from "@/features/common";
import { api } from "@repo/convex-client";
import { HighrableV2Badge, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_BUTTON_PRIMARY_CLASS,
  V2_GRADIENT_TEXT_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
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
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CircleDot,
  ExternalLink,
  Loader2,
  MessageCircle,
  Paperclip,
  Reply,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

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
  senderProfile?: TMessageSenderProfile | null;
};

type TMessageAttachment = TMessageWithAttachments["attachments"][number];

type TMessageSenderProfile = {
  walletAddress: string;
  displayName: string;
  avatarUrl?: string;
};

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
  "_id" | "body" | "senderRole" | "senderWallet" | "attachmentIds" | "senderProfile"
>;

const MAX_MESSAGE_BODY_LENGTH = 4000;
const MAX_REPLY_PREVIEW_LENGTH = 86;

const TMessageBodySchema = z
  .string()
  .max(MAX_MESSAGE_BODY_LENGTH, `Message must be ${MAX_MESSAGE_BODY_LENGTH} characters or fewer.`)
  .transform(sanitizeMultilineInput);

type TComposerValidationResult =
  | {
      isValid: true;
      body: string;
    }
  | {
      isValid: false;
      error: string;
    };

function validateComposerPayload(input: {
  body: string;
  readyAttachmentCount: number;
}): TComposerValidationResult {
  const parsedBody = TMessageBodySchema.safeParse(input.body);
  if (!parsedBody.success) {
    return {
      isValid: false,
      error: parsedBody.error.issues[0]?.message ?? "Message is invalid.",
    };
  }

  if (parsedBody.data.length === 0 && input.readyAttachmentCount === 0) {
    return {
      isValid: false,
      error: "Write a message or attach a file before sending.",
    };
  }

  return {
    isValid: true,
    body: parsedBody.data,
  };
}

function getReplyPreview(message: TReplyTarget): string {
  const body = message.body.trim().replace(/\s+/g, " ");
  if (body.length > 0) {
    return body.length > MAX_REPLY_PREVIEW_LENGTH
      ? `${body.slice(0, MAX_REPLY_PREVIEW_LENGTH - 3)}...`
      : body;
  }

  if (message.attachmentIds.length > 0) {
    return `${message.attachmentIds.length} attachment${message.attachmentIds.length === 1 ? "" : "s"}`;
  }

  return "Message";
}

function formatMessageTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function getSenderLabel(message: TMessageWithAttachments, isOwnMessage: boolean): string {
  if (message.senderProfile?.displayName) {
    return message.senderProfile.displayName;
  }

  if (isOwnMessage) {
    return "You";
  }
  return message.senderRole === "client" ? "Client" : "Freelancer";
}

function getReplySenderLabel(message: TReplyTarget): string {
  return (
    message.senderProfile?.displayName ??
    (message.senderRole === "client" ? "Client" : "Freelancer")
  );
}

function getSafeAvatarUrl(avatarUrl: string | undefined): string | undefined {
  const sanitizedUrl = avatarUrl?.trim();

  if (!sanitizedUrl) {
    return undefined;
  }

  if (sanitizedUrl.startsWith("/")) {
    return sanitizedUrl;
  }

  try {
    const parsedUrl = new URL(sanitizedUrl);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
      ? parsedUrl.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function shouldShowDateDivider(
  message: TMessageWithAttachments,
  previousMessage?: TMessageWithAttachments,
): boolean {
  if (!previousMessage) {
    return true;
  }

  return (
    new Date(message.createdAt).toDateString() !==
    new Date(previousMessage.createdAt).toDateString()
  );
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
    <HighrableV2Badge className="px-2 py-0 text-[0.55rem]">
      {walletType === "passkey_smart_account" ? "Passkey" : "Wallet"}
    </HighrableV2Badge>
  );
}

function SystemMessage({ message }: { message: TMessageWithAttachments }) {
  return (
    <div className="mx-auto flex max-w-[88%] items-center gap-2 border border-orange-200 bg-orange-50 px-3 py-2 text-center">
      <CircleDot className="h-3.5 w-3.5 shrink-0 text-[#E85D00]" aria-hidden="true" />
      <div className="min-w-0 text-left">
        <p className="text-xs leading-snug font-medium text-[#7a3500]">{message.body}</p>
        <p className="mt-0.5 font-mono text-[0.58rem] tracking-[0.04em] text-[#a05a20] uppercase">
          {formatMessageTimestamp(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function MessageAvatar({
  avatarUrl,
  isOwnMessage,
  label,
}: {
  avatarUrl?: string;
  isOwnMessage: boolean;
  label: string;
}) {
  const safeAvatarUrl = getSafeAvatarUrl(avatarUrl);

  return (
    <Avatar
      className={cn(
        "h-8 w-8 shrink-0 rounded-none border",
        isOwnMessage
          ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
          : "border-orange-200 bg-orange-50 text-[#B94A00]",
      )}
      aria-label={`${label} avatar`}
    >
      {safeAvatarUrl ? <AvatarImage src={safeAvatarUrl} alt={`${label} avatar`} /> : null}
      <AvatarFallback
        className={cn(
          "rounded-none",
          isOwnMessage ? "bg-[#0a0a0a] text-white" : "bg-orange-50 text-[#B94A00]",
        )}
      >
        <UserRound className="h-4 w-4" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  );
}

function DateDivider({ timestamp }: { timestamp: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <p className="font-mono text-[0.62rem] tracking-[0.08em] whitespace-nowrap text-[#7f7f7f] uppercase">
        {new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(new Date(timestamp))}
      </p>
      <div className="h-px flex-1 bg-border" />
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
      <figure className="overflow-hidden border border-border bg-white">
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
      <figure className="overflow-hidden border border-border bg-white">
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
      className={`flex items-center gap-2 border px-3 py-2 ${
        isOwnMessage
          ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
          : "border-[#e8e8e8] bg-white text-[#0a0a0a] hover:border-[#FF7003]/70"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center border ${
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
      className={`mb-2 border-l-2 py-1.5 pr-2 pl-2 ${
        isOwnMessage
          ? "border-white/60 bg-white/10 text-white/85"
          : "border-[#FF7003] bg-[#fff6ef] text-[#5f2a00]"
      }`}
    >
      <p className="font-mono text-[0.58rem] tracking-[0.04em] uppercase opacity-80">
        Replying to {getReplySenderLabel(replyToMessage)}
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
  const senderLabel = getSenderLabel(message, isOwnMessage);

  return (
    <div className={`flex items-end gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      {!isOwnMessage ? (
        <MessageAvatar
          avatarUrl={message.senderProfile?.avatarUrl}
          isOwnMessage={false}
          label={senderLabel}
        />
      ) : null}
      <article
        className={`group max-w-[82%] border px-3 py-2.5 shadow-sm ${
          isOwnMessage
            ? "border-[#E85D00] bg-[#FF7003] text-white"
            : "border-border bg-white text-[#0a0a0a]"
        }`}
      >
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.06em] uppercase opacity-80">
            {senderLabel}
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
          className={`mt-2 text-right font-mono text-[0.58rem] ${
            isOwnMessage ? "text-white/60" : "text-[#7f7f7f]"
          }`}
        >
          {formatMessageTimestamp(message.createdAt)}
        </p>
        {message.status !== "deleted" ? (
          <button
            type="button"
            onClick={() => onReply(message)}
            className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] transition-colors ${
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
      {isOwnMessage ? (
        <MessageAvatar
          avatarUrl={message.senderProfile?.avatarUrl}
          isOwnMessage
          label={senderLabel}
        />
      ) : null}
    </div>
  );
}

function EmptyConversationState() {
  return (
    <div className="border border-dashed border-border bg-white p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center border border-orange-200 bg-orange-50 text-[#E85D00]">
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-semibold text-[#0a0a0a]">No messages yet.</p>
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
  const sanitizedBody = sanitizeMultilineInput(body);
  const canSend = sanitizedBody.length > 0 || readyAttachmentIds.length > 0;

  const handleSend = async () => {
    if (!walletIdentity.walletAddress || !walletIdentity.walletType) {
      const nextWarning = "Missing wallet identity.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    const validatedPayload = validateComposerPayload({
      body,
      readyAttachmentCount: readyAttachmentIds.length,
    });
    if (!validatedPayload.isValid) {
      setError(validatedPayload.error);
      showWarningToast(validatedPayload.error);
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      await sendMessage({
        conversationId,
        senderWallet: walletIdentity.walletAddress,
        senderWalletType: walletIdentity.walletType,
        body: validatedPayload.body,
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
    <div className="space-y-2 border-t border-border bg-white pt-3">
      {showAttachments ? (
        <div className="max-h-72 overflow-y-auto border border-border bg-[#fafafa] p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <SectionLabel>Attachments</SectionLabel>
            <AppButton
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowAttachments(false)}
              className="h-7 w-7 rounded-none text-[#5f5f5f] hover:bg-white"
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
          className={`h-10 w-10 shrink-0 rounded-none border ${
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
            setBody(event.target.value.slice(0, MAX_MESSAGE_BODY_LENGTH));
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Write a secure work update..."
          rows={1}
          maxLength={MAX_MESSAGE_BODY_LENGTH}
          className="max-h-28 min-h-10 flex-1 resize-none rounded-none border-[#e1e1e1] bg-white px-4 py-2.5 text-sm leading-5 shadow-none focus-visible:ring-[#FF7003]/30"
        />
        <AppButton
          type="button"
          disabled={disabled || isSending || hasUploadingAttachments || !canSend}
          onClick={() => void handleSend()}
          className={cn(
            V2_BUTTON_PRIMARY_CLASS,
            "h-10 w-10 shrink-0 rounded-none p-0 text-white shadow-none disabled:cursor-not-allowed disabled:opacity-60",
          )}
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
        <div className="mx-12 flex items-start gap-2 border border-[#ffd7bd] bg-[#fff7f1] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.62rem] tracking-[0.05em] text-[#a74600] uppercase">
              Replying to {getReplySenderLabel(replyToMessage)}
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
            className="h-6 w-6 shrink-0 rounded-none text-[#a74600] hover:bg-[#ffe8d8]"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </AppButton>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 px-12">
        {error ? <p className="text-sm text-red-700">{error}</p> : <span />}
        <p className="font-mono text-[0.62rem] text-[#7f7f7f]">
          {sanitizedBody.length}/{MAX_MESSAGE_BODY_LENGTH}
        </p>
      </div>
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
          className={cn(
            V2_BUTTON_PRIMARY_CLASS,
            "fixed right-5 bottom-5 z-40 h-14 rounded-none border border-[#FF7003] px-5 text-sm font-semibold text-white shadow-none",
          )}
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          Messages
        </AppButton>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-border bg-white p-0 sm:max-w-[480px]"
        aria-describedby="work-chat-description"
        showCloseButton={false}
      >
        <SheetHeader className="relative overflow-hidden border-b border-[#E85D00] bg-[#0a0a0a] p-0 text-white">
          <div className="absolute inset-0 opacity-20">
            <div className="hr-v2-grid-overlay h-full w-full" />
          </div>
          <div className="relative bg-[radial-gradient(circle_at_top_right,rgba(255,112,3,0.42),transparent_42%)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <SectionLabel className="text-white [&_span]:text-white">Messages</SectionLabel>
              <div className="flex shrink-0 items-center gap-2">
                {conversation?.status ? (
                  <Badge className="rounded-none border border-white/20 bg-white/10 px-2 py-1 font-mono text-[0.62rem] tracking-[0.06em] text-white uppercase hover:bg-white/10">
                    {conversation.status}
                  </Badge>
                ) : null}
                <SheetClose asChild>
                  <AppButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-none text-white hover:bg-white/15 hover:text-white"
                    aria-label="Close work chat"
                  >
                    <X className="h-4 w-4" />
                  </AppButton>
                </SheetClose>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-xl font-semibold text-white">
                  <span className={V2_GRADIENT_TEXT_CLASS}>{title ?? "Work chat"}</span>
                </SheetTitle>
                <SheetDescription id="work-chat-description" className="mt-1 text-xs text-white/80">
                  Client and freelancer updates for this work context.
                </SheetDescription>
              </div>
              <div className="hidden shrink-0 items-center gap-2 border border-white/15 bg-white/10 px-3 py-2 sm:flex">
                <ShieldCheck className="h-4 w-4 text-orange-200" aria-hidden="true" />
                <span className="font-mono text-[0.62rem] tracking-[0.06em] text-white/80 uppercase">
                  Participant only
                </span>
              </div>
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
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f5f5f5] p-4">
                {messages.length === 0 ? (
                  <EmptyConversationState />
                ) : (
                  messages.map((message, index) => (
                    <div key={message._id} className="space-y-3">
                      {shouldShowDateDivider(message, messages[index - 1]) ? (
                        <DateDivider timestamp={message.createdAt} />
                      ) : null}
                      <MessageBubble
                        message={message}
                        currentWallet={viewerWallet}
                        replyToMessage={
                          message.replyToMessageId
                            ? (messagesById.get(message.replyToMessageId) ?? null)
                            : null
                        }
                        onReply={setReplyToMessage}
                      />
                    </div>
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
