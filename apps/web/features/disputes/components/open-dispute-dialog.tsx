"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { markDisputedOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AttachmentUploader } from "@/features/attachments/components";
import { getReadableAttachmentError } from "@/features/attachments/lib";
import { showWarningToast } from "@/features/common";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { useId, useMemo, useState } from "react";

import type { TDisputeParentType, TDisputeReasonCategory } from "../types";
import type { TDraftAttachment } from "@/features/attachments/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";

import { DISPUTE_REASON_OPTIONS, getDisputeReasonLabel } from "../lib";

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
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<TDraftAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeWalletAddress = walletIdentity.walletAddress;
  const reasonSelectId = useId();
  const descriptionId = useId();
  const activeWalletType = walletIdentity.walletType ?? "external_wallet";
  const ownerRole = useMemo(() => {
    if (!activeWalletAddress) return "client";
    return activeWalletAddress.toUpperCase() === escrow.clientWallet.toUpperCase()
      ? "client"
      : "freelancer";
  }, [activeWalletAddress, escrow.clientWallet]);
  const hasUploadingAttachment = attachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const canSubmit =
    Boolean(activeWalletAddress) &&
    Boolean(walletIdentity.walletType) &&
    description.trim().length > 0 &&
    !hasUploadingAttachment &&
    canOpenDispute?.allowed !== false;

  const runOnChainMark = async (disputeId: TConvexId<"disputes">) => {
    const config = getRequiredEscrowActionConfig();
    if (!activeWalletAddress || !walletIdentity.isConnected || !walletIdentity.walletType) {
      throw new Error(
        "Connect a Stellar wallet or passkey smart account before opening a dispute.",
      );
    }
    if (walletIdentity.walletType === "passkey_smart_account") {
      const readiness = await getPasskeyEscrowExecutionReadiness();
      if (!readiness.canExecute) {
        throw new Error(
          readiness.reason ?? "Smart account fee funding or relayer configuration is missing.",
        );
      }
    } else {
      if (!address || !walletState.isConnected) {
        throw new Error("Connect a Stellar wallet before opening a dispute.");
      }
      if (!walletState.isTestnet) {
        throw new Error("Switch your wallet to Stellar Testnet before opening a dispute.");
      }
      if (walletState.canWriteContracts === false) {
        throw new Error("This wallet cannot sign escrow contract actions right now.");
      }
    }

    const clientRequestId = createClientRequestId(escrow.escrowId);
    await createTransaction({
      walletAddress: activeWalletAddress,
      walletType: walletIdentity.walletType,
      type: "mark_disputed",
      clientRequestId,
      escrowId: escrow.escrowId,
      jobId: job._id,
      ...(milestone ? { milestoneId: milestone._id } : {}),
      status: "pending",
    });
    await markStarted({
      disputeId,
      actorWallet: activeWalletAddress,
      actorWalletType: walletIdentity.walletType,
    });

    try {
      const result = await markDisputedOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress,
        signTransaction,
        walletType: activeWalletType,
        caller: activeWalletAddress,
        escrowId: escrow.escrowId,
      });

      await updateTransactionStatus({
        clientRequestId,
        txHash: result.txHash,
        status: "success",
      });

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

      await markSucceeded({
        disputeId,
        actorWallet: activeWalletAddress,
        actorWalletType: walletIdentity.walletType,
        transactionHash: result.txHash,
        stellarExpertUrl: getTxExplorerUrl(result.txHash),
      });
      return result.txHash;
    } catch (error) {
      const errorMessage = normalizeStellarError(error);
      const failedTxHash =
        typeof error === "object" &&
        error !== null &&
        "txHash" in error &&
        typeof error.txHash === "string"
          ? error.txHash
          : undefined;
      await updateTransactionStatus({
        clientRequestId,
        ...(failedTxHash ? { txHash: failedTxHash } : {}),
        status: "failed",
        errorMessage,
      });
      await markFailed({
        disputeId,
        actorWallet: activeWalletAddress,
        actorWalletType: walletIdentity.walletType,
        errorMessage,
        ...(failedTxHash ? { transactionHash: failedTxHash } : {}),
      });
      throw new Error("Dispute evidence was saved, but on-chain marking failed. Please retry.");
    }
  };

  const handleSubmit = async () => {
    const setWarning = (message: string) => {
      setError(message);
      showWarningToast(message);
    };

    if (!activeWalletAddress || !walletIdentity.walletType) {
      setWarning("Missing wallet identity.");
      return;
    }
    if (!description.trim()) {
      setWarning("Add a reason and description before opening a dispute.");
      return;
    }
    if (hasUploadingAttachment) {
      setWarning("Wait for evidence uploads to finish.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const disputeId = await createDispute({
        parentType,
        parentId,
        openedByWallet: activeWalletAddress,
        openedByWalletType: walletIdentity.walletType,
        reasonCategory,
        title: getDisputeReasonLabel(reasonCategory),
        description,
        evidenceAttachmentIds: getReadyAttachmentIds(attachments),
        ...(latestSubmission?._id ? { relatedWorkSubmissionIds: [latestSubmission._id] } : {}),
        ...(latestSubmission?.proofHash ? { proofHash: latestSubmission.proofHash } : {}),
        ...(revisions && revisions.length > 0
          ? { relatedRevisionRequestIds: revisions.map((revision) => revision._id).slice(0, 5) }
          : {}),
        escrowContractId: getRequiredEscrowActionConfig().escrowContractId,
      });
      await runOnChainMark(disputeId);
      setDescription("");
      setAttachments([]);
      onOpenChange(false);
    } catch (error) {
      setError(getReadableAttachmentError(error, "Dispute could not be opened."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[#e8e8e8] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#0a0a0a]">
            Open Platform-Reviewed Dispute
          </DialogTitle>
          <DialogDescription className="text-[#5f5f5f]">
            Save dispute evidence in Highrable and mark the escrow disputed on Stellar.
          </DialogDescription>
        </DialogHeader>

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

        <div className="grid gap-4">
          <label className="grid gap-2" htmlFor={reasonSelectId}>
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Reason</span>
            <DisputeReasonSelect
              id={reasonSelectId}
              value={reasonCategory}
              disabled={isSubmitting}
              onChange={setReasonCategory}
            />
          </label>

          <label className="grid gap-2" htmlFor={descriptionId}>
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Description</span>
            <Textarea
              id={descriptionId}
              value={description}
              disabled={isSubmitting}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what happened, what has already been tried, and what evidence matters."
              className="min-h-32 rounded-lg border-[#d8d8d8] bg-white"
            />
          </label>

          <AttachmentUploader
            value={attachments}
            onChange={setAttachments}
            disabled={isSubmitting}
            ownerRole={ownerRole}
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
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
          <AppButton
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={() => void handleSubmit()}
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Opening Dispute..." : "Open Dispute"}
          </AppButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
