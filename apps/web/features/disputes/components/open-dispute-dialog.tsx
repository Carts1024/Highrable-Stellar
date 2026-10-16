"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { markDisputedOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { getWalletNetworkMismatchMessage, isWalletOnConfiguredNetwork } from "@/core/wallet/config";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AttachmentUploader } from "@/features/attachments/components";
import { getReadableAttachmentError } from "@/features/attachments/lib";
import { showWarningToast } from "@/features/common";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@repo/ui/responsive-dialog";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import type { TDisputeParentType, TDisputeReasonCategory } from "../types";
import type { TDraftAttachment } from "@/features/attachments/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";

import { DISPUTE_REASON_OPTIONS, formatDisputeDate } from "../lib";
import { validateDisputeDraft } from "./open-dispute-validation";
import {
  createParticipantMarkingScopeKey,
  getParticipantTransactionHash,
  isParticipantOutcomeUncertain,
} from "./participant-marking";

type TOpenDisputeDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly job: TConvexDoc<"jobs">;
  readonly milestone?: TConvexDoc<"milestones">;
  readonly escrow: TConvexDoc<"escrows">;
  readonly parentType: TDisputeParentType;
  readonly parentId: string;
};

function createClientRequestId(escrowId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `mark_disputed:dispute:${escrowId}:${uniqueId}`;
}

function getReadyAttachmentIds(attachments: TDraftAttachment[]): TConvexId<"attachments">[] {
  return attachments
    .filter((attachment) => attachment.status === "ready")
    .map((attachment) => attachment.id as TConvexId<"attachments">);
}

