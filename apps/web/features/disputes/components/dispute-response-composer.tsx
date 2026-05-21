"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { AttachmentUploader } from "@/features/attachments/components";
import { getReadableAttachmentError } from "@/features/attachments/lib";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import { useState } from "react";

import type { TDraftAttachment } from "@/features/attachments/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";

function getReadyAttachmentIds(attachments: TDraftAttachment[]): TConvexId<"attachments">[] {
  return attachments
    .filter((attachment) => attachment.status === "ready")
    .map((attachment) => attachment.id as TConvexId<"attachments">);
}

export function DisputeResponseComposer({ dispute }: { readonly dispute: TConvexDoc<"disputes"> }) {
  const walletIdentity = useHighrableWalletIdentity();
  const addResponse = useMutation(api.disputes.addDisputeResponse);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<TDraftAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerRole =
    walletIdentity.walletAddress?.toUpperCase() === dispute.clientWallet.toUpperCase()
      ? "client"
      : "freelancer";
  const hasUploadingAttachment = attachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const canSubmit =
    Boolean(walletIdentity.walletAddress) &&
    Boolean(walletIdentity.walletType) &&
    message.trim().length > 0 &&
    !hasUploadingAttachment;

  const handleSubmit = async () => {
    if (!walletIdentity.walletAddress || !walletIdentity.walletType) {
      setError("Missing wallet identity.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await addResponse({
        disputeId: dispute._id,
        responderWallet: walletIdentity.walletAddress,
        responderWalletType: walletIdentity.walletType,
        message,
        attachmentIds: getReadyAttachmentIds(attachments),
      });
      setMessage("");
      setAttachments([]);
    } catch (error) {
      setError(getReadableAttachmentError(error, "Response could not be added."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-[#e8e8e8] bg-white p-4">
      <p className="font-mono text-xs text-[#5f5f5f] uppercase">Add response</p>
      <Textarea
        value={message}
        disabled={isSubmitting}
        onChange={(event) => setMessage(event.target.value)}
        className="min-h-28 rounded-lg border-[#d8d8d8]"
        placeholder="Add a concise response for the dispute timeline."
      />
      <AttachmentUploader
        value={attachments}
        onChange={setAttachments}
        disabled={isSubmitting}
        ownerRole={ownerRole}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <AppButton
        type="button"
        disabled={!canSubmit || isSubmitting}
        onClick={() => void handleSubmit()}
        className="disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Adding..." : "Add Response"}
      </AppButton>
    </div>
  );
}
