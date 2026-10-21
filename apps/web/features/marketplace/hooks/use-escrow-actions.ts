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
import { bytesToHex, toBytesN32Hash } from "@/core/stellar/hashes";
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
import {
  getEscrowActionGuard,
  type TEscrowActionGuardAction,
} from "@/features/marketplace/lib/escrow-action-guards";
import { mapStellarPhaseToMarketplaceProgress } from "@/features/marketplace/lib/escrow-progress";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { IPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import type { TStellarExecutionPhase } from "@/core/stellar/transaction";
import type { TActorRole, TMarketplaceEscrowProgress } from "@/features/marketplace/types";
import type { TConvexDoc } from "@repo/convex-client";

type TEscrowAction = TEscrowActionGuardAction;

type TEscrowActionState = {
  pendingAction: TEscrowAction | null;
  error: string | null;
  success: string | null;
  txHash: string | null;
  progress: TMarketplaceEscrowProgress | null;
};

type TSyncEscrowStatusResult = {
  readonly ok: boolean;
  readonly newStatus?: string;
  readonly reason?: string;
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

function isInvalidEscrowStatusError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\bInvalidStatus\b|invalid status|Error\(Contract,\s*#6\)/i.test(message);
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

async function assertSufficientEscrowAssetBalance(input: {
  readonly activeWalletAddress: string;
  readonly activeWalletType: "external_wallet" | "passkey_smart_account";
  readonly config: ReturnType<typeof getRequiredEscrowActionConfig>;
  readonly escrowAsset: TEscrowPaymentAsset;
  readonly amount: number | string;
}): Promise<void> {
  const requiredBalance = parseEscrowAssetAmount(input.escrowAsset, input.amount);
  const escrowTokenBalance = await getTokenBalanceOnChain({
    rpcUrl: input.config.rpcUrl,
    networkPassphrase: input.config.networkPassphrase,
    tokenContractId: input.escrowAsset.tokenContractId,
    sourceAddress:
      input.activeWalletType === "passkey_smart_account"
        ? getSmartAccountKit().deployerPublicKey
        : input.activeWalletAddress,
    walletAddress: input.activeWalletAddress,
  });

  if (escrowTokenBalance >= requiredBalance) {
    return;
  }

  throw new Error(
    input.activeWalletType === "passkey_smart_account"
      ? `Your passkey smart account does not have enough ${input.escrowAsset.symbol}.`
      : `You need more ${input.escrowAsset.symbol} before creating or funding this escrow.`,
  );
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncEscrowStatusAction = useAction((api as any).sync.syncEscrowStatus);
  const [state, setState] = useState<TEscrowActionState>({
    pendingAction: null,
    error: null,
    success: null,
    txHash: null,
    progress: null,
  });

  const role = useMemo(
    () => detectRole(walletIdentity.walletAddress, job, applications),
    [applications, job, walletIdentity.walletAddress],
  );
  const isPending = state.pendingAction !== null;
  const txExplorerUrl = state.txHash ? getTxExplorerUrl(state.txHash) : null;
  const activeWalletAddress = walletIdentity.walletAddress;
  const activeWalletType = walletIdentity.walletType ?? "external_wallet";
  const actionContextKey = `${job._id}:${activeWalletAddress ?? ""}:${walletIdentity.walletType ?? ""}:${walletIdentity.isConnected}:${walletIdentity.canSignEscrowTransactions}:${walletState.isTestnet}:${walletState.isFunded}:${walletState.canWriteContracts}`;
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
      const clientRequestId = createClientRequestId(action, job._id);
      setState({
        pendingAction: action,
        error: null,
        success: null,
        txHash: null,
        progress: "preparing",
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
          // The transaction row might not exist if validation failed before creation.
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
      updateTransactionStatus,
      validateBaseAction,
    ],
  );

  const createEscrow = useCallback(async () => {
    return await runEscrowAction(
      "create_escrow",
      async ({ clientRequestId, config, escrowAsset, onPhase, onRecovery, onProgress }) => {
        if (job.status !== "selected" || escrow) {
          throw new Error("Escrow can only be created after a freelancer is selected.");
        }
        await assertSufficientEscrowAssetBalance({
          activeWalletAddress: activeWalletAddress!,
          activeWalletType,
          config,
          escrowAsset,
          amount: job.budget,
        });

        const jobHash = await toBytesN32Hash(job.jobHash);
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
          freelancer: job.selectedFreelancerWallet!,
          asset: escrowAsset.tokenContractId,
          amount: job.budget,
          assetDecimals: escrowAsset.decimals,
          jobHash,
        });

        onProgress("recording", result.txHash);
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
      },
    );
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
    return await runEscrowAction(
      "fund_escrow",
      async ({ clientRequestId, config, escrowAsset, passkeyReadiness, onPhase, onProgress }) => {
        const escrowId = getEscrowIdOrThrow(escrow);
        if (escrow?.status !== "created") {
          throw new Error("Escrow must be created before it can be funded.");
        }

        const preSignCheck = () =>
          assertSufficientEscrowAssetBalance({
            activeWalletAddress: activeWalletAddress!,
            activeWalletType,
            config,
            escrowAsset,
            amount: job.budget,
          });

        let executionPhase: TStellarExecutionPhase | null = null;
        let result: Awaited<ReturnType<typeof fundEscrowOnChain>>;
        try {
          result = await fundEscrowOnChain({
            rpcUrl: config.rpcUrl,
            networkPassphrase: config.networkPassphrase,
            escrowContractId: config.escrowContractId,
            sourceAddress: activeWalletAddress!,
            signTransaction,
            preSignCheck,
            walletType: activeWalletType,
            operationId: clientRequestId,
            passkeyReadiness: passkeyReadiness ?? undefined,
            onPhase: (phase) => {
              executionPhase = phase;
              onPhase(phase);
            },
            client: job.clientWallet,
            escrowId,
          });
        } catch (error) {
          if (executionPhase !== "simulation" || !isInvalidEscrowStatusError(error)) {
            throw error;
          }

          let syncResult: TSyncEscrowStatusResult | null = null;
          try {
            syncResult = (await syncEscrowStatusAction({
              escrowId,
              expectedEscrowContractId: config.escrowContractId,
              expectedNetworkPassphrase: config.networkPassphrase,
            })) as TSyncEscrowStatusResult;
          } catch {
            // Preserve the simulation failure if status reconciliation is unavailable.
          }

          if (syncResult?.newStatus && syncResult.newStatus !== "created") {
            throw new Error(
              `Funding was not submitted because the escrow is ${syncResult.newStatus} on Stellar. ${
                syncResult.ok
                  ? "Highrable refreshed the local escrow status."
                  : "Highrable kept the current local status because it could not apply this chain update."
              }`,
            );
          }

          if (syncResult?.reason === "contract_config_mismatch") {
            throw new Error(
              "Stellar rejected funding with InvalidStatus. Highrable could not refresh the local record because its web and Convex contract/network configuration differ.",
            );
          }

          if (syncResult?.ok && syncResult.newStatus === "created") {
            throw new Error(
              "Stellar rejected funding even though the latest escrow state is Created. No transaction was submitted; verify the configured escrow deployment before retrying.",
            );
          }

          throw new Error(
            "Stellar rejected funding with InvalidStatus, but Highrable could not verify the latest on-chain status. No transaction was submitted; check the escrow on Stellar before retrying.",
          );
        }

        onProgress("recording", result.txHash);
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
      },
    );
  }, [
    activeWalletAddress,
    activeWalletType,
    escrow,
    job.budget,
    job.clientWallet,
    runEscrowAction,
    signTransaction,
    syncEscrowStatusAction,
    updateEscrowStatus,
  ]);

  const submitWork = useCallback(async () => {
    return await runEscrowAction(
      "submit_work",
      async ({ clientRequestId, config, onPhase, onProgress }) => {
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
          operationId: clientRequestId,
          onPhase,
          freelancer: job.selectedFreelancerWallet!,
          escrowId,
          proofHash: await toBytesN32Hash(`legacy-submit-work:${escrowId}:${job._id}`),
        });

        onProgress("recording", result.txHash);
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
      },
    );
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
      return await runEscrowAction(
        "release_payment",
        async ({ clientRequestId, config, onPhase, onProgress }) => {
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
            operationId: clientRequestId,
            onPhase,
            client: job.clientWallet,
            escrowId,
            rating,
            reviewHash,
          });

          onProgress("recording", result.txHash);
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
        },
      );
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
    return await runEscrowAction(
      "cancel_escrow",
      async ({ clientRequestId, config, onPhase, onProgress }) => {
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
          operationId: clientRequestId,
          onPhase,
          client: job.clientWallet,
          escrowId,
        });

        onProgress("recording", result.txHash);
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
      },
    );
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
    return await runEscrowAction(
      "mark_disputed",
      async ({ clientRequestId, config, onPhase, onProgress }) => {
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
          operationId: clientRequestId,
          onPhase,
          caller: activeWalletAddress!,
          escrowId,
        });

        onProgress("recording", result.txHash);
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
      },
    );
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
