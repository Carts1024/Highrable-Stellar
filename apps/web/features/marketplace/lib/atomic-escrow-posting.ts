import { STELLAR_NETWORK } from "@/core/config/stellar-contracts";
import {
  createAndFundOpenEscrowOnChain,
  EscrowIdRecoveryError,
} from "@/core/stellar/escrow-contract";
import {
  isPendingStellarTransactionError,
  normalizeStellarError,
} from "@/core/stellar/transaction";

import type { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import type { TMarketplaceEscrowProgress } from "@/features/marketplace/types";
import type { TConvexId } from "@repo/convex-client";

type TCreateAtomicTransactionArgs = {
  walletAddress: string;
  type: "create_escrow";
  walletType: "external_wallet";
  network: typeof STELLAR_NETWORK;
  feePath: "external_wallet";
  clientRequestId: string;
  jobId: TConvexId<"jobs">;
  status: "pending";
};

type TUpdateAtomicTransactionArgs = {
  clientRequestId: string;
  txHash?: string;
  transactionHash?: string;
  status: "pending" | "success" | "failed";
  errorMessage?: string;
  transactionValidUntil?: number;
  submissionIdentityType?: "transaction" | "inner_transaction";
};

type TCreateFundedEscrowArgs = {
  jobId: TConvexId<"jobs">;
  escrowId: string;
  clientWallet: string;
  amount: number;
  asset: string;
  status: "funded";
  createTxHash: string;
  fundTxHash: string;
};

export type TAtomicOpenEscrowOutcome =
  | { kind: "success"; escrowId: string; txHash: string }
  | { kind: "failed" | "pending"; message: string; txHash?: string }
  | { kind: "recovery_failed"; txHash: string; message: string }
  | {
      kind: "bookkeeping_failed";
      escrowId: string;
      txHash: string;
      escrowRecordSaved: boolean;
      message: string;
    };

export async function runAtomicOpenEscrowPosting(params: {
  readonly config: Pick<
    ReturnType<typeof getRequiredEscrowActionConfig>,
    "rpcUrl" | "networkPassphrase" | "escrowContractId"
  >;
  readonly walletAddress: string;
  readonly jobId: TConvexId<"jobs">;
  readonly clientRequestId: string;
  readonly amount: number;
  readonly asset: string;
  readonly assetDecimals: number;
  readonly jobHash: Uint8Array;
  readonly signTransaction: (
    xdr: string,
    options?: { requiresServerSession?: boolean },
  ) => Promise<string>;
  readonly createTransaction: (args: TCreateAtomicTransactionArgs) => Promise<unknown>;
  readonly updateTransactionStatus: (args: TUpdateAtomicTransactionArgs) => Promise<unknown>;
  readonly createEscrowRecord: (args: TCreateFundedEscrowArgs) => Promise<unknown>;
  readonly onProgress: (progress: TMarketplaceEscrowProgress) => void;
}): Promise<TAtomicOpenEscrowOutcome> {
  let transactionRecordCreated = false;
  let confirmedEscrowId: string | undefined;
  let confirmedTxHash: string | undefined;
  let escrowRecordSaved = false;

  try {
    const createdTransaction = await params.createTransaction({
      walletAddress: params.walletAddress,
      type: "create_escrow",
      walletType: "external_wallet",
      network: STELLAR_NETWORK,
      feePath: "external_wallet",
      clientRequestId: params.clientRequestId,
      jobId: params.jobId,
      status: "pending",
    });
    if (!createdTransaction) {
      throw new Error(
        "The pending transaction history row could not be created before submission.",
      );
    }
    transactionRecordCreated = true;

    const result = await createAndFundOpenEscrowOnChain({
      rpcUrl: params.config.rpcUrl,
      networkPassphrase: params.config.networkPassphrase,
      escrowContractId: params.config.escrowContractId,
      sourceAddress: params.walletAddress,
      signTransaction: params.signTransaction,
      operationId: params.clientRequestId,
      onSigned: async (identity) => {
        const updatedTransaction = await params.updateTransactionStatus({
          clientRequestId: params.clientRequestId,
          txHash: identity.transactionHash,
          transactionHash: identity.transactionHash,
          status: "pending",
          transactionValidUntil: identity.transactionValidUntil,
          ...(identity.identityType ? { submissionIdentityType: identity.identityType } : {}),
        });
        if (!updatedTransaction) {
          throw new Error("The transaction history row could not be updated before submission.");
        }
      },
      onPhase: (phase) => {
        const progressByPhase = {
          simulation: "simulating",
          signing: "awaiting_signature",
          submission: "submitting",
          confirmation: "confirming",
        } satisfies Record<
          "simulation" | "signing" | "submission" | "confirmation",
          TMarketplaceEscrowProgress
        >;
        params.onProgress(progressByPhase[phase]);
      },
      onRecovery: () => params.onProgress("recovering_escrow_id"),
      client: params.walletAddress,
      asset: params.asset,
      amount: params.amount,
      assetDecimals: params.assetDecimals,
      jobHash: params.jobHash,
    });

    confirmedEscrowId = result.escrowId;
    confirmedTxHash = result.txHash;
    params.onProgress("recording");

    const escrowRecord = await params.createEscrowRecord({
      jobId: params.jobId,
      escrowId: result.escrowId,
      clientWallet: params.walletAddress,
      amount: params.amount,
      asset: params.asset,
      status: "funded",
      createTxHash: result.txHash,
      fundTxHash: result.txHash,
    });
    if (!escrowRecord) {
      throw new Error("The confirmed funded escrow record was not saved locally.");
    }
    escrowRecordSaved = true;

    const updatedTransaction = await params.updateTransactionStatus({
      clientRequestId: params.clientRequestId,
      txHash: result.txHash,
      transactionHash: result.txHash,
      status: "success",
    });
    if (!updatedTransaction) {
      throw new Error("The confirmed transaction history row could not be found.");
    }

    return { kind: "success", escrowId: result.escrowId, txHash: result.txHash };
  } catch (error) {
    const confirmedRecovery = error instanceof EscrowIdRecoveryError && error.chainConfirmed;
    const uncertainRecovery = error instanceof EscrowIdRecoveryError && !error.chainConfirmed;
    if (confirmedRecovery) {
      confirmedTxHash = error.txHash;
      params.onProgress("recording");
    }
    const message = uncertainRecovery
      ? `Stellar has not confirmed transaction ${error.txHash}; escrow ID recovery could not establish its outcome. The transaction remains pending. Check its status before retrying. ${normalizeStellarError(error)}`
      : normalizeStellarError(error);
    const txHash = confirmedTxHash ?? getErrorTxHash(error);
    const pending =
      !confirmedTxHash && (uncertainRecovery || isPendingStellarTransactionError(error));

    if (transactionRecordCreated) {
      try {
        await params.updateTransactionStatus({
          clientRequestId: params.clientRequestId,
          ...(txHash ? { txHash, transactionHash: txHash } : {}),
          status: confirmedTxHash ? "success" : pending ? "pending" : "failed",
          errorMessage:
            confirmedTxHash && !escrowRecordSaved
              ? `Stellar confirmed the atomic escrow, but local escrow recording failed. ${message}`
              : message,
        });
      } catch {
        // Keep the existing row and any hash recorded immediately after signing.
      }
    }

    if (confirmedEscrowId && confirmedTxHash) {
      return {
        kind: "bookkeeping_failed",
        escrowId: confirmedEscrowId,
        txHash: confirmedTxHash,
        escrowRecordSaved,
        message,
      };
    }

    if (confirmedTxHash) {
      return { kind: "recovery_failed", txHash: confirmedTxHash, message };
    }

    if (pending) {
      return { kind: "pending", message, ...(txHash ? { txHash } : {}) };
    }

    return { kind: "failed", message, ...(txHash ? { txHash } : {}) };
  }
}

function getErrorTxHash(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "txHash" in error &&
    typeof error.txHash === "string"
    ? error.txHash
    : undefined;
}
