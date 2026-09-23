"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { assignFreelancerOnChain } from "@/core/stellar/escrow-contract";
import { normalizeStellarError } from "@/core/stellar/transaction";
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
      throw new Error("Escrow record is missing the on-chain escrow ID.");
    }

    if (
      !walletIdentity.canSignEscrowTransactions ||
      walletIdentity.walletType === "passkey_smart_account"
    ) {
      throw new Error(
        "Assigning a pre-funded open escrow from passkey mode is not supported in this phase. Use the standard create escrow flow.",
      );
    }

    if (!isWalletOnConfiguredNetwork(walletState)) {
      throw new Error(getWalletNetworkMismatchMessage("assigning a freelancer"));
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
      <p
        className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground"
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
      <div className="flex flex-col rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="mb-4 space-y-2">
          <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
            Applications
          </p>
          <h2 className="hr-text-primary mt-0.5 font-sans text-lg font-semibold">
            {applicationCount} submitted proposal{applicationCount !== 1 ? "s" : ""}
          </h2>
        </div>

        {applications.map((application) => (
          <article
            key={application._id}
            className="group mb-3 rounded-lg border border-border bg-muted/50 p-5 shadow-none transition-all duration-200 focus-within:ring-2 focus-within:ring-highrable-orange-2/50 hover:border-highrable-orange-3/30 hover:shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <Link
                  href={`/freelancers/${encodeURIComponent(application.freelancerWallet)}`}
                  className="hr-text-primary text-sm font-semibold transition-colors hover:text-highrable-orange-3"
                >
                  {shortenWalletAddress(application.freelancerWallet)}
                </Link>
                <p
                  className="font-mono text-[0.65rem] tracking-[0.06em] text-muted-foreground/70 uppercase"
                  role="doc-subtitle"
                >
                  Applied {new Date(application.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <ResponsiveDialog>
                  <ResponsiveDialogTrigger asChild>
                    <AppButton
                      type="button"
                      variant="outline"
                      className="border-highrable-text-primary/20 px-3 text-xs text-highrable-text-primary hover:border-highrable-text-primary/50 hover:bg-muted hover:text-highrable-text-primary"
                    >
                      Proposal
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
                    <ResponsiveDialogBody className="rounded-lg border border-muted-foreground/20 bg-muted/80 p-5">
                      <p className="font-sans text-sm leading-relaxed text-foreground">
                        {application.proposal}
                      </p>
                    </ResponsiveDialogBody>
                  </ResponsiveDialogContent>
                </ResponsiveDialog>

                {application.showcasedWorkEscrowId ? (
                  <AppButton
                    asChild
                    variant="outline"
                    className="border-highrable-text-primary/20 px-3 text-xs text-highrable-text-primary hover:border-highrable-text-primary/50 hover:bg-muted hover:text-highrable-text-primary"
                  >
                    <Link href={`/proof/${encodeURIComponent(application.showcasedWorkEscrowId)}`}>
                      View Showcased Work
                    </Link>
                  </AppButton>
                ) : null}

                <AppButton
                  asChild
                  variant="outline"
                  className="border-highrable-text-primary/20 px-3 text-xs text-highrable-text-primary hover:border-highrable-text-primary/50 hover:bg-muted hover:text-highrable-text-primary"
                >
                  <Link href={`/freelancers/${encodeURIComponent(application.freelancerWallet)}`}>
                    View Profile
                  </Link>
                </AppButton>

                {canSelectFreelancer ? (
                  <AppButton
                    type="button"
                    variant="primary"
                    onClick={() => void handleSelectFreelancer(application.freelancerWallet)}
                    disabled={selectingWallet === application.freelancerWallet}
                    className="text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Select ${shortenWalletAddress(application.freelancerWallet)} as freelancer for ${job.title}`}
                    aria-busy={selectingWallet === application.freelancerWallet}
                  >
                    {selectingWallet === application.freelancerWallet ? "Selecting..." : "Select"}
                  </AppButton>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      {selectionError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
          aria-atomic="true"
        >
          {selectionError}
        </div>
      ) : null}
    </div>
  );
}
