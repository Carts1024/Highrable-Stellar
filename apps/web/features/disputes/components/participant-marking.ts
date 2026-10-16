import { isPendingStellarTransactionError } from "@/core/stellar/transaction";

import type { TWalletExecutionMode } from "@/core/stellar/transactionExecutor";

export type TParticipantMarkRecordingContext = {
  readonly disputeId: string;
  readonly actorWallet: string;
  readonly actorWalletType: TWalletExecutionMode;
  readonly transactionHash: string;
  readonly clientRequestId: string;
  readonly onChainEscrowId: string;
  readonly jobId?: string;
  readonly milestoneId?: string;
};

export type TParticipantMarkingScope = {
  readonly caseId: string;
  readonly parentId: string;
  readonly escrowId: string;
  readonly walletAddress: string | null;
  readonly walletType: TWalletExecutionMode | null;
  readonly connectedWalletAddress: string | null;
  readonly isConnected: boolean;
  readonly network: string | null;
  readonly isTestnet: boolean;
  readonly canWriteContracts: boolean | undefined;
  readonly hasSigner: boolean;
  readonly permission: boolean | undefined;
};

export function createParticipantMarkingScopeKey(scope: TParticipantMarkingScope): string {
  return JSON.stringify([
    scope.caseId,
    scope.parentId,
    scope.escrowId,
    scope.walletAddress,
    scope.walletType,
    scope.connectedWalletAddress,
    scope.isConnected,
    scope.network,
    scope.isTestnet,
    scope.canWriteContracts,
    scope.hasSigner,
    scope.permission,
  ]);
}

export function getParticipantTransactionHash(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("txHash" in error)) {
    return undefined;
  }

  const transactionHash = error.txHash;
  return typeof transactionHash === "string" && transactionHash.trim()
    ? transactionHash.trim().toLowerCase()
    : undefined;
}

export function isParticipantOutcomeUncertain(params: {
  readonly error: unknown;
  readonly mayHaveSubmitted: boolean;
  readonly transactionHash?: string;
}): boolean {
  return (
    isPendingStellarTransactionError(params.error) ||
    params.mayHaveSubmitted ||
    Boolean(params.transactionHash)
  );
}
