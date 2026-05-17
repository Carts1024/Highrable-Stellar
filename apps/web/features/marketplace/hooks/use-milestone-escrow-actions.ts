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
import { bytesToHex, createMilestoneHash, toBytesN32Hash } from "@/core/stellar/hashes";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import { getSmartAccountKit } from "@/core/stellar/smart-account-kit";
import { stablecoinConfig } from "@/core/stellar/stablecoin-config";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";

import type { TActorRole } from "@/features/marketplace/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";

type TMilestoneEscrowAction =
  | "create_escrow"
  | "fund_escrow"
  | "submit_work"
  | "release_payment"
  | "cancel_escrow"
  | "mark_disputed";

type TMilestoneEscrowActionState = {
  pendingAction: TMilestoneEscrowAction | null;
  error: string | null;
  success: string | null;
  txHash: string | null;
};

function detectMilestoneRole(
  connectedWallet: string | null,
  job: TConvexDoc<"jobs">,
  milestone: TConvexDoc<"milestones">,
  applications: TConvexDoc<"applications">[],
): TActorRole {
  if (!connectedWallet) {
    return "guest";
  }

  if (isSameWallet(connectedWallet, job.clientWallet)) {
    return "client";
  }

  if (isSameWallet(connectedWallet, milestone.assignedFreelancerWallet ?? null)) {
    return "selectedFreelancer";
  }

  const isApplicant = applications.some((application) =>
    isSameWallet(application.freelancerWallet, connectedWallet),
  );

  return isApplicant ? "applicant" : "other";
}

