"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { cancelEscrowOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { getWalletNetworkMismatchMessage, isWalletOnConfiguredNetwork } from "@/core/wallet/config";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";

import type { TConvexDoc } from "@repo/convex-client";

type TCancellationPendingAction = "execute_cancel" | null;

type TCancellationActionState = {
  pendingAction: TCancellationPendingAction;
  error: string | null;
  success: string | null;
  txHash: string | null;
};

function createClientRequestId(requestId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `cancel_escrow:cancellation:${requestId}:${uniqueId}`;
}

export function useCancellationActions() {
  const { address, walletState, signTransaction } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);
  const markStarted = useMutation(api.cancellations.markCancelOnChainStarted);
  const markSucceeded = useMutation(api.cancellations.markCancelOnChainSucceeded);
  const markFailed = useMutation(api.cancellations.markCancelOnChainFailed);
  const [state, setState] = useState<TCancellationActionState>({
    pendingAction: null,
    error: null,
    success: null,
    txHash: null,
  });

  const activeWalletAddress = walletIdentity.walletAddress;
  const activeWalletType = walletIdentity.walletType ?? "external_wallet";

  const validateWallet = useCallback(async () => {
    if (!activeWalletAddress || !walletIdentity.isConnected) {
      throw new Error(
        "Connect a Stellar wallet or passkey smart account before cancelling escrow.",
      );
    }
    if (walletIdentity.walletType === "passkey_smart_account") {
      const readiness = await getPasskeyEscrowExecutionReadiness();
      if (!readiness.canExecute) {
        throw new Error(
          readiness.reason ?? "Smart account fee funding or relayer configuration is missing.",
        );
      }
      return;
    }
    if (!address || !walletState.isConnected) {
      throw new Error("Connect a Stellar wallet before cancelling escrow.");
    }
    if (!isWalletOnConfiguredNetwork(walletState)) {
      throw new Error(getWalletNetworkMismatchMessage("cancelling escrow"));
    }
    if (walletState.isFunded === false) {
      throw new Error("Fund your Stellar testnet account with Friendbot before cancelling escrow.");
    }
    if (walletState.canWriteContracts === false) {
      throw new Error("This wallet cannot sign escrow contract actions right now.");
    }
  }, [
    activeWalletAddress,
    address,
    walletIdentity.isConnected,
    walletIdentity.walletType,
    walletState.canWriteContracts,
    walletState.isConnected,
    walletState.isFunded,
    walletState.isTestnet,
  ]);

  const executeCancellation = useCallback(
    async (request: TConvexDoc<"cancellationRequests">): Promise<boolean> => {
      if (state.pendingAction) return false;

      const clientRequestId = createClientRequestId(request._id);
      setState({ pendingAction: "execute_cancel", error: null, success: null, txHash: null });

      try {
        await validateWallet();
        if (!request.onChainEscrowId) {
          throw new Error("No on-chain escrow id is linked to this cancellation request.");
        }
        if (request.clientWallet !== activeWalletAddress) {
          throw new Error("Only the client wallet can execute cancellation.");
        }

        const config = getRequiredEscrowActionConfig();
        await createTransaction({
          walletAddress: activeWalletAddress,
          type: "cancel_escrow",
          walletType: activeWalletType,
          clientRequestId,
          escrowId: request.onChainEscrowId,
          ...(request.jobId ? { jobId: request.jobId } : {}),
          ...(request.milestoneId ? { milestoneId: request.milestoneId } : {}),
          status: "pending",
        });
        await markStarted({
          cancellationRequestId: request._id,
          actorWallet: activeWalletAddress,
          actorWalletType: activeWalletType,
        });

        const result = await cancelEscrowOnChain({
          rpcUrl: config.rpcUrl,
          networkPassphrase: config.networkPassphrase,
          escrowContractId: config.escrowContractId,
          sourceAddress: activeWalletAddress,
          signTransaction,
          walletType: activeWalletType,
          client: request.clientWallet,
          escrowId: request.onChainEscrowId,
        });

        const stellarExpertUrl = getTxExplorerUrl(result.txHash) ?? undefined;
        await markSucceeded({
          cancellationRequestId: request._id,
          actorWallet: activeWalletAddress,
          actorWalletType: activeWalletType,
          transactionHash: result.txHash,
          ...(stellarExpertUrl ? { stellarExpertUrl } : {}),
        });
        await updateTransactionStatus({
          clientRequestId,
          txHash: result.txHash,
          status: "success",
        });

        setState({
          pendingAction: null,
          error: null,
          success: "Escrow cancellation confirmed on Stellar.",
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
          await markFailed({
            cancellationRequestId: request._id,
            actorWallet: activeWalletAddress ?? request.clientWallet,
            actorWalletType: activeWalletType,
            errorMessage,
            ...(failedTxHash ? { transactionHash: failedTxHash } : {}),
          });
          await updateTransactionStatus({
            clientRequestId,
            ...(failedTxHash ? { txHash: failedTxHash } : {}),
            status: "failed",
            errorMessage,
          });
        } catch {
          // Keep the local wallet error visible even if Convex status update fails.
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
      activeWalletAddress,
      activeWalletType,
      createTransaction,
      markFailed,
      markStarted,
      markSucceeded,
      signTransaction,
      state.pendingAction,
      updateTransactionStatus,
      validateWallet,
    ],
  );

  return {
    ...state,
    isPending: state.pendingAction !== null,
    txExplorerUrl: state.txHash ? getTxExplorerUrl(state.txHash) : null,
    executeCancellation,
  };
}
