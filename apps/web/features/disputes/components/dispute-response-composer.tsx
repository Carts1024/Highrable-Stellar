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

export function DisputeResponseComposer({
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
  const addResponse = useMutation(api.disputes.addDisputeResponse);
  const errorId = useId();
  const { state } = session;
  const { message, attachments, isSubmitting, error } = state;

  const handleSubmit = async () => {
    const validationError = validateParticipantSubmission("response", message, attachments);
    if (validationError) {
      session.onErrorChange(validationError);
      return;
    }
    if (!session.beginSubmission()) return;
    try {
      await addResponse({
        disputeId,
        responderWallet: walletAddress,
        responderWalletType: walletType,
        message: message.trim(),
        attachmentIds: getParticipantAttachmentIds(attachments),
      });
      session.completeSubmission({ succeeded: true });
    } catch (caughtError) {
      session.completeSubmission({
        succeeded: false,
        error: getReadableAttachmentError(
          caughtError,
          "Response could not be added. Please retry.",
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
      <h2 className="font-mono text-xs text-[#5f5f5f] uppercase">Add response</h2>
      <label htmlFor="dispute-response-message" className="block text-sm text-[#3f3f3f]">
        Response
      </label>
      <Textarea
        id="dispute-response-message"
        value={message}
        maxLength={4_000}
        disabled={isSubmitting}
        aria-describedby={
          error?.startsWith("Enter a response") || error?.startsWith("Keep the message")
            ? errorId
            : undefined
        }
        aria-invalid={Boolean(
          error?.startsWith("Enter a response") || error?.startsWith("Keep the message"),
        )}
        onChange={(event) => {
          session.onMessageChange(event.target.value);
        }}
        className="min-h-28 rounded-lg border-[#d8d8d8]"
        placeholder="Add a concise response for the dispute timeline."
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
        className="disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Adding..." : "Add Response"}
      </AppButton>
    </form>
  );
}
