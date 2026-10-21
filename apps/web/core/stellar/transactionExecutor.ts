"use client";

import { executeWithPasskeySmartAccount } from "@/core/stellar/passkeySmartAccountExecutor";
import { invokeContract } from "@/core/stellar/transaction";
import {
  StellarTransactionError,
  StellarTransactionPendingError,
} from "@/core/stellar/transaction";

import type { IPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import type {
  TConfirmedContractTx,
  TStellarSubmissionIdentity,
  TSignedTransactionSubmitter,
  TStellarExecutionPhase,
} from "@/core/stellar/transaction";
import type { xdr } from "@stellar/stellar-sdk";

export type TWalletExecutionMode = "external_wallet" | "passkey_smart_account";

export interface IExecuteHighrableContractCallParams {
  readonly walletType: TWalletExecutionMode;
  readonly walletAddress: string;
  readonly action: string;
  readonly contractId: string;
  readonly method: string;
  readonly args: readonly xdr.ScVal[];
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly signTransaction?: TSignedTransactionSubmitter;
  readonly operationId?: string;
  readonly passkeyReadiness?: IPasskeyEscrowExecutionReadiness;
  readonly onSigned?: (identity: TStellarSubmissionIdentity) => Promise<void>;
  readonly onPhase?: (phase: TStellarExecutionPhase) => void;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export async function executeHighrableContractCall(
  params: IExecuteHighrableContractCallParams,
): Promise<TConfirmedContractTx> {
  if (params.walletType === "external_wallet") {
    if (!params.signTransaction) {
      throw new Error("External wallet signing is not available.");
    }

    return await invokeContract({
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      sourceAddress: params.walletAddress,
      contractId: params.contractId,
      method: params.method,
      args: [...params.args],
      signTransaction: params.signTransaction,
      operationId: params.operationId,
      onSigned: params.onSigned,
      onPhase: params.onPhase,
    });
  }

  const result = await executeWithPasskeySmartAccount({
    smartAccountAddress: params.walletAddress,
    actionLabel: params.action,
    contractId: params.contractId,
    method: params.method,
    args: params.args,
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    executionReadiness: params.passkeyReadiness,
    onSigned: params.onSigned,
    onPhase: params.onPhase,
  });

  if (result.status === "pending") {
    throw new StellarTransactionPendingError(
      result.errorMessage ?? "Transaction submission is still being confirmed.",
      result.txHash || undefined,
    );
  }
  if (result.status !== "success") {
    throw new StellarTransactionError(
      result.errorMessage ?? "Passkey smart account transaction failed.",
      result.txHash || undefined,
    );
  }

  if (!result.txHash) {
    throw new Error(result.errorMessage ?? "Passkey smart account transaction failed.");
  }

  return {
    txHash: result.txHash,
    result: result.result,
    returnValue: result.returnValue,
  };
}
