"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { toTokenAmount } from "@/core/stellar/amounts";
import {
  approveAndReleaseOnChain,
  cancelEscrowOnChain,
  createEscrowOnChain,
  fundEscrowOnChain,
  getStablecoinBalanceOnChain,
  markDisputedOnChain,
  submitWorkOnChain,
} from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { bytesToHex, toBytesN32Hash } from "@/core/stellar/hashes";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";

import type { TActorRole } from "@/features/marketplace/types";
import type { TConvexDoc } from "@repo/convex-client";

type TEscrowAction =
  | "create_escrow"
  | "fund_escrow"
  | "submit_work"
  | "release_payment"
  | "cancel_escrow"
  | "mark_disputed";

type TEscrowActionState = {
  pendingAction: TEscrowAction | null;
  error: string | null;
  success: string | null;
  txHash: string | null;
};

function detectRole(
  connectedWallet: string | null,
  job: TConvexDoc<"jobs">,
  applications: TConvexDoc<"applications">[],
): TActorRole {
  if (!connectedWallet) {
    return "guest";
  }

  if (isSameWallet(connectedWallet, job.clientWallet)) {
    return "client";
  }

  if (isSameWallet(connectedWallet, job.selectedFreelancerWallet ?? null)) {
    return "selectedFreelancer";
  }

  const isApplicant = applications.some((application) =>
    isSameWallet(application.freelancerWallet, connectedWallet),
  );

  return isApplicant ? "applicant" : "other";
}

