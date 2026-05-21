"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { submitWorkOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { toBytesN32Hash } from "@/core/stellar/hashes";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AttachmentList, AttachmentUploader } from "@/features/attachments/components";
import { getReadableAttachmentError } from "@/features/attachments/lib";
import { DeadlineBadge } from "@/features/deadlines";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import {
  buildNormalizedProofManifest,
  hashProofManifest,
  normalizeSubmissionNotes,
} from "@/features/work-submissions/lib/proof-hash";
import { api } from "@repo/convex-client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Check, GitPullRequest, RotateCcw, Send } from "lucide-react";
import { useMemo, useState } from "react";

import type { TDraftAttachment } from "@/features/attachments/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";

interface IWorkProofSubmissionPanelProps {
  readonly job: TConvexDoc<"jobs">;
  readonly escrow: TConvexDoc<"escrows"> | null | undefined;
  readonly milestone?: TConvexDoc<"milestones"> | null;
}

function formatDate(value?: number): string {
  return value ? new Date(value).toLocaleString() : "Pending";
}

function getReadyAttachmentIds(attachments: TDraftAttachment[]) {
  return attachments
    .filter((attachment) => attachment.status === "ready")
    .map((attachment) => attachment.id as TConvexId<"attachments">);
}

function getStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function formatRevisionPolicy(input?: {
  revisionPolicy: "none" | "fixed" | "unlimited";
  revisionLimit: number | null;
  revisionCount: number;
  remainingRevisions: number | null;
}): string {
  if (!input || input.revisionPolicy === "fixed") {
    const limit = input?.revisionLimit ?? 2;
    const count = input?.revisionCount ?? 0;
    return `${count} of ${limit} revisions used`;
  }
  if (input.revisionPolicy === "unlimited") {
    return "Unlimited revisions";
  }

  return "No revisions allowed";
}

