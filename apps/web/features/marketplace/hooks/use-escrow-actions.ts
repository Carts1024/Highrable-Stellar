"use client";

import { getRequiredEscrowActionConfig, STELLAR_NETWORK } from "@/core/config/stellar-contracts";
import {
  approveAndReleaseOnChain,
  cancelEscrowOnChain,
  createEscrowOnChain,
  fundEscrowOnChain,
  getTokenBalanceOnChain,
  markDisputedOnChain,
  submitWorkOnChain,
} from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { bytesToHex, toBytesN32Hash } from "@/core/stellar/hashes";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import {
  parseEscrowAssetAmount,
  requireSupportedEscrowAsset,
  type TEscrowPaymentAsset,
} from "@/core/stellar/payment-assets";
import { getSmartAccountKit } from "@/core/stellar/smart-account-kit";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { getWalletNetworkMismatchMessage, isWalletOnConfiguredNetwork } from "@/core/wallet/config";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import {
  getEscrowActionGuard,
  type TEscrowActionGuardAction,
} from "@/features/marketplace/lib/escrow-action-guards";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";

import type { IPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import type { TActorRole } from "@/features/marketplace/types";
import type { TConvexDoc } from "@repo/convex-client";

type TEscrowAction = TEscrowActionGuardAction;

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

function getTransactionFeeMetadata(
  walletType: "external_wallet" | "passkey_smart_account",
  readiness: IPasskeyEscrowExecutionReadiness | null,
): {
  feePath: "external_wallet" | "relayer" | "classic_source_account";
  sourceAccount?: string;
} {
  if (walletType === "external_wallet") {
    return { feePath: "external_wallet" };
  }

  return {
    feePath: readiness?.feePath === "relayer" ? "relayer" : "classic_source_account",
    ...(readiness?.classicSourceAddress ? { sourceAccount: readiness.classicSourceAddress } : {}),
  };
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
  const walletIdentity = useHighrableWalletIdentity();
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

  const role = useMemo(
    () => detectRole(walletIdentity.walletAddress, job, applications),
    [applications, job, walletIdentity.walletAddress],
  );
  const isPending = state.pendingAction !== null;
  const txExplorerUrl = state.txHash ? getTxExplorerUrl(state.txHash) : null;
  const activeWalletAddress = walletIdentity.walletAddress;
  const activeWalletType = walletIdentity.walletType ?? "external_wallet";

  const validateBaseAction = useCallback(
    async (action: TEscrowAction) => {
      const config = getRequiredEscrowActionConfig();
      let passkeyReadiness: IPasskeyEscrowExecutionReadiness | null = null;

      if (!activeWalletAddress || !walletIdentity.isConnected) {
        throw new Error(
          "Connect a Stellar wallet or passkey smart account before using escrow actions.",
        );
      }

      if (walletIdentity.walletType === "passkey_smart_account") {
        passkeyReadiness = await getPasskeyEscrowExecutionReadiness();
        if (!passkeyReadiness.canExecute) {
          throw new Error(
            passkeyReadiness.reason ??
              "Smart account fee funding or relayer configuration is missing.",
          );
        }
      } else {
        if (!address || !walletState.isConnected) {
          throw new Error("Connect a Stellar wallet before using escrow actions.");
        }

        if (!isWalletOnConfiguredNetwork(walletState)) {
          throw new Error(getWalletNetworkMismatchMessage("using escrow actions"));
        }

        if (walletState.isFunded === false) {
          throw new Error("Fund your Stellar testnet account with Friendbot before using escrow.");
        }
      }

      if (!job.clientWallet) {
        throw new Error("Job is missing the client wallet.");
      }

      const actionRequiresSelectedFreelancer =
        action === "create_escrow" ||
        action === "submit_work" ||
        action === "release_payment" ||
        action === "mark_disputed";

      if (actionRequiresSelectedFreelancer && !job.selectedFreelancerWallet) {
        throw new Error("Select a freelancer before using this escrow action.");
      }

      const escrowAsset = requireSupportedEscrowAsset(job.asset);

      if (!job.jobHash) {
        throw new Error("Job is missing a hash for the escrow contract.");
      }

      const guardResult = getEscrowActionGuard({
        action,
        role,
        job,
        escrow,
        wallet: {
          isConnected: walletIdentity.isConnected,
          isOnConfiguredNetwork:
            walletIdentity.walletType === "passkey_smart_account"
              ? true
              : isWalletOnConfiguredNetwork(walletState),
          isFunded:
            walletIdentity.walletType === "passkey_smart_account" ? null : walletState.isFunded,
          canWriteContracts:
            walletIdentity.walletType === "passkey_smart_account"
              ? true
              : walletState.canWriteContracts,
          writeRestrictionReason: null,
          walletType: walletIdentity.walletType,
        },
      });

      if (!guardResult.canAct) {
        throw new Error(guardResult.reason ?? "This escrow action is not currently available.");
      }

      return { config, escrowAsset, passkeyReadiness };
    },
    [
      address,
      activeWalletAddress,
      escrow,
      job,
      role,
      walletIdentity.isConnected,
      walletIdentity.walletType,
      walletState.isConnected,
      walletState.canWriteContracts,
      walletState.isFunded,
      walletState.isTestnet,
    ],
  );

  const runEscrowAction = useCallback(
    async (
      action: TEscrowAction,
      callback: (params: {
        clientRequestId: string;
        config: ReturnType<typeof getRequiredEscrowActionConfig>;
        escrowAsset: TEscrowPaymentAsset;
        passkeyReadiness: IPasskeyEscrowExecutionReadiness | null;
      }) => Promise<{ txHash: string; success: string }>,
    ): Promise<boolean> => {
      if (state.pendingAction) {
        return false;
      }

      const clientRequestId = createClientRequestId(action, job._id);
      setState({
        pendingAction: action,
        error: null,
        success: null,
        txHash: null,
      });

      try {
        const { config, escrowAsset, passkeyReadiness } = await validateBaseAction(action);
        const escrowId = escrow?.escrowId;
        const feeMetadata = getTransactionFeeMetadata(activeWalletType, passkeyReadiness);

        await createTransaction({
          walletAddress: activeWalletAddress!,
          type: action,
          walletType: activeWalletType,
          network: STELLAR_NETWORK,
          ...feeMetadata,
          clientRequestId,
          ...(escrowId ? { escrowId } : {}),
          jobId: job._id,
          status: "pending",
        });

        const result = await callback({ clientRequestId, config, escrowAsset, passkeyReadiness });

        await updateTransactionStatus({
          clientRequestId,
          txHash: result.txHash,
          transactionHash: result.txHash,
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
            ...(failedTxHash ? { transactionHash: failedTxHash } : {}),
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
      state.pendingAction,
      updateTransactionStatus,
      validateBaseAction,
    ],
  );

  const createEscrow = useCallback(async () => {
    return await runEscrowAction("create_escrow", async ({ config, escrowAsset }) => {
      if (job.status !== "selected" || escrow) {
        throw new Error("Escrow can only be created after a freelancer is selected.");
      }

      const jobHash = await toBytesN32Hash(job.jobHash);
      const result = await createEscrowOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress!,
        signTransaction,
        walletType: activeWalletType,
        client: job.clientWallet,
        freelancer: job.selectedFreelancerWallet!,
        asset: escrowAsset.tokenContractId,
        amount: job.budget,
        assetDecimals: escrowAsset.decimals,
        jobHash,
      });

      await createEscrowRecord({
        jobId: job._id,
        escrowId: result.escrowId,
        clientWallet: job.clientWallet,
        freelancerWallet: job.selectedFreelancerWallet!,
        amount: job.budget,
        asset: escrowAsset.tokenContractId,
        createTxHash: result.txHash,
      });

      return {
        txHash: result.txHash,
        success: `Escrow #${result.escrowId} created on Stellar.`,
      };
    });
  }, [
    activeWalletAddress,
    activeWalletType,
    createEscrowRecord,
    escrow,
    job,
    runEscrowAction,
    signTransaction,
  ]);

  const fundEscrow = useCallback(async () => {
    return await runEscrowAction("fund_escrow", async ({ config, escrowAsset }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "created") {
        throw new Error("Escrow must be created before it can be funded.");
      }

      const requiredBalance = parseEscrowAssetAmount(escrowAsset, job.budget);
      const escrowTokenBalance = await getTokenBalanceOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        tokenContractId: escrowAsset.tokenContractId,
        sourceAddress:
          activeWalletType === "passkey_smart_account"
            ? getSmartAccountKit().deployerPublicKey
            : activeWalletAddress!,
        walletAddress: activeWalletAddress!,
      });

      if (escrowTokenBalance < requiredBalance) {
        throw new Error(
          activeWalletType === "passkey_smart_account"
            ? `Your passkey smart account does not have enough ${escrowAsset.symbol}.`
            : `You do not have enough ${escrowAsset.symbol} to fund this escrow.`,
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
  }, [
    activeWalletAddress,
    activeWalletType,
    escrow,
    job.budget,
    job.clientWallet,
    runEscrowAction,
    signTransaction,
    updateEscrowStatus,
  ]);

  const submitWork = useCallback(async () => {
    return await runEscrowAction("submit_work", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "funded") {
        throw new Error("Escrow must be funded before work can be submitted.");
      }

      const result = await submitWorkOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress!,
        signTransaction,
        walletType: activeWalletType,
        freelancer: job.selectedFreelancerWallet!,
        escrowId,
        proofHash: await toBytesN32Hash(`legacy-submit-work:${escrowId}:${job._id}`),
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
  }, [
    activeWalletAddress,
    activeWalletType,
    escrow,
    job.selectedFreelancerWallet,
    runEscrowAction,
    signTransaction,
    updateEscrowStatus,
  ]);

  const approveAndRelease = useCallback(
    async ({ rating, reviewText }: { rating: number; reviewText: string }) => {
      return await runEscrowAction("release_payment", async ({ config }) => {
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
          sourceAddress: activeWalletAddress!,
          signTransaction,
          walletType: activeWalletType,
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
      activeWalletAddress,
      activeWalletType,
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
    return await runEscrowAction("cancel_escrow", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "created" && escrow?.status !== "funded") {
        throw new Error("Escrow can only be cancelled before work is submitted.");
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
  }, [
    activeWalletAddress,
    activeWalletType,
    escrow,
    job.clientWallet,
    runEscrowAction,
    signTransaction,
    updateEscrowStatus,
  ]);

  const markDisputed = useCallback(async () => {
    return await runEscrowAction("mark_disputed", async ({ config }) => {
      const escrowId = getEscrowIdOrThrow(escrow);
      if (escrow?.status !== "funded" && escrow?.status !== "submitted") {
        throw new Error("Escrow can only be disputed after funding and before release.");
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
  }, [
    activeWalletAddress,
    activeWalletType,
    escrow,
    runEscrowAction,
    signTransaction,
    updateEscrowStatus,
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
