"use client";

import { AttachmentUploader } from "@/features/attachments/components";
import { getReadableAttachmentError } from "@/features/attachments/lib";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import React, { useId } from "react";

import type { TParticipantComposerSession } from "./participant-action-session";
import type { TWalletType } from "@/features/attachments/types";
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
  session,
}: {
  readonly disputeId: TConvexId<"disputes">;
  readonly walletAddress: string;
  readonly walletType: TWalletType;
  readonly role: "client" | "freelancer";
  readonly session: TParticipantComposerSession;
}) {
  const addEvidence = useMutation(api.disputes.addDisputeEvidence);
  const errorId = useId();
  const { state } = session;
  const { message, attachments, isSubmitting, error } = state;

  const handleSubmit = async () => {
    const validationError = validateParticipantSubmission("evidence", message, attachments);
    if (validationError) {
      session.onErrorChange(validationError);
      return;
    }
    if (!session.beginSubmission()) return;
    try {
      await addEvidence({
        disputeId,
        actorWallet: walletAddress,
        actorWalletType: walletType,
        attachmentIds: getParticipantAttachmentIds(attachments),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      session.completeSubmission({ succeeded: true });
    } catch (caughtError) {
      session.completeSubmission({
        succeeded: false,
        error: getReadableAttachmentError(
          caughtError,
          "Evidence could not be added. Please retry.",
        ),
      });
    }
  };

  return (
    <form
      className="space-y-3 rounded-lg border border-[#e8e8e8] bg-white p-4"
      aria-describedby={error ? errorId : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <h2 className="font-mono text-xs text-[#5f5f5f] uppercase">Add evidence</h2>
      <label className="block text-sm text-[#3f3f3f]" htmlFor="dispute-evidence-message">
        Note (optional)
      </label>
      <Textarea
        id="dispute-evidence-message"
        value={message}
        maxLength={4_000}
        disabled={isSubmitting}
        aria-describedby={
          error === "Keep the message within 4,000 characters." ? errorId : undefined
        }
        aria-invalid={error === "Keep the message within 4,000 characters."}
        onChange={(event) => {
          session.onMessageChange(event.target.value);
        }}
        placeholder="Explain why these files or links matter."
      />
      <AttachmentUploader
        value={attachments}
        onChange={session.onAttachmentsChange}
        disabled={isSubmitting}
        ownerRole={role}
        context="dispute"
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <AppButton
        type="submit"
        disabled={
          isSubmitting || attachments.some((attachment) => attachment.status === "uploading")
        }
      >
        {isSubmitting ? "Adding evidence..." : "Add Evidence"}
      </AppButton>
    </form>
  );
}
