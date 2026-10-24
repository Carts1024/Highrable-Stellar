"use client";

import { getRequiredEscrowActionConfig, STELLAR_NETWORK } from "@/core/config/stellar-contracts";
import {
  approveAndReleaseOnChain,
  cancelEscrowOnChain,
  createEscrowOnChain,
  EscrowIdRecoveryError,
  fundEscrowOnChain,
  getTokenBalanceOnChain,
  markDisputedOnChain,
  submitWorkOnChain,
} from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { bytesToHex, createMilestoneHash, toBytesN32Hash } from "@/core/stellar/hashes";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import {
  parseEscrowAssetAmount,
  requireSupportedEscrowAsset,
  type TEscrowPaymentAsset,
} from "@/core/stellar/payment-assets";
import { getSmartAccountKit } from "@/core/stellar/smart-account-kit";
import {
  isPendingStellarTransactionError,
  normalizeStellarError,
} from "@/core/stellar/transaction";
import { getWalletNetworkMismatchMessage, isWalletOnConfiguredNetwork } from "@/core/wallet/config";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { mapStellarPhaseToMarketplaceProgress } from "@/features/marketplace/lib/escrow-progress";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { IPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import type { TStellarExecutionPhase } from "@/core/stellar/transaction";
import type { TActorRole, TMarketplaceEscrowProgress } from "@/features/marketplace/types";
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
  progress: TMarketplaceEscrowProgress | null;
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
    progress: null,
  });

  const role = useMemo(
    () => detectMilestoneRole(walletIdentity.walletAddress, job, milestone, applications),
    [applications, job, milestone, walletIdentity.walletAddress],
  );
  const isPending = state.pendingAction !== null;
  const txExplorerUrl = state.txHash ? getTxExplorerUrl(state.txHash) : null;
  const activeWalletAddress = walletIdentity.walletAddress;
  const activeWalletType = walletIdentity.walletType ?? "external_wallet";
  const actionContextKey = `${job._id}:${milestone._id}:${activeWalletAddress ?? ""}:${walletIdentity.walletType ?? ""}:${walletIdentity.isConnected}:${walletIdentity.canSignEscrowTransactions}:${walletState.isTestnet}:${walletState.isFunded}:${walletState.canWriteContracts}`;
  const actionContextRef = useRef(actionContextKey);
  const mountedRef = useRef(false);
  const activeActionRef = useRef(false);
  const actionAttemptRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      actionAttemptRef.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    if (actionContextRef.current !== actionContextKey) {
      actionAttemptRef.current += 1;
    }
    actionContextRef.current = actionContextKey;
    setState((current) => (current.progress ? { ...current, progress: null } : current));
  }, [actionContextKey]);

  const validateBaseAction = useCallback(
    async (action: TMilestoneEscrowAction) => {
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

      const escrowAsset = requireSupportedEscrowAsset(milestone.asset);

      return { config, escrowAsset, passkeyReadiness };
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
        clientRequestId: string;
        config: ReturnType<typeof getRequiredEscrowActionConfig>;
        escrowAsset: TEscrowPaymentAsset;
        passkeyReadiness: IPasskeyEscrowExecutionReadiness | null;
        onPhase: (phase: TStellarExecutionPhase) => void;
        onRecovery: () => void;
        onProgress: (progress: TMarketplaceEscrowProgress, txHash?: string) => void;
      }) => Promise<{ txHash: string; success: string }>,
    ): Promise<boolean> => {
      if (activeActionRef.current) {
        return false;
      }

      activeActionRef.current = true;
      const actionAttempt = ++actionAttemptRef.current;
      const actionContext = actionContextRef.current;
      const isCurrentAction = () =>
        mountedRef.current &&
        actionAttemptRef.current === actionAttempt &&
        actionContextRef.current === actionContext;
      let confirmedTxHash: string | undefined;
      const clientRequestId = createClientRequestId(action, milestone._id);
      setState({
        pendingAction: action,
        error: null,
        success: null,
        txHash: null,
        progress: "preparing",
      });

      try {
        const { config, escrowAsset, passkeyReadiness } = await validateBaseAction(action);
        const feeMetadata = getTransactionFeeMetadata(activeWalletType, passkeyReadiness);

        await createTransaction({
          walletAddress: activeWalletAddress!,
          type: action,
          walletType: activeWalletType,
          network: STELLAR_NETWORK,
          ...feeMetadata,
          clientRequestId,
          ...(escrow?.escrowId ? { escrowId: escrow.escrowId } : {}),
          jobId: job._id,
          milestoneId: milestone._id,
          status: "pending",
        });

        const result = await callback({
          clientRequestId,
          config,
          escrowAsset,
          passkeyReadiness,
          onPhase: (phase) => {
            if (isCurrentAction()) {
              setState((current) => ({
                ...current,
                progress: mapStellarPhaseToMarketplaceProgress(phase),
              }));
            }
          },
          onRecovery: () => {
            if (isCurrentAction()) {
              setState((current) => ({ ...current, progress: "recovering_escrow_id" }));
            }
          },
          onProgress: (progress, txHash) => {
            if (progress === "recording" && txHash) {
              confirmedTxHash = txHash;
            }
            if (isCurrentAction()) {
              setState((current) => ({ ...current, progress }));
            }
          },
        });

        const updatedTransaction = await updateTransactionStatus({
          clientRequestId,
          txHash: result.txHash,
          transactionHash: result.txHash,
          status: "success",
        });
        if (!updatedTransaction) {
          throw new Error("The confirmed transaction history row could not be found.");
        }

        if (isCurrentAction()) {
          setState({
            pendingAction: null,
            error: null,
            success: result.success,
            txHash: result.txHash,
            progress: null,
          });
        } else if (mountedRef.current) {
          setState((current) => ({ ...current, pendingAction: null, progress: null }));
        }
        return true;
      } catch (error) {
        const confirmedRecovery = error instanceof EscrowIdRecoveryError && error.chainConfirmed;
        const uncertainRecovery = error instanceof EscrowIdRecoveryError && !error.chainConfirmed;
        if (confirmedRecovery) {
          confirmedTxHash = error.txHash;
        }
        const normalizedError = normalizeStellarError(error);
        const errorMessage = confirmedTxHash
          ? `Stellar confirmed transaction ${confirmedTxHash}, but local escrow bookkeeping could not be completed. ${normalizedError}`
          : uncertainRecovery
            ? `Stellar has not confirmed transaction ${error.txHash}; escrow ID recovery could not establish its outcome. The transaction remains pending. Check its status before retrying. ${normalizedError}`
            : normalizedError;
        const failedTxHash =
          typeof error === "object" &&
          error !== null &&
          "txHash" in error &&
          typeof error.txHash === "string"
            ? error.txHash
            : undefined;

        try {
          if (confirmedTxHash) {
            await updateTransactionStatus({
              clientRequestId,
              txHash: confirmedTxHash,
              transactionHash: confirmedTxHash,
              status: "success",
              errorMessage,
            });
          } else {
            await updateTransactionStatus({
              clientRequestId,
              ...(failedTxHash ? { txHash: failedTxHash } : {}),
              ...(failedTxHash ? { transactionHash: failedTxHash } : {}),
              status:
                uncertainRecovery || isPendingStellarTransactionError(error) ? "pending" : "failed",
              errorMessage,
            });
          }
        } catch {
          // Validation may fail before the transaction row exists.
        }

        if (isCurrentAction()) {
          setState({
            pendingAction: null,
            error: errorMessage,
            success: null,
            txHash: confirmedTxHash ?? failedTxHash ?? null,
            progress: null,
          });
        } else if (mountedRef.current) {
          setState((current) => ({ ...current, pendingAction: null, progress: null }));
        }
        return false;
      } finally {
        activeActionRef.current = false;
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
      updateTransactionStatus,
      validateBaseAction,
    ],
  );

  const createEscrow = useCallback(async () => {
    return await runEscrowAction(
      "create_escrow",
      async ({ clientRequestId, config, escrowAsset, onPhase, onRecovery, onProgress }) => {
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
          operationId: clientRequestId,
          onPhase,
          onRecovery,
          client: job.clientWallet,
          freelancer: milestone.assignedFreelancerWallet!,
          asset: escrowAsset.tokenContractId,
          amount: milestone.amount,
          assetDecimals: escrowAsset.decimals,
          jobHash: milestoneHash,
        });

        onProgress("recording", result.txHash);
        await createMilestoneEscrowRecord({
          jobId: job._id as TConvexId<"jobs">,
          milestoneId: milestone._id as TConvexId<"milestones">,
          escrowId: result.escrowId,
          clientWallet: job.clientWallet,
          freelancerWallet: milestone.assignedFreelancerWallet!,
          amount: milestone.amount,
          asset: escrowAsset.tokenContractId,
          createTxHash: result.txHash,
        });

        return {
          txHash: result.txHash,
          success: `Milestone escrow #${result.escrowId} created on Stellar.`,
        };
      },
    );
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
    return await runEscrowAction(
      "fund_escrow",
      async ({ clientRequestId, config, escrowAsset, passkeyReadiness, onPhase, onProgress }) => {
        const escrowId = getEscrowIdOrThrow(escrow);
        if (escrow?.status !== "created") {
          throw new Error("Milestone escrow must be created before it can be funded.");
        }

        const preSignCheck = async () => {
          const requiredBalance = parseEscrowAssetAmount(escrowAsset, milestone.amount);
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
                : `You do not have enough ${escrowAsset.symbol} to fund this milestone.`,
            );
          }
        };

        const result = await fundEscrowOnChain({
          rpcUrl: config.rpcUrl,
          networkPassphrase: config.networkPassphrase,
          escrowContractId: config.escrowContractId,
          sourceAddress: activeWalletAddress!,
          signTransaction,
          preSignCheck,
          walletType: activeWalletType,
          operationId: clientRequestId,
          passkeyReadiness: passkeyReadiness ?? undefined,
          onPhase,
          client: job.clientWallet,
          escrowId,
        });

        onProgress("recording", result.txHash);
        await updateMilestoneEscrowStatus({
          milestoneId: milestone._id as TConvexId<"milestones">,
          escrowId,
          status: "funded",
          txHash: result.txHash,
          txType: "fund_escrow",
        });

        return { txHash: result.txHash, success: "Milestone escrow funded on Stellar." };
      },
    );
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
    return await runEscrowAction(
      "submit_work",
      async ({ clientRequestId, config, onPhase, onProgress }) => {
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
          operationId: clientRequestId,
          onPhase,
          freelancer: milestone.assignedFreelancerWallet!,
          escrowId,
          proofHash: await toBytesN32Hash(`legacy-submit-work:${escrowId}:${milestone._id}`),
        });

        onProgress("recording", result.txHash);
        await updateMilestoneEscrowStatus({
          milestoneId: milestone._id as TConvexId<"milestones">,
          escrowId,
          status: "submitted",
          txHash: result.txHash,
          txType: "submit_work",
        });

        return { txHash: result.txHash, success: "Milestone work submitted on Stellar." };
      },
    );
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
      return await runEscrowAction(
        "release_payment",
        async ({ clientRequestId, config, onPhase, onProgress }) => {
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
            operationId: clientRequestId,
            onPhase,
            client: job.clientWallet,
            escrowId,
            rating,
            reviewHash,
          });

          onProgress("recording", result.txHash);
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
        },
      );
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
    return await runEscrowAction(
      "cancel_escrow",
      async ({ clientRequestId, config, onPhase, onProgress }) => {
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
          operationId: clientRequestId,
          onPhase,
          client: job.clientWallet,
          escrowId,
        });

        onProgress("recording", result.txHash);
        await updateMilestoneEscrowStatus({
          milestoneId: milestone._id as TConvexId<"milestones">,
          escrowId,
          status: "cancelled",
          txHash: result.txHash,
          txType: "cancel_escrow",
        });

        return { txHash: result.txHash, success: "Milestone escrow cancelled on Stellar." };
      },
    );
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
    return await runEscrowAction(
      "mark_disputed",
      async ({ clientRequestId, config, onPhase, onProgress }) => {
        const escrowId = getEscrowIdOrThrow(escrow);
        if (escrow?.status !== "funded" && escrow?.status !== "submitted") {
          throw new Error(
            "Milestone escrow can only be disputed after funding and before release.",
          );
        }

        const result = await markDisputedOnChain({
          rpcUrl: config.rpcUrl,
          networkPassphrase: config.networkPassphrase,
          escrowContractId: config.escrowContractId,
          sourceAddress: activeWalletAddress!,
          signTransaction,
          walletType: activeWalletType,
          operationId: clientRequestId,
          onPhase,
          caller: activeWalletAddress!,
          escrowId,
        });

        onProgress("recording", result.txHash);
        await updateMilestoneEscrowStatus({
          milestoneId: milestone._id as TConvexId<"milestones">,
          escrowId,
          status: "disputed",
          txHash: result.txHash,
          txType: "mark_disputed",
        });

        return { txHash: result.txHash, success: "Milestone escrow marked disputed on Stellar." };
      },
    );
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
