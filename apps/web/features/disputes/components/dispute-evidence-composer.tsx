"use client";

import { AttachmentUploader } from "@/features/attachments/components";
import { getReadableAttachmentError } from "@/features/attachments/lib";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import React, { useRef, useState } from "react";

import type { TDraftAttachment, TWalletType } from "@/features/attachments/types";
import type { TConvexId } from "@repo/convex-client";

import {
  getParticipantAttachmentIds,
  validateParticipantSubmission,
} from "./participant-submission";

export function DisputeEvidenceComposer({
  disputeId,
  walletAddress,
  walletType,
  role,
}: {
  readonly disputeId: TConvexId<"disputes">;
  readonly walletAddress: string;
  readonly walletType: TWalletType;
  readonly role: "client" | "freelancer";
}) {
  const addEvidence = useMutation(api.disputes.addDisputeEvidence);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<TDraftAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const handleSubmit = async () => {
    if (submitting.current) return;
    const validationError = validateParticipantSubmission("evidence", message, attachments);
    if (validationError) {
      setError(validationError);
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await addEvidence({
        disputeId,
        actorWallet: walletAddress,
        actorWalletType: walletType,
        attachmentIds: getParticipantAttachmentIds(attachments),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      setMessage("");
      setAttachments([]);
    } catch (caughtError) {
      setError(
        getReadableAttachmentError(caughtError, "Evidence could not be added. Please retry."),
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-[#e8e8e8] bg-white p-4">
      <h2 className="font-mono text-xs text-[#5f5f5f] uppercase">Add evidence</h2>
      <label className="block text-sm text-[#3f3f3f]" htmlFor="dispute-evidence-message">
        Note (optional)
      </label>
      <Textarea
        id="dispute-evidence-message"
        value={message}
        maxLength={4_000}
        disabled={isSubmitting}
        onChange={(event) => {
          setMessage(event.target.value);
          setError(null);
        }}
        placeholder="Explain why these files or links matter."
      />
      <AttachmentUploader
        value={attachments}
        onChange={setAttachments}
        disabled={isSubmitting}
        ownerRole={role}
        context="dispute"
      />
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <AppButton
        type="button"
        disabled={
          isSubmitting || attachments.some((attachment) => attachment.status === "uploading")
        }
        onClick={() => void handleSubmit()}
      >
        {isSubmitting ? "Adding evidence..." : "Add Evidence"}
      </AppButton>
    </section>
  );
}