export function DisputeReasonSelect({
  id,
  value,
  disabled,
  onChange,
}: {
  readonly id?: string;
  readonly value: TDisputeReasonCategory;
  readonly disabled?: boolean;
  readonly onChange: (value: TDisputeReasonCategory) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as TDisputeReasonCategory)}
      className="h-10 rounded-lg border border-[#d8d8d8] bg-white px-3 text-sm text-[#0a0a0a] disabled:opacity-60"
    >
      {DISPUTE_REASON_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function OpenDisputeDialog({
  isOpen,
  onOpenChange,
  job,
  milestone,
  escrow,
  parentType,
  parentId,
}: TOpenDisputeDialogProps) {
  const { address, walletState, signTransaction } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();
  const createDispute = useMutation(api.disputes.createDispute);
  const markStarted = useMutation(api.disputes.markDisputeOnChainStarted);
  const markSucceeded = useMutation(api.disputes.markDisputeOnChainSucceeded);
  const markFailed = useMutation(api.disputes.markDisputeOnChainFailed);
  const updateEscrowStatus = useMutation(api.escrows.updateEscrowStatus);
  const updateMilestoneEscrowStatus = useMutation(api.milestones.updateMilestoneEscrowStatus);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);
  const canOpenDispute = useQuery(
    api.disputes.canOpenDispute,
    walletIdentity.walletAddress
      ? {
          parentType,
          parentId,
          openedByWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const latestSubmission = useQuery(
    api.work_submissions.getLatestSubmissionForEscrow,
    escrow.escrowId && walletIdentity.walletAddress
      ? { onChainEscrowId: escrow.escrowId, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  );
  const revisions = useQuery(
    api.revisions.getRevisionRequestsByParent,
    walletIdentity.walletAddress
      ? {
          parentType: milestone ? "milestone" : "micro_gig",
          parentId: milestone?._id ?? job._id,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const [reasonCategory, setReasonCategory] =
    useState<TDisputeReasonCategory>("work_quality_issue");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeLatestSubmission, setIncludeLatestSubmission] = useState(true);
  const [selectedRevisionIds, setSelectedRevisionIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<TDraftAttachment[]>([]);
  const [submissionPhase, setSubmissionPhase] = useState<"idle" | "creating" | "marking">("idle");
  const [markExecutionPhase, setMarkExecutionPhase] = useState<string | null>(null);
  const [markTransactionHash, setMarkTransactionHash] = useState<string | null>(null);
  const [createdDisputeId, setCreatedDisputeId] = useState<TConvexId<"disputes"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const submissionInFlight = useRef(false);
  type TExecutionToken = { readonly generation: number; readonly operationId: string };
  const executionContextKey = createParticipantMarkingScopeKey({
    caseId: parentId,
    parentId,
    escrowId: escrow.escrowId,
    walletAddress: walletIdentity.walletAddress,
    walletType: walletIdentity.walletType,
    connectedWalletAddress: address,
    isConnected: walletIdentity.isConnected && walletState.isConnected,
    network: walletState.network,
    isTestnet: walletState.isTestnet,
    canWriteContracts: walletState.canWriteContracts,
    hasSigner: Boolean(signTransaction),
    permission: undefined,
  });
  const contextKeyRef = useRef(executionContextKey);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const executionRef = useRef<TExecutionToken | null>(null);

  if (contextKeyRef.current !== executionContextKey) {
    contextKeyRef.current = executionContextKey;
    generationRef.current += 1;
    executionRef.current = null;
    submissionInFlight.current = false;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      executionRef.current = null;
      submissionInFlight.current = false;
    };
  }, []);

  useEffect(() => {
    setSubmissionPhase("idle");
    setMarkExecutionPhase(null);
    setMarkTransactionHash(null);
    setError(null);
    setSubmissionFailed(false);
  }, [executionContextKey]);

  const isSubmitting = submissionPhase !== "idle";
  const activeWalletAddress = walletIdentity.walletAddress;
  const reasonSelectId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const ownerRole = useMemo(() => {
    if (!activeWalletAddress) return "client";
    return activeWalletAddress.toUpperCase() === escrow.clientWallet.toUpperCase()
      ? "client"
      : "freelancer";
  }, [activeWalletAddress, escrow.clientWallet]);
  const relatedRevisions = (revisions ?? []).filter((revision) => revision.escrowId === escrow._id);
  const selectedSubmissionId = includeLatestSubmission ? (latestSubmission?._id ?? null) : null;
  const relatedDataReady = latestSubmission !== undefined && revisions !== undefined;
  const canSubmit =
    Boolean(activeWalletAddress) &&
    Boolean(walletIdentity.walletType) &&
    canOpenDispute?.allowed === true &&
    relatedDataReady &&
    !isSubmitting &&
    !createdDisputeId;

  const isCurrent = (): boolean =>
    mountedRef.current && contextKeyRef.current === executionContextKey;
  const isExecutionCurrent = (token: TExecutionToken): boolean =>
    isCurrent() && generationRef.current === token.generation && executionRef.current === token;
  const assertExecutionCurrent = (token: TExecutionToken): void => {
    if (!isExecutionCurrent(token)) {
      throw new Error("Dispute opening context changed; stopping the obsolete attempt.");
    }
  };

  const runOnChainMark = async (
    disputeId: TConvexId<"disputes">,
    token: TExecutionToken,
    clientRequestId: string,
  ) => {
    const config = getRequiredEscrowActionConfig();
    const actorWallet = activeWalletAddress;
    const actorWalletType = walletIdentity.walletType;
    assertExecutionCurrent(token);
    if (!actorWallet || !walletIdentity.isConnected || !actorWalletType) {
      throw new Error(
        "Connect a Stellar wallet or passkey smart account before opening a dispute.",
      );
    }
    if (actorWalletType === "passkey_smart_account") {
      const readiness = await getPasskeyEscrowExecutionReadiness();
      assertExecutionCurrent(token);
      if (!readiness.canExecute) {
        throw new Error(
          readiness.reason ?? "Smart account fee funding or relayer configuration is missing.",
        );
      }
    } else {
      if (
        !address ||
        !walletState.isConnected ||
        address.toUpperCase() !== actorWallet.toUpperCase()
      ) {
        throw new Error("Connect the wallet for this dispute before marking its escrow.");
      }
      if (!isWalletOnConfiguredNetwork(walletState)) {
        throw new Error(getWalletNetworkMismatchMessage("opening a dispute"));
      }
      if (walletState.canWriteContracts === false) {
        throw new Error("This wallet cannot sign escrow contract actions right now.");
      }
    }

    await createTransaction({
      walletAddress: actorWallet,
      walletType: actorWalletType,
      type: "mark_disputed",
      clientRequestId,
      escrowId: escrow.escrowId,
      jobId: job._id,
      ...(milestone ? { milestoneId: milestone._id } : {}),
      status: "pending",
    });
    assertExecutionCurrent(token);
    try {
      await markStarted({
        disputeId,
        actorWallet,
        actorWalletType,
      });
      assertExecutionCurrent(token);
    } catch (error) {
      if (!isExecutionCurrent(token)) throw error;
      try {
        await updateTransactionStatus({
          clientRequestId,
          status: "failed",
          errorMessage: normalizeStellarError(error),
        });
        assertExecutionCurrent(token);
      } catch {
        // Keep the original start error visible.
      }
      throw error;
    }

    let knownHash: string | undefined;
    let mayHaveSubmitted = false;
    let result: { txHash: string };
    try {
      result = await markDisputedOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: actorWallet,
        signTransaction: async (xdr, options) => {
          void options;
          assertExecutionCurrent(token);
          const signedXdr = await signTransaction(xdr);
          assertExecutionCurrent(token);
          return signedXdr;
        },
        walletType: actorWalletType,
        operationId: clientRequestId,
        caller: actorWallet,
        escrowId: escrow.escrowId,
        onSigned: async ({ transactionHash }) => {
          assertExecutionCurrent(token);
          knownHash = transactionHash;
          setMarkTransactionHash(transactionHash);
          await updateTransactionStatus({
            clientRequestId,
            txHash: transactionHash,
            status: "pending",
          });
          assertExecutionCurrent(token);
        },
        onPhase: (phase) => {
          if (!isExecutionCurrent(token)) return;
          setMarkExecutionPhase(
            {
              simulation: "Simulating transaction...",
              signing: "Waiting for wallet signature...",
              submission: "Submitting transaction...",
              confirmation: "Waiting for Stellar confirmation...",
            }[phase],
          );
          if (phase === "submission" || phase === "confirmation") mayHaveSubmitted = true;
        },
      });
      assertExecutionCurrent(token);
    } catch (error) {
      const errorMessage = normalizeStellarError(error);
      if (!isExecutionCurrent(token)) throw error;
      const failedTxHash = knownHash ?? getParticipantTransactionHash(error);
      const uncertain = isParticipantOutcomeUncertain({
        error,
        mayHaveSubmitted,
        transactionHash: failedTxHash,
      });
      if (failedTxHash) setMarkTransactionHash(failedTxHash);
      try {
        await updateTransactionStatus({
          clientRequestId,
          ...(failedTxHash ? { txHash: failedTxHash } : {}),
          status: uncertain ? "pending" : "failed",
          errorMessage,
        });
        assertExecutionCurrent(token);
      } catch (recordingError) {
        if (!isExecutionCurrent(token)) throw recordingError;
      }
      if (!uncertain) {
        try {
          await markFailed({
            disputeId,
            actorWallet,
            actorWalletType,
            errorMessage,
          });
          assertExecutionCurrent(token);
        } catch (recordingError) {
          if (!isExecutionCurrent(token)) throw recordingError;
          throw new Error(
            "Escrow marking failed, but its failure could not be recorded. Check the saved dispute before retrying.",
          );
        }
      }
      throw new Error(
        uncertain
          ? "Transaction outcome is uncertain. Check Stellar Expert or wait for reconciliation before retrying."
          : `Dispute evidence was saved, but on-chain marking failed: ${errorMessage}`,
      );
    }

    assertExecutionCurrent(token);
    setMarkTransactionHash(result.txHash);
    setMarkExecutionPhase("Recording confirmed transaction...");
    try {
      await markSucceeded({
        disputeId,
        actorWallet,
        actorWalletType,
        transactionHash: result.txHash,
        stellarExpertUrl: getTxExplorerUrl(result.txHash),
      });
      assertExecutionCurrent(token);
      await updateTransactionStatus({ clientRequestId, txHash: result.txHash, status: "success" });
      assertExecutionCurrent(token);
      if (milestone) {
        await updateMilestoneEscrowStatus({
          milestoneId: milestone._id,
          escrowId: escrow.escrowId,
          status: "disputed",
          txHash: result.txHash,
          txType: "mark_disputed",
        });
      } else {
        await updateEscrowStatus({
          escrowId: escrow.escrowId,
          status: "disputed",
          txHash: result.txHash,
          txType: "mark_disputed",
        });
      }
      assertExecutionCurrent(token);
    } catch (error) {
      throw new Error(
        `Stellar confirmed the transaction, but Highrable could not finish recording it: ${normalizeStellarError(error)}`,
      );
    }
    return result.txHash;
  };

  const handleSubmit = async () => {
    if (submissionInFlight.current || executionRef.current || createdDisputeId || !isCurrent())
      return;
    const setWarning = (message: string) => {
      setError(message);
      showWarningToast(message);
    };

    if (!activeWalletAddress || !walletIdentity.walletType) {
      setWarning("Missing wallet identity.");
      return;
    }
    const validationError = validateDisputeDraft({
      title,
      reasonCategory,
      description,
      eligibility: canOpenDispute,
      escrowId: escrow._id,
      onChainEscrowId: escrow.escrowId,
      escrowStatus: escrow.status,
      relatedDataReady,
      selectedSubmissionId,
      availableSubmissionId: latestSubmission?._id ?? null,
      selectedRevisionIds,
      availableRevisionIds: relatedRevisions.map((revision) => revision._id),
      attachments,
    });
    if (validationError) {
      setWarning(validationError);
      return;
    }

    const clientRequestId = createClientRequestId(escrow.escrowId);
    const token: TExecutionToken = {
      generation: generationRef.current,
      operationId: clientRequestId,
    };
    executionRef.current = token;
    submissionInFlight.current = true;
    setSubmissionPhase("creating");
    setMarkExecutionPhase(null);
    setMarkTransactionHash(null);
    setError(null);
    setSubmissionFailed(false);
    let savedDisputeId: TConvexId<"disputes"> | null = null;
    try {
      assertExecutionCurrent(token);
      const disputeId = await createDispute({
        parentType,
        parentId,
        openedByWallet: activeWalletAddress,
        openedByWalletType: walletIdentity.walletType,
        reasonCategory,
        title: title.trim().replace(/\s+/g, " "),
        description: description.trim(),
        evidenceAttachmentIds: getReadyAttachmentIds(attachments),
        ...(selectedSubmissionId
          ? { relatedWorkSubmissionIds: [selectedSubmissionId as TConvexId<"workSubmissions">] }
          : {}),
        ...(selectedSubmissionId && latestSubmission?.proofHash
          ? { proofHash: latestSubmission.proofHash }
          : {}),
        ...(selectedRevisionIds.length > 0
          ? { relatedRevisionRequestIds: selectedRevisionIds as TConvexId<"revisionRequests">[] }
          : {}),
        escrowContractId: getRequiredEscrowActionConfig().escrowContractId,
      });
      assertExecutionCurrent(token);
      savedDisputeId = disputeId;
      setCreatedDisputeId(disputeId);
      setSubmissionPhase("marking");
      await runOnChainMark(disputeId, token, clientRequestId);
      assertExecutionCurrent(token);
      setTitle("");
      setDescription("");
      setSelectedRevisionIds([]);
      setAttachments([]);
      setCreatedDisputeId(null);
      onOpenChange(false);
    } catch (error) {
      if (!isExecutionCurrent(token)) return;
      setSubmissionFailed(!savedDisputeId);
      setError(
        savedDisputeId
          ? getReadableAttachmentError(error, "Dispute was saved, but escrow marking failed.")
          : getReadableAttachmentError(error, "Dispute could not be opened. Please retry."),
      );
    } finally {
      if (executionRef.current === token) {
        executionRef.current = null;
        submissionInFlight.current = false;
        if (isCurrent()) setSubmissionPhase("idle");
      }
    }
  };

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-xl text-[#0a0a0a]">
            Open Platform-Reviewed Dispute
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-[#5f5f5f]">
            Save dispute evidence in Highrable and mark the escrow disputed on Stellar.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <form
            noValidate
            aria-describedby={error ? errorId : undefined}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Manual dispute review pauses release and cancellation. This MVP does not automate
                  escrow judgment or fund splitting.
                </p>
              </div>
            </div>

            {canOpenDispute?.allowed === false ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {canOpenDispute.reason}
              </p>
            ) : null}

            {activeWalletAddress && canOpenDispute === undefined ? (
              <p role="status" className="text-sm text-[#5f5f5f]">
                Checking dispute eligibility...
              </p>
            ) : null}

            {canOpenDispute?.allowed && !relatedDataReady ? (
              <p role="status" className="text-sm text-[#5f5f5f]">
                Loading related work records...
              </p>
            ) : null}

            <div className="grid gap-4">
              <label className="grid gap-2" htmlFor={titleId}>
                <span className="font-mono text-xs text-[#5f5f5f] uppercase">Title</span>
                <input
                  id={titleId}
                  type="text"
                  value={title}
                  maxLength={160}
                  required
                  disabled={isSubmitting || Boolean(createdDisputeId)}
                  onChange={(event) => setTitle(event.target.value)}
                  aria-label="Title"
                  className="h-10 rounded-lg border border-[#d8d8d8] bg-white px-3 text-sm text-[#0a0a0a] disabled:opacity-60"
                  placeholder="Briefly summarize the dispute"
                />
              </label>

              <label className="grid gap-2" htmlFor={reasonSelectId}>
                <span className="font-mono text-xs text-[#5f5f5f] uppercase">Reason</span>
                <DisputeReasonSelect
                  id={reasonSelectId}
                  value={reasonCategory}
                  disabled={isSubmitting || Boolean(createdDisputeId)}
                  onChange={setReasonCategory}
                />
              </label>

              <label className="grid gap-2" htmlFor={descriptionId}>
                <span className="font-mono text-xs text-[#5f5f5f] uppercase">Description</span>
                <Textarea
                  id={descriptionId}
                  value={description}
                  maxLength={10_000}
                  required
                  disabled={isSubmitting || Boolean(createdDisputeId)}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe what happened, what has already been tried, and what evidence matters."
                  className="min-h-32 rounded-lg border-[#d8d8d8] bg-white"
                />
              </label>

              {latestSubmission ? (
                <label className="flex items-start gap-2 text-sm text-[#3f3f3f]">
                  <input
                    type="checkbox"
                    checked={includeLatestSubmission}
                    disabled={isSubmitting || Boolean(createdDisputeId)}
                    onChange={(event) => setIncludeLatestSubmission(event.target.checked)}
                    aria-label={`Include latest work submission from ${formatDisputeDate(latestSubmission.createdAt)}`}
                  />
                  Include latest work submission ({formatDisputeDate(latestSubmission.createdAt)})
                </label>
              ) : null}

              {relatedRevisions.length > 0 ? (
                <fieldset className="space-y-2">
                  <legend className="font-mono text-xs text-[#5f5f5f] uppercase">
                    Related revision requests (up to 20)
                  </legend>
                  {relatedRevisions.map((revision) => (
                    <label
                      key={revision._id}
                      className="flex items-start gap-2 text-sm text-[#3f3f3f]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRevisionIds.includes(revision._id)}
                        disabled={isSubmitting || Boolean(createdDisputeId)}
                        onChange={(event) =>
                          setSelectedRevisionIds((current) =>
                            event.target.checked
                              ? [...current, revision._id]
                              : current.filter((id) => id !== revision._id),
                          )
                        }
                        aria-label={`Revision ${revision.revisionNumber}: ${revision.reason}`}
                      />
                      Revision {revision.revisionNumber}: {revision.reason}
                    </label>
                  ))}
                </fieldset>
              ) : null}

              <AttachmentUploader
                value={attachments}
                onChange={setAttachments}
                disabled={isSubmitting || Boolean(createdDisputeId)}
                ownerRole={ownerRole}
                context="dispute"
              />
            </div>

            {error ? (
              <p
                id={errorId}
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            ) : null}

            {isSubmitting ? (
              <p role="status" className="text-sm text-[#5f5f5f]">
                {submissionPhase === "creating"
                  ? "Saving dispute..."
                  : (markExecutionPhase ?? "Marking escrow disputed...")}
              </p>
            ) : null}

            {createdDisputeId ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Your dispute was saved.{" "}
                <Link
                  href={`/disputes/${createdDisputeId}`}
                  className="underline"
                  onClick={() => onOpenChange(false)}
                >
                  View the dispute and its on-chain status
                </Link>
                .
                {markTransactionHash ? (
                  <p className="mt-2">
                    <a
                      href={getTxExplorerUrl(markTransactionHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      View transaction on Stellar Expert
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <AppButton
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </AppButton>
              {!createdDisputeId ? (
                <AppButton
                  type="submit"
                  disabled={!canSubmit}
                  className="disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submissionPhase === "creating"
                    ? "Saving Dispute..."
                    : submissionPhase === "marking"
                      ? "Marking Escrow..."
                      : submissionFailed
                        ? "Retry Opening Dispute"
                        : "Open Dispute"}
                </AppButton>
              ) : null}
            </div>
          </form>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