export function WorkProofSubmissionPanel({
  job,
  escrow,
  milestone,
}: IWorkProofSubmissionPanelProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const { signTransaction } = useWallet();
  const [notes, setNotes] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<TDraftAttachment[]>([]);
  const [revisionReason, setRevisionReason] = useState("");
  const [requestedChanges, setRequestedChanges] = useState("");
  const [revisionAttachments, setRevisionAttachments] = useState<TDraftAttachment[]>([]);
  const [requestingRevision, setRequestingRevision] = useState(false);
  const [acceptingPreview, setAcceptingPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewerWallet = walletIdentity.walletAddress ?? undefined;
  const parentType = milestone ? "milestone" : "micro_gig";
  const parentId = milestone?._id ?? job._id;
  const submissions = useQuery(
    api.work_submissions.getSubmissionsByEscrow,
    escrow?.escrowId && viewerWallet ? { onChainEscrowId: escrow.escrowId, viewerWallet } : "skip",
  );
  const revisionPolicy = useQuery(
    api.revisions.getRevisionPolicyForParent,
    viewerWallet ? { parentType, parentId, viewerWallet } : "skip",
  );
  const activeRevision = useQuery(
    api.revisions.getActiveRevisionRequest,
    viewerWallet ? { parentType, parentId, viewerWallet } : "skip",
  );
  const revisionTimeline = useQuery(
    api.revisions.getRevisionTimeline,
    viewerWallet ? { parentType, parentId, viewerWallet } : "skip",
  );
  const agreementStatus = useQuery(api.work_agreements.getAgreementStatusForParent, {
    jobId: job._id,
  });
  const attachmentIds = getReadyAttachmentIds(draftAttachments);
  const revisionAttachmentIds = getReadyAttachmentIds(revisionAttachments);
  const attachmentDocs = useQuery(
    api.attachments.getManyByIds,
    attachmentIds.length > 0 && viewerWallet ? { attachmentIds, viewerWallet } : "skip",
  );

  const createDraft = useMutation(api.work_submissions.createWorkSubmissionDraft);
  const submitMetadata = useMutation(api.work_submissions.submitWorkProofMetadata);
  const requestRevision = useMutation(api.revisions.requestRevision);
  const acceptPreview = useMutation(api.work_submissions.acceptPreviewSubmission);
  const markAnchoring = useMutation(api.work_submissions.markSubmissionAnchoring);
  const markAnchored = useMutation(api.work_submissions.markSubmissionAnchored);
  const markFailed = useMutation(api.work_submissions.markSubmissionAnchorFailed);
  const retryAnchor = useMutation(api.work_submissions.retrySubmissionAnchor);
  const updateEscrowStatus = useMutation(api.escrows.updateEscrowStatus);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);

  const latestSubmission = submissions?.[0] ?? null;
  const latestSubmittedSubmission =
    submissions?.find(
      (submission) => submission.status !== "draft" && submission.status !== "cancelled",
    ) ?? null;
  const latestReviewSubmission =
    submissions?.find((submission) => submission.status === "submitted_for_review") ?? null;
  const acceptedSubmission =
    submissions?.find(
      (submission) =>
        submission.status === "accepted_for_final" ||
        submission.status === "anchoring" ||
        submission.status === "anchored" ||
        submission.status === "anchor_failed",
    ) ?? null;
  const isPreviewEnabled =
    revisionPolicy?.revisionPolicy === "fixed" || revisionPolicy?.revisionPolicy === "unlimited";
  const isRevisionPolicyLoading = viewerWallet !== undefined && revisionPolicy === undefined;
  const agreementAccepted =
    agreementStatus?.status === "accepted" || agreementStatus?.status === "locked";
  const canViewProof =
    walletIdentity.isConnected &&
    (isSameWallet(walletIdentity.walletAddress, escrow?.clientWallet ?? null) ||
      isSameWallet(walletIdentity.walletAddress, escrow?.freelancerWallet ?? null));
  const canSubmitOriginal =
    Boolean(escrow?.escrowId) &&
    escrow?.status === "funded" &&
    agreementAccepted &&
    !isRevisionPolicyLoading &&
    walletIdentity.isConnected &&
    isSameWallet(walletIdentity.walletAddress, escrow?.freelancerWallet ?? null);
  const canSubmitRevision =
    Boolean(escrow?.escrowId) &&
    (escrow?.status === "funded" || escrow?.status === "submitted") &&
    agreementAccepted &&
    Boolean(activeRevision) &&
    !isRevisionPolicyLoading &&
    walletIdentity.isConnected &&
    isSameWallet(walletIdentity.walletAddress, escrow?.freelancerWallet ?? null);
  const canSubmit = canSubmitOriginal || canSubmitRevision;
  const canRequestRevision =
    Boolean(latestSubmittedSubmission) &&
    Boolean(walletIdentity.walletType) &&
    walletIdentity.isConnected &&
    isSameWallet(walletIdentity.walletAddress, escrow?.clientWallet ?? job.clientWallet) &&
    !activeRevision &&
    (escrow?.status === "funded" || escrow?.status === "submitted") &&
    latestReviewSubmission !== null &&
    revisionPolicy?.revisionPolicy !== "none" &&
    (revisionPolicy?.remainingRevisions === null || (revisionPolicy?.remainingRevisions ?? 0) > 0);
  const canAcceptPreview =
    latestReviewSubmission !== null &&
    !activeRevision &&
    isPreviewEnabled &&
    walletIdentity.isConnected &&
    isSameWallet(walletIdentity.walletAddress, escrow?.clientWallet ?? job.clientWallet);
  const canAnchorAcceptedPreview =
    acceptedSubmission !== null &&
    (acceptedSubmission.status === "accepted_for_final" ||
      acceptedSubmission.status === "anchor_failed") &&
    escrow?.status === "funded" &&
    walletIdentity.isConnected &&
    isSameWallet(walletIdentity.walletAddress, escrow?.freelancerWallet ?? null);
  const hasUploadingAttachment = draftAttachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const hasProofBody = normalizeSubmissionNotes(notes).length > 0 || attachmentIds.length > 0;
  const isImmutable = Boolean(
    latestSubmission &&
    latestSubmission.status !== "draft" &&
    latestSubmission.status !== "cancelled",
  );

  const generatedPreview = useMemo(() => {
    if (!latestSubmission?.proofHash) {
      return null;
    }
    return latestSubmission.proofHash;
  }, [latestSubmission?.proofHash]);

  const anchorSubmission = async (submission: TConvexDoc<"workSubmissions">) => {
    if (!escrow?.escrowId || !walletIdentity.walletAddress || !walletIdentity.walletType) {
      throw new Error("Missing wallet identity.");
    }
    if (!submission.proofHash) {
      throw new Error("Proof hash is missing.");
    }

    const config = getRequiredEscrowActionConfig();
    const clientRequestId = `submit_work:${submission._id}:${Date.now()}`;

    await retryAnchor({
      submissionId: submission._id,
      walletAddress: walletIdentity.walletAddress,
    });
    await markAnchoring({
      submissionId: submission._id,
      walletAddress: walletIdentity.walletAddress,
    });
    await createTransaction({
      walletAddress: walletIdentity.walletAddress,
      walletType: walletIdentity.walletType,
      type: "submit_work",
      clientRequestId,
      escrowId: escrow.escrowId,
      onChainEscrowId: escrow.escrowId,
      jobId: job._id,
      ...(milestone ? { milestoneId: milestone._id } : {}),
      proofHash: submission.proofHash,
      status: "pending",
    });

    try {
      const result = await submitWorkOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: walletIdentity.walletAddress,
        signTransaction,
        walletType: walletIdentity.walletType,
        freelancer: escrow.freelancerWallet!,
        escrowId: escrow.escrowId,
        proofHash: await toBytesN32Hash(submission.proofHash),
      });

      await updateEscrowStatus({
        escrowId: escrow.escrowId,
        status: "submitted",
        txHash: result.txHash,
        txType: "submit_work",
      });
      await updateTransactionStatus({
        clientRequestId,
        txHash: result.txHash,
        status: "success",
        confirmedAt: Date.now(),
      });
      await markAnchored({
        submissionId: submission._id,
        walletAddress: walletIdentity.walletAddress,
        transactionHash: result.txHash,
        stellarExpertUrl: getTxExplorerUrl(result.txHash),
      });
    } catch (error) {
      const message = normalizeStellarError(error);
      await updateTransactionStatus({ clientRequestId, status: "failed", errorMessage: message });
      await markFailed({
        submissionId: submission._id,
        walletAddress: walletIdentity.walletAddress,
        errorMessage: message,
      });
      throw new Error("Proof metadata was saved, but on-chain anchoring failed. You can retry.");
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!escrow?.escrowId || !escrow.freelancerWallet) {
      setError("This escrow is not ready for proof submission.");
      return;
    }
    if (!walletIdentity.walletAddress || !walletIdentity.walletType) {
      setError("Missing wallet identity.");
      return;
    }
    if (!canSubmit) {
      setError(
        isRevisionPolicyLoading
          ? "Revision policy is still loading."
          : "Only the assigned freelancer can submit proof for this escrow.",
      );
      return;
    }
    if (!hasProofBody) {
      setError("Add notes or at least one attachment before submitting proof.");
      return;
    }
    if (hasUploadingAttachment || attachmentDocs === undefined) {
      setError("Wait for proof attachments to finish uploading.");
      return;
    }

    setPending(true);
    try {
      const submittedAt = Date.now();
      const config = getRequiredEscrowActionConfig();
      const draftId = await createDraft({
        onChainEscrowId: escrow.escrowId,
        submittedByWallet: walletIdentity.walletAddress,
        submittedByWalletType: walletIdentity.walletType,
        ...(activeRevision ? { revisionRequestId: activeRevision._id } : {}),
      });
      const manifest = await buildNormalizedProofManifest({
        network: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        onChainEscrowId: escrow.escrowId,
        convexEscrowId: escrow._id,
        parentType: milestone ? "milestone" : "micro_gig",
        parentId: milestone?._id ?? job._id,
        jobId: job._id,
        milestoneId: milestone?._id ?? null,
        clientWallet: escrow.clientWallet,
        freelancerWallet: escrow.freelancerWallet,
        submittedByWallet: walletIdentity.walletAddress,
        submittedByWalletType: walletIdentity.walletType,
        submittedAt,
        notes,
        attachments: attachmentDocs ?? [],
        ...(activeRevision
          ? {
              revisionContext: {
                revisionRequestId: activeRevision._id,
                revisionNumber: activeRevision.revisionNumber,
                previousSubmissionId: activeRevision.workSubmissionId,
              },
            }
          : {}),
      });
      const proofHash = await hashProofManifest(manifest);
      const submission = await submitMetadata({
        submissionId: draftId,
        submittedByWallet: walletIdentity.walletAddress,
        notes,
        attachmentIds,
        normalizedManifest: manifest,
        proofHash,
        submittedAt,
      });

      if (activeRevision || isPreviewEnabled) {
        setNotes("");
        setDraftAttachments([]);
        return;
      }

      await anchorSubmission(submission);
      setNotes("");
      setDraftAttachments([]);
    } catch (error) {
      setError(getReadableAttachmentError(error, "Proof submission failed."));
    } finally {
      setPending(false);
    }
  };

  const handleAcceptPreview = async () => {
    setError(null);
    if (!latestReviewSubmission || !walletIdentity.walletAddress) {
      setError("No submitted preview is available to accept.");
      return;
    }

    setAcceptingPreview(true);
    try {
      await acceptPreview({
        submissionId: latestReviewSubmission._id,
        clientWallet: walletIdentity.walletAddress,
      });
    } catch (error) {
      setError(getReadableAttachmentError(error, "Preview acceptance failed."));
    } finally {
      setAcceptingPreview(false);
    }
  };

  const handleRequestRevision = async () => {
    setError(null);
    if (!latestReviewSubmission || !walletIdentity.walletAddress || !walletIdentity.walletType) {
      setError("Client cannot request revision before proof is submitted.");
      return;
    }
    if (!requestedChanges.trim()) {
      setError("Add requested changes before sending the revision request.");
      return;
    }
    if (revisionAttachments.some((attachment) => attachment.status === "uploading")) {
      setError("Wait for revision attachments to finish uploading.");
      return;
    }

    setRequestingRevision(true);
    try {
      await requestRevision({
        parentType,
        parentId,
        workSubmissionId: latestReviewSubmission._id,
        clientWallet: walletIdentity.walletAddress,
        requestedByWalletType: walletIdentity.walletType,
        reason: revisionReason || "Revision requested",
        requestedChanges,
        attachmentIds: revisionAttachmentIds,
      });
      setRevisionReason("");
      setRequestedChanges("");
      setRevisionAttachments([]);
    } catch (error) {
      setError(getReadableAttachmentError(error, "Revision request failed."));
    } finally {
      setRequestingRevision(false);
    }
  };

  const handleRetry = async (submission: TConvexDoc<"workSubmissions">) => {
    setPending(true);
    setError(null);
    try {
      await anchorSubmission(submission);
    } catch (error) {
      setError(getReadableAttachmentError(error, "Proof anchoring retry failed."));
    } finally {
      setPending(false);
    }
  };

  const submitButtonLabel = canSubmitRevision
    ? "Submit Revision Preview"
    : isPreviewEnabled
      ? "Submit Preview"
      : "Submit Proof";

  return (
    <section className="space-y-4 rounded-lg border border-[#e8e8e8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0a0a0a]">Proof of Work</h3>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Files stay in Convex storage. Accepted proof hashes are anchored on Stellar.
          </p>
        </div>
        {walletIdentity.walletType ? (
          <Badge variant="secondary" className="rounded-md">
            {walletIdentity.walletType.replace(/_/g, " ")}
          </Badge>
        ) : null}
      </div>

      {!agreementAccepted ? (
        <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {agreementStatus?.status === "pending_acceptance"
            ? "The selected freelancer must accept the agreement before proof can be submitted."
            : agreementStatus?.status === "rejected"
              ? "This agreement was rejected. Create a new agreement before continuing."
              : "A work agreement must be accepted before proof can be submitted."}
        </div>
      ) : null}

      <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
        <p className="font-mono text-xs text-[#7f7f7f] uppercase">Revision policy</p>
        <p className="mt-1 text-sm font-medium text-[#0a0a0a]">
          {formatRevisionPolicy(revisionPolicy ?? undefined)}
        </p>
        {activeRevision ? (
          <p className="mt-2 text-sm text-[#5f5f5f]">
            Active Revision #{activeRevision.revisionNumber}: {activeRevision.requestedChanges}
          </p>
        ) : null}
      </div>

      {canSubmit && (!isImmutable || canSubmitRevision) ? (
        <div className="space-y-3">
          <DeadlineBadge
            deadlineAt={milestone?.deadlineAt ?? job.deadlineAt}
            submittedAt={milestone?.submittedAt ?? job.submittedAt}
            completedAt={milestone?.completedAt ?? job.completedAt}
            approvedAt={milestone?.approvedAt ?? job.approvedAt}
            escrowStatus={escrow?.status}
            workStatus={milestone?.status ?? job.status}
          />
          <Textarea
            value={notes}
            disabled={pending}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={
              canSubmitRevision
                ? "Summarize the revised work and what changed from the previous submission."
                : "Summarize completed work, delivery notes, links, or acceptance details."
            }
            className="min-h-28 rounded-lg border-[#d8d8d8] bg-white"
          />
          <AttachmentUploader
            value={draftAttachments}
            onChange={setDraftAttachments}
            disabled={pending}
            ownerRole="freelancer"
          />
          <div className="flex flex-wrap items-center gap-2">
            <AppButton
              type="button"
              disabled={
                pending || isRevisionPolicyLoading || hasUploadingAttachment || !hasProofBody
              }
              onClick={() => void handleSubmit()}
              className="gap-2 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {pending
                ? canSubmitRevision
                  ? "Submitting Revision Preview..."
                  : isPreviewEnabled
                    ? "Submitting Preview..."
                    : "Submitting Proof..."
                : submitButtonLabel}
            </AppButton>
            <p className="font-mono text-xs text-[#7f7f7f]">
              {attachmentIds.length} attachment{attachmentIds.length === 1 ? "" : "s"} ready
            </p>
          </div>
        </div>
      ) : null}

      {canAcceptPreview ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e8e8e8] bg-[#fffaf5] p-3">
          <div>
            <h4 className="text-sm font-semibold text-[#0a0a0a]">Preview ready for review</h4>
            <p className="mt-1 text-sm text-[#5f5f5f]">
              Accepting locks this proof hash as the final version the freelancer can submit
              on-chain.
            </p>
          </div>
          <AppButton
            type="button"
            disabled={acceptingPreview}
            onClick={() => void handleAcceptPreview()}
            className="gap-2 disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {acceptingPreview ? "Accepting..." : "Accept as Final"}
          </AppButton>
        </div>
      ) : null}

      {canAnchorAcceptedPreview && acceptedSubmission ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e8e8e8] bg-[#f7fff9] p-3">
          <div>
            <h4 className="text-sm font-semibold text-[#0a0a0a]">Final proof accepted</h4>
            <p className="mt-1 text-sm text-[#5f5f5f]">
              Submit the accepted preview hash on-chain to start client release review.
            </p>
          </div>
          <AppButton
            type="button"
            disabled={pending}
            onClick={() => void handleRetry(acceptedSubmission)}
            className="gap-2 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {pending ? "Submitting On-Chain..." : "Submit Final On-Chain"}
          </AppButton>
        </div>
      ) : null}

      {canRequestRevision ? (
        <div className="space-y-3 rounded-lg border border-[#e8e8e8] bg-white p-3">
          <div>
            <h4 className="text-sm font-semibold text-[#0a0a0a]">Request revision</h4>
            <p className="mt-1 text-sm text-[#5f5f5f]">
              This creates a structured revision request and notifies the freelancer.
            </p>
          </div>
          <Textarea
            value={revisionReason}
            disabled={requestingRevision}
            onChange={(event) => setRevisionReason(event.target.value)}
            placeholder="Short reason"
            className="min-h-20 rounded-lg border-[#d8d8d8] bg-white"
          />
          <Textarea
            value={requestedChanges}
            disabled={requestingRevision}
            onChange={(event) => setRequestedChanges(event.target.value)}
            placeholder="Requested changes"
            className="min-h-28 rounded-lg border-[#d8d8d8] bg-white"
          />
          <AttachmentUploader
            value={revisionAttachments}
            onChange={setRevisionAttachments}
            disabled={requestingRevision}
            ownerRole="client"
          />
          <AppButton
            type="button"
            disabled={requestingRevision || !requestedChanges.trim()}
            onClick={() => void handleRequestRevision()}
            className="gap-2 disabled:opacity-60"
          >
            <GitPullRequest className="h-4 w-4" />
            {requestingRevision ? "Sending..." : "Request Revision"}
          </AppButton>
        </div>
      ) : latestSubmittedSubmission &&
        walletIdentity.isConnected &&
        isSameWallet(walletIdentity.walletAddress, escrow?.clientWallet ?? job.clientWallet) ? (
        <p className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3 text-sm text-[#5f5f5f]">
          {activeRevision
            ? "There is already an active revision request."
            : revisionPolicy?.revisionPolicy === "none"
              ? "This work does not allow revisions."
              : revisionPolicy?.remainingRevisions === 0
                ? "The revision limit has already been reached."
                : escrow?.status === "funded" || escrow?.status === "submitted"
                  ? "Revision request is unavailable."
                  : "Revisions can be requested after submitted work is ready for review."}
        </p>
      ) : null}

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {canViewProof && submissions === undefined ? (
        <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
          Loading proof submission...
        </p>
      ) : null}

      {canViewProof && submissions !== undefined && !latestSubmission && !canSubmit ? (
        <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
          No proof submission has been saved for this escrow yet.
        </p>
      ) : null}

      {latestSubmission ? (
        <div className="space-y-3 rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge className="rounded-md bg-[#0a0a0a] text-white hover:bg-[#0a0a0a]">
              {getStatusLabel(latestSubmission.status)}
            </Badge>
            {latestSubmission.status === "anchor_failed" &&
            (canSubmit || canAnchorAcceptedPreview) ? (
              <AppButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => void handleRetry(latestSubmission)}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retry anchoring
              </AppButton>
            ) : null}
          </div>
          {latestSubmission.notes ? (
            <p className="text-sm whitespace-pre-wrap text-[#3f3f3f]">{latestSubmission.notes}</p>
          ) : null}
          <AttachmentList attachments={latestSubmission.attachments ?? []} readOnly />
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#7f7f7f]">Proof hash</dt>
              <dd className="font-mono text-xs break-all text-[#0a0a0a]">
                {generatedPreview ?? "Pending"}
              </dd>
            </div>
            <div>
              <dt className="text-[#7f7f7f]">Submitted</dt>
              <dd className="text-[#0a0a0a]">{formatDate(latestSubmission.submittedAt)}</dd>
            </div>
            <div>
              <dt className="text-[#7f7f7f]">Transaction</dt>
              <dd className="font-mono text-xs break-all text-[#0a0a0a]">
                {latestSubmission.stellarExpertUrl ? (
                  <a href={latestSubmission.stellarExpertUrl} target="_blank" rel="noreferrer">
                    {latestSubmission.transactionHash}
                  </a>
                ) : (
                  (latestSubmission.transactionHash ?? "Pending")
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[#7f7f7f]">Hash</dt>
              <dd className="font-mono text-xs text-[#0a0a0a]">
                {latestSubmission.hashAlgorithm}/{latestSubmission.hashEncoding}
              </dd>
            </div>
            <div>
              <dt className="text-[#7f7f7f]">Deadline status</dt>
              <dd className="text-[#0a0a0a]">
                {latestSubmission.deadlineStatus?.replace(/_/g, " ") ?? "Not recorded"}
              </dd>
            </div>
          </dl>
          {latestSubmission.anchorErrorMessage ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {latestSubmission.anchorErrorMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {revisionTimeline && revisionTimeline.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-[#e8e8e8] bg-white p-3">
          <h4 className="text-sm font-semibold text-[#0a0a0a]">Revision Timeline</h4>
          {revisionTimeline.map((event) => (
            <div
              key={`${event.kind}-${event.at}-${
                event.submission?._id ?? event.revision?._id ?? "event"
              }`}
              className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary" className="rounded-md">
                  {event.kind === "submission"
                    ? event.submission?.revisionRequestId
                      ? "revised submission"
                      : "original submission"
                    : "revision request"}
                </Badge>
                <span className="text-xs text-[#7f7f7f]">{formatDate(event.at)}</span>
              </div>
              {event.kind === "submission" ? (
                <p className="mt-2 font-mono text-xs break-all text-[#0a0a0a]">
                  {event.submission?.proofHash ?? "Proof hash pending"}
                </p>
              ) : (
                <p className="mt-2 text-sm text-[#3f3f3f]">
                  Revision #{event.revision?.revisionNumber}: {event.revision?.requestedChanges}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
