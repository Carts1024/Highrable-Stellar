import type { TDraftAttachment } from "@/features/attachments/types";
import type { TConvexId } from "@repo/convex-client";

const MAX_ATTACHMENTS = 25;
const MAX_MESSAGE_LENGTH = 4_000;

export function validateParticipantSubmission(
  kind: "evidence" | "response",
  message: string,
  attachments: readonly TDraftAttachment[],
): string | null {
  if (kind === "response" && !message.trim()) return "Enter a response before submitting.";
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return "Keep the message within 4,000 characters.";
  }
  if (kind === "evidence" && attachments.length === 0) {
    return "Add at least one evidence file or link.";
  }
  if (attachments.length > MAX_ATTACHMENTS) return "Attach 25 files or links or fewer.";
  if (attachments.some((attachment) => attachment.status !== "ready" || !attachment.id)) {
    return "Finish uploads or remove failed attachments before submitting.";
  }
  if (new Set(attachments.map((attachment) => attachment.id)).size !== attachments.length) {
    return "Remove duplicate attachments before submitting.";
  }
  return null;
}

export function getParticipantAttachmentIds(
  attachments: readonly TDraftAttachment[],
): TConvexId<"attachments">[] {
  return attachments.map((attachment) => attachment.id as TConvexId<"attachments">);
}
