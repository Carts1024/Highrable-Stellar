"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { assignFreelancerOnChain } from "@/core/stellar/escrow-contract";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import type { TConvexDoc, TConvexId } from "@repo/convex-client";

interface IApplicationsListProps {
  readonly job: TConvexDoc<"jobs">;
  readonly escrow: TConvexDoc<"escrows"> | null | undefined;
  readonly applications: TConvexDoc<"applications">[] | undefined;
  readonly isLoading: boolean;
  readonly onSelected: () => void;
}

export function ApplicationsList({
  job,
  escrow,
  applications,
  isLoading,
  onSelected,
}: IApplicationsListProps) {
  const { address, signTransaction, walletState } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();
  const selectFreelancer = useMutation(api.jobs.selectFreelancer);
  const assignFreelancerToEscrow = useMutation(api.escrows.assignFreelancerToEscrow);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectingWallet, setSelectingWallet] = useState<string | null>(null);

  const isClient = isSameWallet(walletIdentity.walletAddress, job.clientWallet);
  const isPreFundedOpenEscrow =
    job.status === "funded" &&
    !job.selectedFreelancerWallet &&
    escrow?.status === "funded" &&
    !escrow.freelancerWallet;
  const canSelectFreelancer =
    walletIdentity.isConnected && isClient && (job.status === "open" || isPreFundedOpenEscrow);
  const applicationCount = applications?.length ?? 0;

  const assignPreFundedEscrow = async (freelancerWallet: string) => {
    if (!address || !escrow?.escrowId) {
      throw new Error("Escrow record is missing the on-chain escrow ID.");
    }

    if (!walletIdentity.canSignEscrowTransactions) {
      throw new Error(
        "Passkey escrow signing is not enabled yet. Switch to Freighter or WalletConnect to perform this action.",
      );
    }

    if (!walletState.isTestnet) {
      throw new Error("Switch your wallet to Stellar Testnet before assigning a freelancer.");
    }

    if (walletState.isFunded === false) {
      throw new Error("Fund your Stellar testnet account with Friendbot before assigning escrow.");
    }

    if (walletState.canWriteContracts === false) {
      throw new Error("This wallet cannot sign escrow contract actions right now.");
    }

    const config = getRequiredEscrowActionConfig();
    const clientRequestId = `assign_freelancer:${job._id}:${freelancerWallet}:${Date.now()}`;

    await createTransaction({
      walletAddress: address,
      type: "assign_freelancer",
      clientRequestId,
      escrowId: escrow.escrowId,
      jobId: job._id as TConvexId<"jobs">,
      status: "pending",
    });

    let confirmedTxHash: string | null = null;

    try {
      const result = await assignFreelancerOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: address,
        signTransaction,
        client: job.clientWallet,
        freelancer: freelancerWallet,
        escrowId: escrow.escrowId,
      });
      confirmedTxHash = result.txHash;

      await assignFreelancerToEscrow({
        jobId: job._id as TConvexId<"jobs">,
        clientWallet: address,
        freelancerWallet,
        txHash: confirmedTxHash,
      });

      await updateTransactionStatus({
        clientRequestId,
        txHash: confirmedTxHash,
        status: "success",
      });
    } catch (error) {
      const errorMessage = normalizeStellarError(error);
      const failedTxHash =
        typeof error === "object" &&
        error !== null &&
        "txHash" in error &&
        typeof error.txHash === "string"
          ? error.txHash
          : confirmedTxHash || undefined;

      await updateTransactionStatus({
        clientRequestId,
        ...(failedTxHash ? { txHash: failedTxHash } : {}),
        status: "failed",
        errorMessage,
      });

      throw new Error(
        confirmedTxHash
          ? `Freelancer was assigned on Stellar, but the local escrow record could not be updated. Transaction: ${confirmedTxHash}. ${errorMessage}`
          : errorMessage,
      );
    }
  };

  const handleSelectFreelancer = async (freelancerWallet: string) => {
    if (!walletIdentity.walletAddress) {
      setSelectionError("Connect your wallet to select a freelancer.");
      return;
    }

    setSelectionError(null);
    setSelectingWallet(freelancerWallet);

    try {
      if (isPreFundedOpenEscrow) {
        await assignPreFundedEscrow(freelancerWallet);
      } else {
        await selectFreelancer({
          jobId: job._id as TConvexId<"jobs">,
          clientWallet: walletIdentity.walletAddress,
          freelancerWallet,
        });
      }
      onSelected();
    } catch (error) {
      setSelectionError(
        getReadableErrorMessage(error, "Failed to select freelancer. Please try again."),
      );
    } finally {
      setSelectingWallet(null);
    }
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading applications"
        className="text-sm text-[#7f7f7f]"
      >
        Loading applications...
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <p
        className="rounded-xl border border-dashed border-[#e8e8e8] bg-[#f5f5f5] p-4 text-sm text-[#5f5f5f]"
        role="status"
      >
        No applications yet. Freelancers can apply once you post the job.
      </p>
    );
  }

  return (
    <div
      className="space-y-3"
      role="region"
      aria-label={`Freelancer applications (${applicationCount})`}
    >
      {applications.map((application) => (
        <article
          key={application._id}
          className="rounded-xl border border-[#e8e8e8] bg-white p-4 transition-colors focus-within:ring-2 focus-within:ring-[#FF7003]/50 hover:border-[#FF7003]/40"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Link
                href={`/freelancers/${encodeURIComponent(application.freelancerWallet)}`}
                className="text-sm font-semibold text-[#0a0a0a] hover:text-[#FF7003]"
              >
                {shortenWalletAddress(application.freelancerWallet)}
              </Link>
              <p
                className="font-mono text-[0.65rem] tracking-[0.06em] text-[#7f7f7f] uppercase"
                role="doc-subtitle"
              >
                Applied {new Date(application.createdAt).toLocaleString()}
              </p>
            </div>

            {canSelectFreelancer ? (
              <AppButton
                type="button"
                onClick={() => void handleSelectFreelancer(application.freelancerWallet)}
                disabled={selectingWallet === application.freelancerWallet}
                variant="secondary"
                className="h-8 border-[#FF7003] px-3 py-2 text-xs font-semibold text-[#FF7003] hover:bg-[#FF7003]/5 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Select ${shortenWalletAddress(application.freelancerWallet)} as freelancer for ${job.title}`}
                aria-busy={selectingWallet === application.freelancerWallet}
              >
                {selectingWallet === application.freelancerWallet ? "Selecting..." : "Select"}
              </AppButton>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[#5f5f5f]">{application.proposal}</p>
        </article>
      ))}

      {selectionError ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
          aria-atomic="true"
        >
          {selectionError}
        </div>
      ) : null}
    </div>
  );
}