function createClientRequestId(action: TEscrowAction, jobId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${action}:${jobId}:${uniqueId}`;
}

function getEscrowIdOrThrow(escrow: TConvexDoc<"escrows"> | null | undefined): string {
  if (!escrow?.escrowId) {
    throw new Error("Escrow record is missing the on-chain escrow ID.");
  }

  return escrow.escrowId;
}

function requireRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Release rating must be a whole number from 1 to 5.");
  }
}

export function useEscrowActions({
  job,
  escrow,
  applications,
}: {
  job: TConvexDoc<"jobs">;
  escrow: TConvexDoc<"escrows"> | null | undefined;
  applications: TConvexDoc<"applications">[];
}) {
  const { address, walletState, signTransaction } = useWallet();
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);
  const createEscrowRecord = useMutation(api.escrows.createEscrowRecord);
  const updateEscrowStatus = useMutation(api.escrows.updateEscrowStatus);
  const createReputationRecord = useMutation(api.reputation.createReputationRecord);
  const [state, setState] = useState<TEscrowActionState>({
    pendingAction: null,
    error: null,
    success: null,
    txHash: null,
  });

  const role = useMemo(() => detectRole(address, job, applications), [address, applications, job]);
  const isPending = state.pendingAction !== null;
  const txExplorerUrl = state.txHash ? getTxExplorerUrl(state.txHash) : null;

  const validateBaseAction = useCallback(
    (action: TEscrowAction) => {
      const config = getRequiredEscrowActionConfig();

      if (!address || !walletState.isConnected) {
        throw new Error("Connect a Stellar wallet before using escrow actions.");
      }

      if (!walletState.isTestnet) {
        throw new Error("Switch your wallet to Stellar Testnet before using escrow actions.");
      }

      if (walletState.isFunded === false) {
        throw new Error("Fund your Stellar testnet account with Friendbot before using escrow.");
      }

      if (!job.clientWallet) {
        throw new Error("Job is missing the client wallet.");
      }

      if (!job.selectedFreelancerWallet) {
        throw new Error("Select a freelancer before creating escrow.");
      }

      if (!job.asset) {
        throw new Error("Job is missing the stablecoin token contract ID.");
      }

      if (!isSameWallet(job.asset, config.stablecoinTokenContractId)) {
        throw new Error(
          "Job asset does not match the configured mock USDC stablecoin token contract ID.",
        );
      }

      if (!job.jobHash) {
        throw new Error("Job is missing a hash for the escrow contract.");
      }

      if (action === "create_escrow" && role !== "client") {
        throw new Error("Only the client can create escrow.");
      }

      if (
        (action === "fund_escrow" ||
          action === "release_payment" ||
          action === "cancel_escrow") &&
        role !== "client"
      ) {
        throw new Error("Only the client wallet can perform this escrow action.");
      }

      if (action === "submit_work" && role !== "selectedFreelancer") {
        throw new Error("Only the selected freelancer can submit work.");
      }

      if (
        action === "mark_disputed" &&
        role !== "client" &&
        role !== "selectedFreelancer"
      ) {
        throw new Error("Only the client or selected freelancer can mark escrow disputed.");
      }

      return config;
    },
    [address, job, role, walletState.isConnected, walletState.isFunded, walletState.isTestnet],
  );

  const runEscrowAction = useCallback(
    async (
      action: TEscrowAction,
      callback: (params: {
        clientRequestId: string;
        config: ReturnType<typeof getRequiredEscrowActionConfig>;
      }) => Promise<{ txHash: string; success: string }>,
    ) => {
      if (state.pendingAction) {
        return;
      }

      const clientRequestId = createClientRequestId(action, job._id);
      setState({
        pendingAction: action,
        error: null,
        success: null,
        txHash: null,
      });

      try {
        const config = validateBaseAction(action);
        const escrowId = escrow?.escrowId;

        await createTransaction({
          walletAddress: address!,
          type: action,
          clientRequestId,
          ...(escrowId ? { escrowId } : {}),
          jobId: job._id,
          status: "pending",
        });

        const result = await callback({ clientRequestId, config });

        await updateTransactionStatus({
          clientRequestId,
          txHash: result.txHash,
          status: "success",
        });

        setState({
          pendingAction: null,
          error: null,
          success: result.success,
          txHash: result.txHash,
        });
      } catch (error) {
        const errorMessage = normalizeStellarError(error);
        const failedTxHash =
          typeof error === "object" &&
          error !== null &&
          "txHash" in error &&
          typeof error.txHash === "string"
            ? error.txHash
            : undefined;

        try {
          await updateTransactionStatus({
            clientRequestId,
            ...(failedTxHash ? { txHash: failedTxHash } : {}),
            status: "failed",
            errorMessage,
          });
        } catch {
          // The transaction row might not exist if validation failed before creation.
        }

        setState({
          pendingAction: null,
          error: errorMessage,
          success: null,
          txHash: failedTxHash ?? null,
        });
      }
    },
    [
      address,
      createTransaction,
      escrow?.escrowId,
      job._id,
      state.pendingAction,
      updateTransactionStatus,
      validateBaseAction,
    ],
  );

  const createEscrow = useCallback(async () => {
    await runEscrowAction("create_escrow", async ({ config }) => {
      if (job.status !== "selected" || escrow) {
        throw new Error("Escrow can only be created after a freelancer is selected.");
      }

      const jobHash = await toBytesN32Hash(job.jobHash);
      const result = await createEscrowOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: address!,
        signTransaction,
        client: job.clientWallet,
        freelancer: job.selectedFreelancerWallet!,
        asset: config.stablecoinTokenContractId,
        amount: job.budget,
        jobHash,
      });

      await createEscrowRecord({
        jobId: job._id,
        escrowId: result.escrowId,
        clientWallet: job.clientWallet,
        freelancerWallet: job.selectedFreelancerWallet!,
        amount: job.budget,
        asset: config.stablecoinTokenContractId,
        createTxHash: result.txHash,
      });

      return {
        txHash: result.txHash,
        success: `Escrow #${result.escrowId} created on Stellar.`,
      };
    });
  }, [address, createEscrowRecord, escrow, job, runEscrowAction, signTransaction]);

  const fundEscrow = useCallback(async () => {
    await runEscrowAction("fund_escrow", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "created") {
        throw new Error("Escrow must be created before it can be funded.");
      }

      const requiredBalance = toTokenAmount(job.budget);
      const stablecoinBalance = await getStablecoinBalanceOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        stablecoinTokenContractId: config.stablecoinTokenContractId,
        sourceAddress: address!,
        walletAddress: address!,
      });

      if (stablecoinBalance < requiredBalance) {
        throw new Error("Connected wallet does not have enough mock USDC stablecoin balance.");
      }

      const result = await fundEscrowOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: address!,
        signTransaction,
        client: job.clientWallet,
        escrowId,
      });

      await updateEscrowStatus({
        escrowId,
        status: "funded",
        txHash: result.txHash,
        txType: "fund_escrow",
      });

      return {
        txHash: result.txHash,
        success: "Escrow funded on Stellar.",
      };
    });
  }, [address, escrow, job.budget, job.clientWallet, runEscrowAction, signTransaction, updateEscrowStatus]);

  const submitWork = useCallback(async () => {
    await runEscrowAction("submit_work", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "funded") {
        throw new Error("Escrow must be funded before work can be submitted.");
      }

      const result = await submitWorkOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: address!,
        signTransaction,
        freelancer: job.selectedFreelancerWallet!,
        escrowId,
      });

      await updateEscrowStatus({
        escrowId,
        status: "submitted",
        txHash: result.txHash,
        txType: "submit_work",
      });

      return {
        txHash: result.txHash,
        success: "Work submitted on Stellar.",
      };
    });
  }, [address, escrow, job.selectedFreelancerWallet, runEscrowAction, signTransaction, updateEscrowStatus]);

  const approveAndRelease = useCallback(
    async ({ rating, reviewText }: { rating: number; reviewText: string }) => {
      await runEscrowAction("release_payment", async ({ config }) => {
        const escrowId = getEscrowIdOrThrow(escrow);
        if (escrow?.status !== "submitted") {
          throw new Error("Escrow must be submitted before payment can be released.");
        }

        requireRating(rating);

        const normalizedReviewText = reviewText.trim();
        const reviewSource = normalizedReviewText || "Highrable MVP verified review";
        const reviewHash = await toBytesN32Hash(reviewSource);
        const result = await approveAndReleaseOnChain({
          rpcUrl: config.rpcUrl,
          networkPassphrase: config.networkPassphrase,
          escrowContractId: config.escrowContractId,
          sourceAddress: address!,
          signTransaction,
          client: job.clientWallet,
          escrowId,
          rating,
          reviewHash,
        });

        await updateEscrowStatus({
          escrowId,
          status: "released",
          txHash: result.txHash,
          txType: "release_payment",
        });

        await createReputationRecord({
          escrowId,
          jobId: job._id,
          clientWallet: job.clientWallet,
          freelancerWallet: job.selectedFreelancerWallet!,
          amount: job.budget,
          rating,
          ...(normalizedReviewText ? { reviewText: normalizedReviewText } : {}),
          reviewHash: bytesToHex(reviewHash),
          txHash: result.txHash,
        });

        return {
          txHash: result.txHash,
          success: "Payment released and reputation recorded.",
        };
      });
    },
    [
      address,
      createReputationRecord,
      escrow,
      job._id,
      job.budget,
      job.clientWallet,
      job.selectedFreelancerWallet,
      runEscrowAction,
      signTransaction,
      updateEscrowStatus,
    ],
  );

  const cancelEscrow = useCallback(async () => {
    await runEscrowAction("cancel_escrow", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "created" && escrow?.status !== "funded") {
        throw new Error("Escrow can only be cancelled before work is submitted.");
      }

      const result = await cancelEscrowOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: address!,
        signTransaction,
        client: job.clientWallet,
        escrowId,
      });

      await updateEscrowStatus({
        escrowId,
        status: "cancelled",
        txHash: result.txHash,
        txType: "cancel_escrow",
      });

      return {
        txHash: result.txHash,
        success: "Escrow cancelled on Stellar.",
      };
    });
  }, [address, escrow, job.clientWallet, runEscrowAction, signTransaction, updateEscrowStatus]);

  const markDisputed = useCallback(async () => {
    await runEscrowAction("mark_disputed", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "funded" && escrow?.status !== "submitted") {
        throw new Error("Escrow can only be disputed after funding and before release.");
      }

      const result = await markDisputedOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: address!,
        signTransaction,
        caller: address!,
        escrowId,
      });

      await updateEscrowStatus({
        escrowId,
        status: "disputed",
        txHash: result.txHash,
        txType: "mark_disputed",
      });

      return {
        txHash: result.txHash,
        success: "Escrow marked disputed on Stellar.",
      };
    });
  }, [address, escrow, runEscrowAction, signTransaction, updateEscrowStatus]);

  return {
    ...state,
    isPending,
    role,
    txExplorerUrl,
    createEscrow,
    fundEscrow,
    submitWork,
    approveAndRelease,
    cancelEscrow,
    markDisputed,
  };
}
