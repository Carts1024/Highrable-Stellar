"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { assignFreelancerOnChain } from "@/core/stellar/escrow-contract";
import {
  isPendingStellarTransactionError,
  normalizeStellarError,
} from "@/core/stellar/transaction";
import { getWalletNetworkMismatchMessage, isWalletOnConfiguredNetwork } from "@/core/wallet/config";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@repo/ui/responsive-dialog";
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
      throw new Error("Payment Hold record is missing the on the network payment hold ID.");
    }

    if (
      !walletIdentity.canSignEscrowTransactions ||
      walletIdentity.walletType === "passkey_smart_account"
    ) {
      throw new Error(
        "Assigning a pre-funded open payment hold from passkey mode is not supported in this phase. Use the standard create payment hold flow.",
      );
    }

    if (!isWalletOnConfiguredNetwork(walletState)) {
      throw new Error(getWalletNetworkMismatchMessage("assigning a freelancer"));
    }

    if (walletState.isFunded === false) {
      throw new Error(
        "Fund your Stellar testnet account with Friendbot before assigning payment hold.",
      );
    }

    if (walletState.canWriteContracts === false) {
      throw new Error("This wallet cannot sign payment hold contract actions right now.");
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
        operationId: clientRequestId,
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
        status: isPendingStellarTransactionError(error) ? "pending" : "failed",
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
      showWarningToast("Connect your wallet to select a freelancer.");
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
      showSuccessToast(`Freelancer ${shortenWalletAddress(freelancerWallet)} selected.`);
      onSelected();
    } catch (error) {
      const nextError = getReadableErrorMessage(
        error,
        "Failed to select freelancer. Please try again.",
      );
      setSelectionError(nextError);
      showErrorToast(nextError);
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
        className="font-sans text-sm text-muted-foreground"
      >
        Loading applications...
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="hr-text-primary text-base font-semibold">Applicants</h2>
        <p className="text-sm text-muted-foreground" role="status">
          No applications yet. Freelancers can apply while the job is open.
        </p>
      </section>
    );
  }

  return (
    <div
      className="space-y-3"
      role="region"
      aria-label={`Freelancer applications (${applicationCount})`}
    >
      <h2 className="hr-text-primary text-base font-semibold">
        Applicants <span className="hr-text-muted text-sm font-normal">{applicationCount}</span>
      </h2>
      <ul className="divide-y rounded-lg border">
        {applications.map((application) => (
          <li
            key={application._id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0 space-y-0.5">
              <Link
                href={`/freelancers/${encodeURIComponent(application.freelancerWallet)}`}
                className="hr-text-primary font-mono text-sm hover:underline"
              >
                {shortenWalletAddress(application.freelancerWallet)}
              </Link>
              <p className="hr-text-muted text-xs" role="doc-subtitle">
                Applied {new Date(application.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <ResponsiveDialog>
                <ResponsiveDialogTrigger asChild>
                  <AppButton type="button" variant="ghost" className="h-8 px-3 text-sm">
                    Read proposal
                  </AppButton>
                </ResponsiveDialogTrigger>

                <ResponsiveDialogContent className="max-w-3xl">
                  <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>
                      {shortenWalletAddress(application.freelancerWallet)}
                    </ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                      Applied {new Date(application.createdAt).toLocaleString()}
                    </ResponsiveDialogDescription>
                  </ResponsiveDialogHeader>
                  <ResponsiveDialogBody>
                    <p className="font-sans text-sm leading-relaxed whitespace-pre-line text-foreground">
                      {application.proposal}
                    </p>
                  </ResponsiveDialogBody>
                </ResponsiveDialogContent>
              </ResponsiveDialog>

              {application.showcasedWorkEscrowId ? (
                <AppButton asChild variant="ghost" className="h-8 px-3 text-sm">
                  <Link href={`/proof/${encodeURIComponent(application.showcasedWorkEscrowId)}`}>
                    Showcased work
                  </Link>
                </AppButton>
              ) : null}

              {canSelectFreelancer ? (
                <AppButton
                  type="button"
                  onClick={() => void handleSelectFreelancer(application.freelancerWallet)}
                  disabled={selectingWallet === application.freelancerWallet}
                  className="hr-v2-button-primary h-8 rounded-md px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Select ${shortenWalletAddress(application.freelancerWallet)} as freelancer for ${job.title}`}
                  aria-busy={selectingWallet === application.freelancerWallet}
                >
                  {selectingWallet === application.freelancerWallet ? "Selecting…" : "Select"}
                </AppButton>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {selectionError ? (
        <div className="text-sm text-red-700" role="alert" aria-atomic="true">
          {selectionError}
        </div>
      ) : null}
    </div>
  );
}