function createClientRequestId(action: TMilestoneEscrowAction, milestoneId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${action}:milestone:${milestoneId}:${uniqueId}`;
}

function getEscrowIdOrThrow(escrow: TConvexDoc<"escrows"> | null | undefined): string {
  if (!escrow?.escrowId) {
    throw new Error("Milestone escrow record is missing the on-chain escrow ID.");
  }

  return escrow.escrowId;
}

function requireRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Release rating must be a whole number from 1 to 5.");
  }
}

export function useMilestoneEscrowActions({
  job,
  milestone,
  escrow,
  applications,
}: {
  job: TConvexDoc<"jobs">;
  milestone: TConvexDoc<"milestones">;
  escrow: TConvexDoc<"escrows"> | null | undefined;
  applications: TConvexDoc<"applications">[];
}) {
  const { address, walletState, signTransaction } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);
  const createMilestoneEscrowRecord = useMutation(api.milestones.createMilestoneEscrowRecord);
  const updateMilestoneEscrowStatus = useMutation(api.milestones.updateMilestoneEscrowStatus);
  const createReputationRecord = useMutation(api.reputation.createReputationRecord);
  const [state, setState] = useState<TMilestoneEscrowActionState>({
    pendingAction: null,
    error: null,
    success: null,
    txHash: null,
  });

  const role = useMemo(
    () => detectMilestoneRole(walletIdentity.walletAddress, job, milestone, applications),
    [applications, job, milestone, walletIdentity.walletAddress],
  );
  const isPending = state.pendingAction !== null;
  const txExplorerUrl = state.txHash ? getTxExplorerUrl(state.txHash) : null;
  const activeWalletAddress = walletIdentity.walletAddress;
  const activeWalletType = walletIdentity.walletType ?? "external_wallet";

  const validateBaseAction = useCallback(
    async (action: TMilestoneEscrowAction) => {
      const config = getRequiredEscrowActionConfig();

      if (!activeWalletAddress || !walletIdentity.isConnected) {
        throw new Error(
          "Connect a Stellar wallet or passkey smart account before using escrow actions.",
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
          throw new Error("Connect a Stellar wallet before using escrow actions.");
        }

        if (!walletState.isTestnet) {
          throw new Error("Switch your wallet to Stellar Testnet before using escrow actions.");
        }

        if (walletState.isFunded === false) {
          throw new Error("Fund your Stellar testnet account with Friendbot before using escrow.");
        }

        if (walletState.canWriteContracts === false) {
          throw new Error(
            "This wallet can view jobs but cannot sign escrow contract actions right now.",
          );
        }
      }

      if (role !== "client" && action !== "submit_work" && action !== "mark_disputed") {
        throw new Error("Only the client wallet can use this milestone escrow action.");
      }

      if (action === "submit_work" && role !== "selectedFreelancer") {
        throw new Error("Only the assigned freelancer can submit milestone work.");
      }

      if (action === "mark_disputed" && role !== "client" && role !== "selectedFreelancer") {
        throw new Error("Only the client or assigned freelancer can dispute this milestone.");
      }

      if (!milestone.assignedFreelancerWallet) {
        throw new Error("Assign a freelancer before using milestone escrow actions.");
      }

      if (!isSameWallet(milestone.asset, config.stablecoinTokenContractId)) {
        throw new Error(
          "This milestone's payment asset does not match the configured MVP stablecoin.",
        );
      }

      return config;
    },
    [
      address,
      activeWalletAddress,
      milestone.asset,
      milestone.assignedFreelancerWallet,
      role,
      walletIdentity.isConnected,
      walletIdentity.walletType,
      walletState.canWriteContracts,
      walletState.isConnected,
      walletState.isFunded,
      walletState.isTestnet,
    ],
  );

  const runEscrowAction = useCallback(
    async (
      action: TMilestoneEscrowAction,
      callback: (params: {
        config: ReturnType<typeof getRequiredEscrowActionConfig>;
      }) => Promise<{ txHash: string; success: string }>,
    ): Promise<boolean> => {
      if (state.pendingAction) {
        return false;
      }

      const clientRequestId = createClientRequestId(action, milestone._id);
      setState({ pendingAction: action, error: null, success: null, txHash: null });

      try {
        const config = await validateBaseAction(action);

        await createTransaction({
          walletAddress: activeWalletAddress!,
          type: action,
          walletType: activeWalletType,
          clientRequestId,
          ...(escrow?.escrowId ? { escrowId: escrow.escrowId } : {}),
          jobId: job._id,
          milestoneId: milestone._id,
          status: "pending",
        });

        const result = await callback({ config });

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
        return true;
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
          // Validation may fail before the transaction row exists.
        }

        setState({
          pendingAction: null,
          error: errorMessage,
          success: null,
          txHash: failedTxHash ?? null,
        });
        return false;
      }
    },
    [
      address,
      activeWalletAddress,
      activeWalletType,
      createTransaction,
      escrow?.escrowId,
      job._id,
      milestone._id,
      state.pendingAction,
      updateTransactionStatus,
      validateBaseAction,
    ],
  );

  const createEscrow = useCallback(async () => {
    return await runEscrowAction("create_escrow", async ({ config }) => {
      if (milestone.status !== "assigned" || escrow) {
        throw new Error("Milestone escrow can only be created after assignment.");
      }

      const milestoneHash = await toBytesN32Hash(
        createMilestoneHash({
          jobId: job._id,
          milestoneId: milestone._id,
          order: milestone.order,
          title: milestone.title,
        }),
      );
      const result = await createEscrowOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress!,
        signTransaction,
        walletType: activeWalletType,
        client: job.clientWallet,
        freelancer: milestone.assignedFreelancerWallet!,
        asset: config.stablecoinTokenContractId,
        amount: milestone.amount,
        jobHash: milestoneHash,
      });

      await createMilestoneEscrowRecord({
        jobId: job._id as TConvexId<"jobs">,
        milestoneId: milestone._id as TConvexId<"milestones">,
        escrowId: result.escrowId,
        clientWallet: job.clientWallet,
        freelancerWallet: milestone.assignedFreelancerWallet!,
        amount: milestone.amount,
        asset: config.stablecoinTokenContractId,
        createTxHash: result.txHash,
      });

      return {
        txHash: result.txHash,
        success: `Milestone escrow #${result.escrowId} created on Stellar.`,
      };
    });
  }, [
    activeWalletAddress,
    activeWalletType,
    createMilestoneEscrowRecord,
    escrow,
    job,
    milestone,
    runEscrowAction,
    signTransaction,
  ]);

  const fundEscrow = useCallback(async () => {
    return await runEscrowAction("fund_escrow", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "created") {
        throw new Error("Milestone escrow must be created before it can be funded.");
      }

      const requiredBalance = toTokenAmount(milestone.amount);
      const stablecoinBalance = await getStablecoinBalanceOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        stablecoinTokenContractId: config.stablecoinTokenContractId,
        sourceAddress:
          activeWalletType === "passkey_smart_account"
            ? getSmartAccountKit().deployerPublicKey
            : activeWalletAddress!,
        walletAddress: activeWalletAddress!,
      });

      if (stablecoinBalance < requiredBalance) {
        throw new Error(
          activeWalletType === "passkey_smart_account"
            ? `Your passkey smart account does not have enough ${stablecoinConfig.symbol}.`
            : `You do not have enough ${stablecoinConfig.symbol} to fund this milestone.`,
        );
      }

      const result = await fundEscrowOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress!,
        signTransaction,
        walletType: activeWalletType,
        client: job.clientWallet,
        escrowId,
      });

      await updateMilestoneEscrowStatus({
        milestoneId: milestone._id as TConvexId<"milestones">,
        escrowId,
        status: "funded",
        txHash: result.txHash,
        txType: "fund_escrow",
      });

      return { txHash: result.txHash, success: "Milestone escrow funded on Stellar." };
    });
  }, [
    activeWalletAddress,
    activeWalletType,
    escrow,
    job.clientWallet,
    milestone._id,
    milestone.amount,
    runEscrowAction,
    signTransaction,
    updateMilestoneEscrowStatus,
  ]);

  const submitWork = useCallback(async () => {
    return await runEscrowAction("submit_work", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "funded") {
        throw new Error("Milestone escrow must be funded before work can be submitted.");
      }

      const result = await submitWorkOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress!,
        signTransaction,
        walletType: activeWalletType,
        freelancer: milestone.assignedFreelancerWallet!,
        escrowId,
      });

      await updateMilestoneEscrowStatus({
        milestoneId: milestone._id as TConvexId<"milestones">,
        escrowId,
        status: "submitted",
        txHash: result.txHash,
        txType: "submit_work",
      });

      return { txHash: result.txHash, success: "Milestone work submitted on Stellar." };
    });
  }, [
    activeWalletAddress,
    activeWalletType,
    escrow,
    milestone._id,
    milestone.assignedFreelancerWallet,
    runEscrowAction,
    signTransaction,
    updateMilestoneEscrowStatus,
  ]);

  const approveAndRelease = useCallback(
    async ({ rating, reviewText }: { rating: number; reviewText: string }) => {
      return await runEscrowAction("release_payment", async ({ config }) => {
        const escrowId = getEscrowIdOrThrow(escrow);
        if (escrow?.status !== "submitted") {
          throw new Error("Milestone work must be submitted before payment can be released.");
        }

        requireRating(rating);
        const normalizedReviewText = reviewText.trim();
        const reviewHash = await toBytesN32Hash(
          normalizedReviewText || "Highrable milestone review",
        );
        const result = await approveAndReleaseOnChain({
          rpcUrl: config.rpcUrl,
          networkPassphrase: config.networkPassphrase,
          escrowContractId: config.escrowContractId,
          sourceAddress: activeWalletAddress!,
          signTransaction,
          walletType: activeWalletType,
          client: job.clientWallet,
          escrowId,
          rating,
          reviewHash,
        });

        await updateMilestoneEscrowStatus({
          milestoneId: milestone._id as TConvexId<"milestones">,
          escrowId,
          status: "released",
          txHash: result.txHash,
          txType: "release_payment",
        });

        await createReputationRecord({
          escrowId,
          jobId: job._id as TConvexId<"jobs">,
          milestoneId: milestone._id as TConvexId<"milestones">,
          clientWallet: job.clientWallet,
          freelancerWallet: milestone.assignedFreelancerWallet!,
          amount: milestone.amount,
          rating,
          ...(normalizedReviewText ? { reviewText: normalizedReviewText } : {}),
          reviewHash: bytesToHex(reviewHash),
          txHash: result.txHash,
        });

        return {
          txHash: result.txHash,
          success: "Milestone payment released and reputation recorded.",
        };
      });
    },
    [
      activeWalletAddress,
      activeWalletType,
      createReputationRecord,
      escrow,
      job._id,
      job.clientWallet,
      milestone._id,
      milestone.amount,
      milestone.assignedFreelancerWallet,
      runEscrowAction,
      signTransaction,
      updateMilestoneEscrowStatus,
    ],
  );

  const cancelEscrow = useCallback(async () => {
    return await runEscrowAction("cancel_escrow", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "created" && escrow?.status !== "funded") {
        throw new Error("Milestone escrow can only be cancelled before work is submitted.");
      }

      const result = await cancelEscrowOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress!,
        signTransaction,
        walletType: activeWalletType,
        client: job.clientWallet,
        escrowId,
      });

      await updateMilestoneEscrowStatus({
        milestoneId: milestone._id as TConvexId<"milestones">,
        escrowId,
        status: "cancelled",
        txHash: result.txHash,
        txType: "cancel_escrow",
      });

      return { txHash: result.txHash, success: "Milestone escrow cancelled on Stellar." };
    });
  }, [
    activeWalletAddress,
    activeWalletType,
    escrow,
    job.clientWallet,
    milestone._id,
    runEscrowAction,
    signTransaction,
    updateMilestoneEscrowStatus,
  ]);

  const markDisputed = useCallback(async () => {
    return await runEscrowAction("mark_disputed", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "funded" && escrow?.status !== "submitted") {
        throw new Error("Milestone escrow can only be disputed after funding and before release.");
      }

      const result = await markDisputedOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress!,
        signTransaction,
        walletType: activeWalletType,
        caller: activeWalletAddress!,
        escrowId,
      });

      await updateMilestoneEscrowStatus({
        milestoneId: milestone._id as TConvexId<"milestones">,
        escrowId,
        status: "disputed",
        txHash: result.txHash,
        txType: "mark_disputed",
      });

      return { txHash: result.txHash, success: "Milestone escrow marked disputed on Stellar." };
    });
  }, [
    activeWalletAddress,
    activeWalletType,
    escrow,
    milestone._id,
    runEscrowAction,
    signTransaction,
    updateMilestoneEscrowStatus,
  ]);

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
