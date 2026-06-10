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
import { showErrorToast, showSuccessToast, showWarningToast } from "@/features/common";
import { DeadlineBadge } from "@/features/deadlines";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import {
  buildNormalizedProofManifest,
  hashProofManifest,
  normalizeSubmissionNotes,
} from "@/features/work-submissions/lib/proof-hash";
import { api } from "@repo/convex-client";
import {
  HighrableV2Bullet,
  HighrableV2Metric,
  SectionLabel,
} from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_BUTTON_SECONDARY_CLASS,
  V2_PANEL_CLASS,
  V2_THEME,
} from "@repo/ui/components/highrable/v2-theme";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@repo/ui/responsive-dialog";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Eye,
  FileCheck2,
  GitPullRequest,
  Info,
  RotateCcw,
  Send,
} from "lucide-react";
import { useState } from "react";

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

function WorkProofSubmissionDialogContent({
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

  const setWarning = (message: string) => {
    setError(message);
    showWarningToast(message);
  };

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
      setWarning("This escrow is not ready for proof submission.");
      return;
    }
    if (!walletIdentity.walletAddress || !walletIdentity.walletType) {
      setWarning("Missing wallet identity.");
      return;
    }
    if (!canSubmit) {
      setWarning(
        isRevisionPolicyLoading
          ? "Revision policy is still loading."
          : "Only the assigned freelancer can submit proof for this escrow.",
      );
      return;
    }
    if (!hasProofBody) {
      setWarning("Add notes or at least one attachment before submitting proof.");
      return;
    }
    if (hasUploadingAttachment || attachmentDocs === undefined) {
      setWarning("Wait for proof attachments to finish uploading.");
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
        showSuccessToast(
          activeRevision ? "Revision preview submitted." : "Work preview submitted.",
        );
        return;
      }

      await anchorSubmission(submission);
      setNotes("");
      setDraftAttachments([]);
      showSuccessToast("Proof submitted and anchored on Stellar.");
    } catch (error) {
      const nextError = getReadableAttachmentError(error, "Proof submission failed.");
      setError(nextError);
      showErrorToast(nextError);
    } finally {
      setPending(false);
    }
  };

  const handleAcceptPreview = async () => {
    setError(null);
    if (!latestReviewSubmission || !walletIdentity.walletAddress) {
      setWarning("No submitted preview is available to accept.");
      return;
    }

    setAcceptingPreview(true);
    try {
      await acceptPreview({
        submissionId: latestReviewSubmission._id,
        clientWallet: walletIdentity.walletAddress,
      });
      showSuccessToast("Preview accepted for final submission.");
    } catch (error) {
      const nextError = getReadableAttachmentError(error, "Preview acceptance failed.");
      setError(nextError);
      showErrorToast(nextError);
    } finally {
      setAcceptingPreview(false);
    }
  };

  const handleRequestRevision = async () => {
    setError(null);
    if (!latestReviewSubmission || !walletIdentity.walletAddress || !walletIdentity.walletType) {
      setWarning("Client cannot request revision before proof is submitted.");
      return;
    }
    if (!requestedChanges.trim()) {
      setWarning("Add requested changes before sending the revision request.");
      return;
    }
    if (revisionAttachments.some((attachment) => attachment.status === "uploading")) {
      setWarning("Wait for revision attachments to finish uploading.");
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
      showSuccessToast("Revision request sent.");
    } catch (error) {
      const nextError = getReadableAttachmentError(error, "Revision request failed.");
      setError(nextError);
      showErrorToast(nextError);
    } finally {
      setRequestingRevision(false);
    }
  };

  const handleRetry = async (submission: TConvexDoc<"workSubmissions">) => {
    setPending(true);
    setError(null);
    try {
      await anchorSubmission(submission);
      showSuccessToast("Proof anchoring retry submitted.");
    } catch (error) {
      const nextError = getReadableAttachmentError(error, "Proof anchoring retry failed.");
      setError(nextError);
      showErrorToast(nextError);
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
    <div className="space-y-10">
      <section className="grid gap-8 border-b border-[#e8e8e8] pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="space-y-5">
          <SectionLabel>Project Delivery</SectionLabel>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0a0a0a]">
            {milestone ? milestone.title : job.title}
          </h1>
          <p className={cn("max-w-2xl text-sm leading-6", V2_THEME.colors.textMuted)}>
            Your files and notes are securely stored. Finalized work is verified on the Stellar
            blockchain for trust and transparency.
          </p>
        </div>

        <div className="grid gap-5 border-l border-[#e8e8e8] py-2">
          <HighrableV2Metric
            label="Revision policy"
            value={formatRevisionPolicy(revisionPolicy ?? undefined)}
          />
          <HighrableV2Metric label="Submissions" value={submissions?.length ?? 0} />
          {walletIdentity.walletType && (
            <HighrableV2Metric
              label="Wallet Type"
              value={walletIdentity.walletType.replace(/_/g, " ")}
            />
          )}
        </div>
      </section>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-[#e8e8e8] pb-2">
          <div className="flex items-center gap-2">
            <SectionLabel>Submission Action</SectionLabel>
            {walletIdentity.isConnected &&
              isSameWallet(
                walletIdentity.walletAddress,
                escrow?.clientWallet ?? job.clientWallet,
              ) &&
              !canRequestRevision && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="p-1 text-[#7f7f7f] transition-colors hover:text-[#0a0a0a]"
                      aria-label="Revision information"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-80 rounded-none border-none bg-white p-4 text-sm shadow-xl"
                    align="start"
                  >
                    <p className="leading-relaxed text-[#5f5f5f]">
                      {activeRevision
                        ? "There is already an active revision request."
                        : revisionPolicy?.revisionPolicy === "none"
                          ? "This work does not allow revisions."
                          : revisionPolicy?.remainingRevisions === 0
                            ? "The revision limit has already been reached."
                            : escrow?.status === "funded" || escrow?.status === "submitted"
                              ? "Revision request is currently unavailable."
                              : "Revisions can be requested after work is submitted for review."}
                    </p>
                  </PopoverContent>
                </Popover>
              )}
          </div>
          <span className="font-mono text-[10px] tracking-widest text-[#7f7f7f] uppercase">
            {canSubmit ? "Freelancer Mode" : "Client Mode"}
          </span>
        </div>

        {!agreementAccepted ? (
          <div className="border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
            {agreementStatus?.status === "pending_acceptance"
              ? "The freelancer must accept the agreement before work can be submitted."
              : agreementStatus?.status === "rejected"
                ? "This agreement was rejected. Create a new agreement before continuing."
                : "A work agreement must be accepted before work can be submitted."}
          </div>
        ) : null}

        {canSubmit && (!isImmutable || canSubmitRevision) ? (
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-3">
              <DeadlineBadge
                deadlineAt={milestone?.deadlineAt ?? job.deadlineAt}
                submittedAt={milestone?.submittedAt ?? job.submittedAt}
                completedAt={milestone?.completedAt ?? job.completedAt}
                approvedAt={milestone?.approvedAt ?? job.approvedAt}
                escrowStatus={escrow?.status}
                workStatus={milestone?.status ?? job.status}
              />
            </div>
            <Textarea
              value={notes}
              disabled={pending}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                canSubmitRevision
                  ? "Summarize the revised work and what changed from the previous submission."
                  : "Summarize completed work, delivery notes, links, or acceptance details."
              }
              className="min-h-32 rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            />
            <div className="border border-[#e8e8e8] bg-[#fafafa] p-4">
              <AttachmentUploader
                value={draftAttachments}
                onChange={setDraftAttachments}
                disabled={pending}
                ownerRole="freelancer"
              />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <AppButton
                type="button"
                disabled={
                  pending || isRevisionPolicyLoading || hasUploadingAttachment || !hasProofBody
                }
                onClick={() => void handleSubmit()}
                className={cn("hr-v2-button-primary h-12 min-w-44 gap-2 rounded-none")}
              >
                {pending ? (
                  <RotateCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {pending
                  ? canSubmitRevision
                    ? "Submitting Revision..."
                    : isPreviewEnabled
                      ? "Submitting Review..."
                      : "Submitting..."
                  : submitButtonLabel}
              </AppButton>
              <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-[#7f7f7f] uppercase">
                <HighrableV2Bullet tone="muted" />
                {attachmentIds.length} attachment{attachmentIds.length === 1 ? "" : "s"} ready
              </div>
            </div>
          </div>
        ) : null}

        {canAcceptPreview && (
          <div className="group border border-[#e8e8e8] bg-white p-6 transition-colors hover:bg-[#fff7ed]/40">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Check className="h-4 w-4" />
                  Work Ready for Review
                </div>
                <h4 className="text-xl font-semibold text-[#0a0a0a]">Deliverables Accepted</h4>
                <p className="max-w-xl text-sm leading-relaxed text-[#5f5f5f]">
                  The freelancer has submitted the work. Review the files below and accept to
                  finalize the version for network recording.
                </p>
              </div>
              <AppButton
                type="button"
                disabled={acceptingPreview}
                onClick={() => void handleAcceptPreview()}
                className="hr-v2-button-primary h-11 min-w-40 rounded-none"
              >
                {acceptingPreview ? "Accepting..." : "Accept as Final"}
              </AppButton>
            </div>
          </div>
        )}

        {canAnchorAcceptedPreview && acceptedSubmission && (
          <div className="group border border-[#e8e8e8] bg-white p-6 transition-colors hover:bg-[#f7fff9]/40">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Check className="h-4 w-4" />
                  Work Finalized
                </div>
                <h4 className="text-xl font-semibold text-[#0a0a0a]">
                  Ready for Network Recording
                </h4>
                <p className="max-w-xl text-sm leading-relaxed text-[#5f5f5f]">
                  Work has been accepted. Finalize the details on the blockchain to move the escrow
                  to the next stage.
                </p>
              </div>
              <AppButton
                type="button"
                disabled={pending}
                onClick={() => void handleRetry(acceptedSubmission)}
                className="hr-v2-button-primary h-11 min-w-40 rounded-none"
              >
                {pending ? "Recording..." : "Finalize on Network"}
              </AppButton>
            </div>
          </div>
        )}

        {canRequestRevision && (
          <div className="space-y-6 border border-[#e8e8e8] p-6">
            <div className="space-y-1">
              <h4 className="text-lg font-semibold text-[#0a0a0a]">Request Revision</h4>
              <p className="text-sm text-[#5f5f5f]">
                Specify the required changes to help the freelancer improve the deliverables.
              </p>
            </div>
            <div className="grid gap-4">
              <Textarea
                value={revisionReason}
                disabled={requestingRevision}
                onChange={(event) => setRevisionReason(event.target.value)}
                placeholder="Short reason (e.g., Code Style, Missing Assets)"
                className="min-h-16 rounded-none border-[#e8e8e8] focus-visible:ring-[#FF7003]/30"
              />
              <Textarea
                value={requestedChanges}
                disabled={requestingRevision}
                onChange={(event) => setRequestedChanges(event.target.value)}
                placeholder="Detailed change requests..."
                className="min-h-28 rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
              />
            </div>
            <div className="border border-[#e8e8e8] bg-[#fafafa] p-4">
              <AttachmentUploader
                value={revisionAttachments}
                onChange={setRevisionAttachments}
                disabled={requestingRevision}
                ownerRole="client"
              />
            </div>
            <AppButton
              type="button"
              disabled={requestingRevision || !requestedChanges.trim()}
              onClick={() => void handleRequestRevision()}
              className="hr-v2-button-primary h-11 min-w-44 gap-2 rounded-none"
            >
              {requestingRevision ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <GitPullRequest className="h-4 w-4" />
              )}
              {requestingRevision ? "Sending..." : "Request Revision"}
            </AppButton>
          </div>
        )}
      </div>

      {error ? (
        <div className="border-l-4 border-red-500 bg-red-50 p-4 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      <section className="space-y-6 border-t border-[#e8e8e8] pt-10">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <SectionLabel>Delivery Details</SectionLabel>
            <h2 className="text-xl font-semibold text-[#0a0a0a]">Submission Feed</h2>
          </div>
        </div>

        {canViewProof && submissions === undefined ? (
          <div className="grid gap-4">
            {[0, 1].map((item) => (
              <div key={item} className="h-32 animate-pulse border border-[#e8e8e8] bg-gray-50" />
            ))}
          </div>
        ) : latestSubmission ? (
          <div className="space-y-8">
            <article className="group border border-[#e8e8e8] bg-white p-6 transition-colors hover:bg-[#fff7ed]/40">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#e8e8e8] pb-4">
                <div className="flex items-center gap-3">
                  <Badge className="rounded-none bg-[#0a0a0a] px-3 py-1 text-[10px] font-bold tracking-widest text-white uppercase">
                    {getStatusLabel(latestSubmission.status)}
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    Submitted {formatDate(latestSubmission.submittedAt)}
                  </span>
                </div>
                {latestSubmission.status === "anchor_failed" &&
                  (canSubmit || canAnchorAcceptedPreview) && (
                    <AppButton
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => void handleRetry(latestSubmission)}
                      className="gap-2 rounded-none border-[#e8e8e8] hover:bg-[#0a0a0a] hover:text-white"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry network recording
                    </AppButton>
                  )}
              </div>

              <div className="space-y-4">
                {latestSubmission.notes && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#5f5f5f]">
                    {latestSubmission.notes}
                  </p>
                )}

                <div className="border border-[#e8e8e8] bg-[#fafafa] p-4">
                  <AttachmentList attachments={latestSubmission.attachments ?? []} readOnly />
                </div>

                <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2 font-mono text-xs font-medium tracking-wider text-[#7f7f7f] uppercase">
                  <span className="inline-flex items-center gap-2">
                    <HighrableV2Bullet tone="muted" />
                    Status: {latestSubmission.deadlineStatus?.replace(/_/g, " ") ?? "Unknown"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <HighrableV2Bullet tone="muted" />
                    Verify:{" "}
                    {latestSubmission.stellarExpertUrl ? (
                      <a
                        href={latestSubmission.stellarExpertUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#FF7003] hover:underline"
                      >
                        Stellar Explorer
                        <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
                      </a>
                    ) : (
                      "Pending network confirm"
                    )}
                  </span>
                </div>
              </div>

              {latestSubmission.anchorErrorMessage ? (
                <div className="mt-4 border-l-4 border-red-500 bg-red-50 p-4 text-xs text-red-800">
                  Network error: {latestSubmission.anchorErrorMessage}
                </div>
              ) : null}
            </article>

            {revisionTimeline && revisionTimeline.length > 0 && (
              <div className="space-y-4">
                <SectionLabel>History & Revisions</SectionLabel>
                <div className="border-y border-[#e8e8e8]">
                  {revisionTimeline.map((event) => (
                    <div
                      key={`${event.kind}-${event.at}-${event.submission?._id ?? event.revision?._id ?? "event"}`}
                      className="border-b border-[#e8e8e8] px-1 py-5 last:border-b-0"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="rounded-none border-[#e8e8e8] text-[10px] font-bold tracking-widest uppercase"
                            >
                              {event.kind === "submission"
                                ? event.submission?.revisionRequestId
                                  ? "revised version"
                                  : "original version"
                                : "change request"}
                            </Badge>
                            <span className="font-mono text-[11px] font-medium text-gray-500">
                              {formatDate(event.at)}
                            </span>
                          </div>
                        </div>
                        {event.kind !== "submission" && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-bold text-[#0a0a0a]">
                              Revision #{event.revision?.revisionNumber}
                            </h5>
                            <p className="text-sm leading-relaxed text-[#5f5f5f]">
                              {event.revision?.requestedChanges}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-dashed border-[#e8e8e8] bg-white p-12 text-center">
            <p className="text-sm text-[#7f7f7f]">No deliverables have been submitted yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function getWorkSubmissionButtonLabel(input: {
  readonly escrowStatus?: string;
  readonly jobStatus?: string;
  readonly isSelectedFreelancer: boolean;
  readonly isClient: boolean;
}): string {
  if (input.escrowStatus === "released" || input.jobStatus === "completed") {
    return "Final Work";
  }

  if (input.escrowStatus === "submitted") {
    return input.isClient ? "Review Work" : "View Submission";
  }

  if (input.escrowStatus === "funded" && input.isSelectedFreelancer) {
    return "Submit Work";
  }

  return "Work Submission";
}

function getWorkSubmissionSummary(input: {
  readonly latestSubmission: TConvexDoc<"workSubmissions"> | null | undefined;
  readonly escrowStatus?: string;
  readonly jobStatus?: string;
  readonly canSubmit: boolean;
}): string {
  if (input.latestSubmission === undefined) {
    return "Loading submission status...";
  }

  if (input.latestSubmission) {
    if (input.escrowStatus === "released" || input.jobStatus === "completed") {
      return "Payment released. Final deliverables are available here.";
    }

    return `Latest status: ${getStatusLabel(input.latestSubmission.status)}.`;
  }

  if (input.canSubmit) {
    return "No work submitted yet. Submit notes, links, or files here.";
  }

  return "No work submitted yet.";
}

export function WorkProofSubmissionPanel({
  job,
  escrow,
  milestone,
}: IWorkProofSubmissionPanelProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const [isOpen, setIsOpen] = useState(false);
  const viewerWallet = walletIdentity.walletAddress ?? undefined;
  const latestSubmission = useQuery(
    api.work_submissions.getLatestSubmissionForEscrow,
    escrow?.escrowId && viewerWallet ? { onChainEscrowId: escrow.escrowId, viewerWallet } : "skip",
  );
  const agreementStatus = useQuery(api.work_agreements.getAgreementStatusForParent, {
    jobId: job._id,
  });

  const isSelectedFreelancer =
    walletIdentity.isConnected &&
    isSameWallet(walletIdentity.walletAddress, escrow?.freelancerWallet ?? null);
  const isClient =
    walletIdentity.isConnected &&
    isSameWallet(walletIdentity.walletAddress, escrow?.clientWallet ?? job.clientWallet);
  const agreementAccepted =
    agreementStatus?.status === "accepted" || agreementStatus?.status === "locked";
  const canSubmit =
    Boolean(escrow?.escrowId) &&
    escrow?.status === "funded" &&
    agreementAccepted &&
    isSelectedFreelancer;
  const buttonLabel = getWorkSubmissionButtonLabel({
    escrowStatus: escrow?.status,
    jobStatus: job.status,
    isSelectedFreelancer,
    isClient,
  });
  const summary = getWorkSubmissionSummary({
    latestSubmission,
    escrowStatus: escrow?.status,
    jobStatus: job.status,
    canSubmit,
  });
  const isReleased = escrow?.status === "released" || job.status === "completed";

  return (
    <section className={cn(V2_PANEL_CLASS, "bg-white p-4")} aria-label="Work submission">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[#FF7003]" aria-hidden="true" />
            <h3 className="text-sm font-bold tracking-wider text-[#0a0a0a] uppercase">
              {isReleased ? "Final work" : "Work submission"}
            </h3>
            {latestSubmission ? (
              <Badge
                variant="secondary"
                className="rounded-none text-[10px] tracking-wider uppercase"
              >
                {getStatusLabel(latestSubmission.status)}
              </Badge>
            ) : null}
          </div>
          <p className={cn("text-sm", V2_THEME.colors.textMuted)}>{summary}</p>
        </div>
        <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
          <ResponsiveDialogTrigger asChild>
            <AppButton
              type="button"
              variant="outline"
              disabled={!escrow?.escrowId || !walletIdentity.isConnected}
              className={cn(
                "shrink-0 rounded-none disabled:cursor-not-allowed disabled:opacity-60",
                V2_BUTTON_SECONDARY_CLASS,
              )}
              aria-label={buttonLabel}
            >
              <Eye className="mr-2 h-4 w-4" />
              {buttonLabel}
            </AppButton>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="rounded-none border-none shadow-2xl sm:max-w-4xl">
            <ResponsiveDialogHeader className="border-b border-[#e8e8e8] pb-4">
              <ResponsiveDialogTitle className="text-xl font-bold tracking-widest uppercase">
                {isReleased ? "Final Work" : "Work Submission"}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="text-sm">
                Submit, review, and manage project deliverables.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody>
              <div className="pt-6">
                <WorkProofSubmissionDialogContent job={job} escrow={escrow} milestone={milestone} />
              </div>
            </ResponsiveDialogBody>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>
    </section>
  );
}
