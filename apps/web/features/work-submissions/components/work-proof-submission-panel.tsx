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
import { RotateCcw, Send } from "lucide-react";
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

export function WorkProofSubmissionPanel({
  job,
  escrow,
  milestone,
}: IWorkProofSubmissionPanelProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const { signTransaction } = useWallet();
  const [notes, setNotes] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<TDraftAttachment[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewerWallet = walletIdentity.walletAddress ?? undefined;
  const submissions = useQuery(
    api.work_submissions.getSubmissionsByEscrow,
    escrow?.escrowId && viewerWallet ? { onChainEscrowId: escrow.escrowId, viewerWallet } : "skip",
  );
  const attachmentIds = getReadyAttachmentIds(draftAttachments);
  const attachmentDocs = useQuery(
    api.attachments.getManyByIds,
    attachmentIds.length > 0 && viewerWallet ? { attachmentIds, viewerWallet } : "skip",
  );

  const createDraft = useMutation(api.work_submissions.createWorkSubmissionDraft);
  const submitMetadata = useMutation(api.work_submissions.submitWorkProofMetadata);
  const markAnchoring = useMutation(api.work_submissions.markSubmissionAnchoring);
  const markAnchored = useMutation(api.work_submissions.markSubmissionAnchored);
  const markFailed = useMutation(api.work_submissions.markSubmissionAnchorFailed);
  const retryAnchor = useMutation(api.work_submissions.retrySubmissionAnchor);
  const updateEscrowStatus = useMutation(api.escrows.updateEscrowStatus);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);

  const latestSubmission = submissions?.[0] ?? null;
  const canViewProof =
    walletIdentity.isConnected &&
    (isSameWallet(walletIdentity.walletAddress, escrow?.clientWallet ?? null) ||
      isSameWallet(walletIdentity.walletAddress, escrow?.freelancerWallet ?? null));
  const canSubmit =
    Boolean(escrow?.escrowId) &&
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
      setError("Only the assigned freelancer can submit proof for this escrow.");
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

      await anchorSubmission(submission);
      setNotes("");
      setDraftAttachments([]);
    } catch (error) {
      setError(getReadableAttachmentError(error, "Proof submission failed."));
    } finally {
      setPending(false);
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

  return (
    <section className="space-y-4 rounded-lg border border-[#e8e8e8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0a0a0a]">Proof of Work</h3>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Files stay in Convex storage. Only the manifest hash is anchored on Stellar.
          </p>
        </div>
        {walletIdentity.walletType ? (
          <Badge variant="secondary" className="rounded-md">
            {walletIdentity.walletType.replace(/_/g, " ")}
          </Badge>
        ) : null}
      </div>

      {canSubmit && !isImmutable ? (
        <div className="space-y-3">
          <Textarea
            value={notes}
            disabled={pending}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Summarize completed work, delivery notes, links, or acceptance details."
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
              disabled={pending || hasUploadingAttachment || !hasProofBody}
              onClick={() => void handleSubmit()}
              className="gap-2 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {pending ? "Submitting Proof..." : "Submit Proof"}
            </AppButton>
            <p className="font-mono text-xs text-[#7f7f7f]">
              {attachmentIds.length} attachment{attachmentIds.length === 1 ? "" : "s"} ready
            </p>
          </div>
        </div>
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
            {latestSubmission.status === "anchor_failed" && canSubmit ? (
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
            <p className="whitespace-pre-wrap text-sm text-[#3f3f3f]">{latestSubmission.notes}</p>
          ) : null}
          <AttachmentList attachments={latestSubmission.attachments ?? []} readOnly />
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#7f7f7f]">Proof hash</dt>
              <dd className="break-all font-mono text-xs text-[#0a0a0a]">
                {generatedPreview ?? "Pending"}
              </dd>
            </div>
            <div>
              <dt className="text-[#7f7f7f]">Submitted</dt>
              <dd className="text-[#0a0a0a]">{formatDate(latestSubmission.submittedAt)}</dd>
            </div>
            <div>
              <dt className="text-[#7f7f7f]">Transaction</dt>
              <dd className="break-all font-mono text-xs text-[#0a0a0a]">
                {latestSubmission.stellarExpertUrl ? (
                  <a href={latestSubmission.stellarExpertUrl} target="_blank" rel="noreferrer">
                    {latestSubmission.transactionHash}
                  </a>
                ) : (
                  latestSubmission.transactionHash ?? "Pending"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[#7f7f7f]">Hash</dt>
              <dd className="font-mono text-xs text-[#0a0a0a]">
                {latestSubmission.hashAlgorithm}/{latestSubmission.hashEncoding}
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
    </section>
  );
}
