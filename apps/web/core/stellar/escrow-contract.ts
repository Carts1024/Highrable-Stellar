import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";

import type { TConfirmedContractTx, TSignedTransactionSubmitter } from "./transaction";
import type { TWalletExecutionMode } from "./transactionExecutor";

import { toTokenUnits } from "./amounts";
import { getSmartAccountKit } from "./smart-account-kit";
import { stablecoinConfig } from "./stablecoin-config";
import { simulateContractCall } from "./transaction";
import { executeHighrableContractCall } from "./transactionExecutor";

const CONTRACT_ACCOUNT_PATTERN = /^C[A-Z2-7]{55}$/;
const CLASSIC_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;
const STELLAR_ADDRESS_PATTERN = /^[CG][A-Z2-7]{55}$/;

type TBaseEscrowCallParams = {
  rpcUrl: string;
  networkPassphrase: string;
  escrowContractId: string;
  sourceAddress: string;
  signTransaction?: TSignedTransactionSubmitter;
  walletType?: TWalletExecutionMode;
};

type TEscrowResult = TConfirmedContractTx;
export type TNormalizedOnChainEscrowStatus =
  | "created"
  | "funded"
  | "submitted"
  | "released"
  | "cancelled"
  | "disputed";

export type TOnChainEscrow = {
  escrow_id: bigint;
  client: string;
  freelancer?: string | null;
  asset: string;
  amount: bigint;
  job_hash: Uint8Array;
  proof_hash?: Uint8Array | null;
  status: unknown;
  created_at: bigint;
  funded_at: bigint;
  submitted_at: bigint;
  released_at: bigint;
};

function addressScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

function i128ScVal(amount: bigint): xdr.ScVal {
  return nativeToScVal(amount, { type: "i128" });
}

function u32ScVal(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u32" });
}

function u64ScVal(value: string): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: "u64" });
}

function bytesN32ScVal(bytes: Uint8Array): xdr.ScVal {
  if (bytes.byteLength !== 32) {
    throw new Error("Expected a 32-byte hash for BytesN<32>.");
  }

  return nativeToScVal(bytes, { type: "bytes" });
}

function toEscrowTokenAmount(amount: number, decimals = stablecoinConfig.decimals): bigint {
  return toTokenUnits(amount, decimals);
}

async function executeEscrowContract(
  params: TBaseEscrowCallParams & {
    method: string;
    args: readonly xdr.ScVal[];
  },
): Promise<TConfirmedContractTx> {
  return await executeHighrableContractCall({
    walletType: params.walletType ?? "external_wallet",
    walletAddress: params.sourceAddress,
    action: params.method,
    contractId: params.escrowContractId,
    method: params.method,
    args: params.args,
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    signTransaction: params.signTransaction,
  });
}

function resolveReadSourceAddress(sourceAddress: string): string {
  const normalizedSourceAddress = sourceAddress.trim();

  if (CLASSIC_ACCOUNT_PATTERN.test(normalizedSourceAddress)) {
    return normalizedSourceAddress;
  }

  if (CONTRACT_ACCOUNT_PATTERN.test(normalizedSourceAddress)) {
    const deployerPublicKey = getSmartAccountKit().deployerPublicKey.trim();
    if (CLASSIC_ACCOUNT_PATTERN.test(deployerPublicKey)) {
      return deployerPublicKey;
    }

    throw new Error("Passkey smart account transaction fees are not configured.");
  }

  return normalizedSourceAddress;
}

function normalizeOnChainEscrow(value: unknown): TOnChainEscrow {
  const record = value as Partial<TOnChainEscrow> | undefined;
  if (!record || typeof record !== "object" || record.escrow_id === undefined) {
    throw new Error("On-chain escrow response was not readable.");
  }

  return record as TOnChainEscrow;
}

export function normalizeOnChainEscrowStatus(
  status: unknown,
): TNormalizedOnChainEscrowStatus | null {
  const statusMap: Record<string, TNormalizedOnChainEscrowStatus> = {
    Created: "created",
    Funded: "funded",
    Submitted: "submitted",
    Released: "released",
    Cancelled: "cancelled",
    Disputed: "disputed",
  };

  if (typeof status === "string") {
    return statusMap[status] ?? null;
  }

  if (Array.isArray(status)) {
    return status.length === 1 ? normalizeOnChainEscrowStatus(status[0]) : null;
  }

  if (typeof status === "object" && status !== null) {
    const keys = Object.keys(status);
    return keys.length === 1 && keys[0] ? (statusMap[keys[0]] ?? null) : null;
  }

  return null;
}

function normalizeOptionalAddress(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  return left.every((byte, index) => byte === right[index]);
}

async function getNextEscrowIdOnChain(params: {
  rpcUrl: string;
  networkPassphrase: string;
  escrowContractId: string;
  sourceAddress: string;
}): Promise<bigint> {
  const result = await simulateContractCall<unknown>({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: resolveReadSourceAddress(params.sourceAddress),
    contractId: params.escrowContractId,
    method: "get_next_escrow_id",
    args: [],
  });

  if (typeof result === "bigint") {
    return result;
  }

  if (typeof result === "number") {
    return BigInt(result);
  }

  throw new Error("Escrow contract did not return a readable next escrow ID.");
}

async function findCreatedEscrowIdFromState(params: {
  rpcUrl: string;
  networkPassphrase: string;
  escrowContractId: string;
  sourceAddress: string;
  startEscrowId: bigint;
  endEscrowId: bigint;
  client: string;
  freelancer?: string | null;
  asset: string;
  amount: bigint;
  jobHash: Uint8Array;
}): Promise<string> {
  const normalizedClient = params.client.trim();
  const normalizedFreelancer = normalizeOptionalAddress(params.freelancer);
  const normalizedAsset = params.asset.trim();

  for (let escrowId = params.startEscrowId; escrowId < params.endEscrowId; escrowId += 1n) {
    const escrow = await getEscrowOnChain({
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      escrowContractId: params.escrowContractId,
      sourceAddress: params.sourceAddress,
      escrowId: escrowId.toString(),
    }).catch(() => null);

    if (!escrow) {
      continue;
    }

    if (escrow.client.trim() !== normalizedClient) {
      continue;
    }

    if (normalizeOptionalAddress(escrow.freelancer ?? undefined) !== normalizedFreelancer) {
      continue;
    }

    if (escrow.asset.trim() !== normalizedAsset) {
      continue;
    }

    if (escrow.amount !== params.amount) {
      continue;
    }

    if (!bytesEqual(escrow.job_hash, params.jobHash)) {
      continue;
    }

    return escrowId.toString();
  }

  throw new Error(
    "Create escrow transaction succeeded, but the created escrow ID could not be recovered from on-chain state.",
  );
}

function resolveEscrowId(result: TEscrowResult, actionLabel: string): string {
  const nativeValue =
    typeof result.result === "bigint" || typeof result.result === "number"
      ? result.result
      : result.returnValue
        ? scValToNative(result.returnValue)
        : undefined;

  if (nativeValue === undefined) {
    throw new Error(`${actionLabel} transaction did not return an escrow ID.`);
  }

  if (typeof nativeValue !== "bigint" && typeof nativeValue !== "number") {
    throw new Error(`${actionLabel} return value was not a u64 escrow ID.`);
  }

  return nativeValue.toString();
}

function tryResolveEscrowId(result: TEscrowResult): string | null {
  try {
    return resolveEscrowId(result, "Create escrow");
  } catch {
    return null;
  }
}

function getSubmittedTxHash(error: unknown): string | null {
  return typeof error === "object" &&
    error !== null &&
    "txHash" in error &&
    typeof error.txHash === "string"
    ? error.txHash
    : null;
}

async function recoverCreatedEscrowAfterSubmission(params: {
  result: TEscrowResult;
  rpcUrl: string;
  networkPassphrase: string;
  escrowContractId: string;
  sourceAddress: string;
  startEscrowId: bigint;
  client: string;
  freelancer?: string | null;
  asset: string;
  amount: bigint;
  jobHash: Uint8Array;
}): Promise<TEscrowResult & { escrowId: string }> {
  const escrowId =
    tryResolveEscrowId(params.result) ??
    (await findCreatedEscrowIdFromState({
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      escrowContractId: params.escrowContractId,
      sourceAddress: params.sourceAddress,
      startEscrowId: params.startEscrowId,
      endEscrowId: await getNextEscrowIdOnChain({
        rpcUrl: params.rpcUrl,
        networkPassphrase: params.networkPassphrase,
        escrowContractId: params.escrowContractId,
        sourceAddress: params.sourceAddress,
      }),
      client: params.client,
      freelancer: params.freelancer,
      asset: params.asset,
      amount: params.amount,
      jobHash: params.jobHash,
    }));

  return {
    ...params.result,
    escrowId,
  };
}

export async function createEscrowOnChain(
  params: TBaseEscrowCallParams & {
    client: string;
    freelancer: string;
    asset: string;
    amount: number;
    assetDecimals?: number;
    jobHash: Uint8Array;
  },
): Promise<TEscrowResult & { escrowId: string }> {
  const nextEscrowIdBefore = await getNextEscrowIdOnChain({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    escrowContractId: params.escrowContractId,
    sourceAddress: params.sourceAddress,
  });

  const amount = toEscrowTokenAmount(params.amount, params.assetDecimals);

  try {
    const result = await executeEscrowContract({
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      sourceAddress: params.sourceAddress,
      escrowContractId: params.escrowContractId,
      method: "create_escrow",
      args: [
        addressScVal(params.client),
        addressScVal(params.freelancer),
        addressScVal(params.asset),
        i128ScVal(amount),
        bytesN32ScVal(params.jobHash),
      ],
      signTransaction: params.signTransaction,
      walletType: params.walletType,
    });

    return await recoverCreatedEscrowAfterSubmission({
      result,
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      escrowContractId: params.escrowContractId,
      sourceAddress: params.sourceAddress,
      startEscrowId: nextEscrowIdBefore,
      client: params.client,
      freelancer: params.freelancer,
      asset: params.asset,
      amount,
      jobHash: params.jobHash,
    });
  } catch (error) {
    const txHash = getSubmittedTxHash(error);
    if (!txHash) {
      throw error;
    }

    return await recoverCreatedEscrowAfterSubmission({
      result: { txHash },
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      escrowContractId: params.escrowContractId,
      sourceAddress: params.sourceAddress,
      startEscrowId: nextEscrowIdBefore,
      client: params.client,
      freelancer: params.freelancer,
      asset: params.asset,
      amount,
      jobHash: params.jobHash,
    });
  }
}

export async function createOpenEscrowOnChain(
  params: TBaseEscrowCallParams & {
    client: string;
    asset: string;
    amount: number;
    assetDecimals?: number;
    jobHash: Uint8Array;
  },
): Promise<TEscrowResult & { escrowId: string }> {
  const nextEscrowIdBefore = await getNextEscrowIdOnChain({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    escrowContractId: params.escrowContractId,
    sourceAddress: params.sourceAddress,
  });

  const amount = toEscrowTokenAmount(params.amount, params.assetDecimals);

  try {
    const result = await executeEscrowContract({
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      sourceAddress: params.sourceAddress,
      escrowContractId: params.escrowContractId,
      method: "create_open_escrow",
      args: [
        addressScVal(params.client),
        addressScVal(params.asset),
        i128ScVal(amount),
        bytesN32ScVal(params.jobHash),
      ],
      signTransaction: params.signTransaction,
      walletType: params.walletType,
    });

    return await recoverCreatedEscrowAfterSubmission({
      result,
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      escrowContractId: params.escrowContractId,
      sourceAddress: params.sourceAddress,
      startEscrowId: nextEscrowIdBefore,
      client: params.client,
      freelancer: null,
      asset: params.asset,
      amount,
      jobHash: params.jobHash,
    });
  } catch (error) {
    const txHash = getSubmittedTxHash(error);
    if (!txHash) {
      throw error;
    }

    return await recoverCreatedEscrowAfterSubmission({
      result: { txHash },
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      escrowContractId: params.escrowContractId,
      sourceAddress: params.sourceAddress,
      startEscrowId: nextEscrowIdBefore,
      client: params.client,
      freelancer: null,
      asset: params.asset,
      amount,
      jobHash: params.jobHash,
    });
  }
}

export async function createAndFundOpenEscrowOnChain(
  params: TBaseEscrowCallParams & {
    client: string;
    asset: string;
    amount: number;
    assetDecimals?: number;
    jobHash: Uint8Array;
  },
): Promise<TEscrowResult & { escrowId: string }> {
  const nextEscrowIdBefore = await getNextEscrowIdOnChain({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    escrowContractId: params.escrowContractId,
    sourceAddress: params.sourceAddress,
  });

  const result = await executeEscrowContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    escrowContractId: params.escrowContractId,
    method: "create_and_fund_open_escrow",
    args: [
      addressScVal(params.client),
      addressScVal(params.asset),
      i128ScVal(toEscrowTokenAmount(params.amount, params.assetDecimals)),
      bytesN32ScVal(params.jobHash),
    ],
    signTransaction: params.signTransaction,
    walletType: params.walletType,
  });

  const escrowId =
    tryResolveEscrowId(result) ??
    (await findCreatedEscrowIdFromState({
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
      escrowContractId: params.escrowContractId,
      sourceAddress: params.sourceAddress,
      startEscrowId: nextEscrowIdBefore,
      endEscrowId: await getNextEscrowIdOnChain({
        rpcUrl: params.rpcUrl,
        networkPassphrase: params.networkPassphrase,
        escrowContractId: params.escrowContractId,
        sourceAddress: params.sourceAddress,
      }),
      client: params.client,
      freelancer: null,
      asset: params.asset,
      amount: toEscrowTokenAmount(params.amount, params.assetDecimals),
      jobHash: params.jobHash,
    }));

  return {
    ...result,
    escrowId,
  };
}

export async function fundEscrowOnChain(
  params: TBaseEscrowCallParams & { client: string; escrowId: string },
): Promise<TEscrowResult> {
  return await executeEscrowContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    escrowContractId: params.escrowContractId,
    method: "fund_escrow",
    args: [addressScVal(params.client), u64ScVal(params.escrowId)],
    signTransaction: params.signTransaction,
    walletType: params.walletType,
  });
}

export async function assignFreelancerOnChain(
  params: TBaseEscrowCallParams & { client: string; freelancer: string; escrowId: string },
): Promise<TEscrowResult> {
  return await executeEscrowContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    escrowContractId: params.escrowContractId,
    method: "assign_freelancer",
    args: [addressScVal(params.client), u64ScVal(params.escrowId), addressScVal(params.freelancer)],
    signTransaction: params.signTransaction,
    walletType: params.walletType,
  });
}

export async function submitWorkOnChain(
  params: TBaseEscrowCallParams & { freelancer: string; escrowId: string; proofHash: Uint8Array },
): Promise<TEscrowResult> {
  return await executeEscrowContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    escrowContractId: params.escrowContractId,
    method: "submit_work",
    args: [
      addressScVal(params.freelancer),
      u64ScVal(params.escrowId),
      bytesN32ScVal(params.proofHash),
    ],
    signTransaction: params.signTransaction,
    walletType: params.walletType,
  });
}

export async function approveAndReleaseOnChain(
  params: TBaseEscrowCallParams & {
    client: string;
    escrowId: string;
    rating: number;
    reviewHash: Uint8Array;
  },
): Promise<TEscrowResult> {
  return await executeEscrowContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    escrowContractId: params.escrowContractId,
    method: "approve_and_release",
    args: [
      addressScVal(params.client),
      u64ScVal(params.escrowId),
      u32ScVal(params.rating),
      bytesN32ScVal(params.reviewHash),
    ],
    signTransaction: params.signTransaction,
    walletType: params.walletType,
  });
}

export async function cancelEscrowOnChain(
  params: TBaseEscrowCallParams & { client: string; escrowId: string },
): Promise<TEscrowResult> {
  return await executeEscrowContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    escrowContractId: params.escrowContractId,
    method: "cancel_escrow",
    args: [addressScVal(params.client), u64ScVal(params.escrowId)],
    signTransaction: params.signTransaction,
    walletType: params.walletType,
  });
}

export async function markDisputedOnChain(
  params: TBaseEscrowCallParams & { caller: string; escrowId: string },
): Promise<TEscrowResult> {
  return await executeEscrowContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    escrowContractId: params.escrowContractId,
    method: "mark_disputed",
    args: [addressScVal(params.caller), u64ScVal(params.escrowId)],
    signTransaction: params.signTransaction,
    walletType: params.walletType,
  });
}

export async function resolveDisputeOnChain(
  params: TBaseEscrowCallParams & {
    platformAdmin: string;
    escrowId: string;
    freelancerShareBps: number;
    resolutionHash: Uint8Array;
  },
): Promise<TEscrowResult> {
  return await executeEscrowContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    escrowContractId: params.escrowContractId,
    method: "resolve_dispute",
    args: [
      addressScVal(params.platformAdmin),
      u64ScVal(params.escrowId),
      u32ScVal(params.freelancerShareBps),
      bytesN32ScVal(params.resolutionHash),
    ],
    signTransaction: params.signTransaction,
    walletType: params.walletType,
  });
}

export async function getPlatformAdminOnChain(
  params: Omit<TBaseEscrowCallParams, "signTransaction">,
): Promise<string> {
  const result = await simulateContractCall<unknown>({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: resolveReadSourceAddress(params.sourceAddress),
    contractId: params.escrowContractId,
    method: "get_platform_admin",
    args: [],
  });

  if (typeof result === "string" && STELLAR_ADDRESS_PATTERN.test(result.trim())) {
    return result.trim();
  }

  throw new Error("Escrow contract did not return a readable platform admin address.");
}

export async function getEscrowOnChain(
  params: Omit<TBaseEscrowCallParams, "signTransaction"> & { escrowId: string },
): Promise<TOnChainEscrow> {
  const result = await simulateContractCall<unknown>({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: resolveReadSourceAddress(params.sourceAddress),
    contractId: params.escrowContractId,
    method: "get_escrow",
    args: [u64ScVal(params.escrowId)],
  });

  return normalizeOnChainEscrow(result);
}

export async function getTokenBalanceOnChain(params: {
  rpcUrl: string;
  networkPassphrase: string;
  tokenContractId: string;
  sourceAddress: string;
  walletAddress: string;
}): Promise<bigint> {
  const result = await simulateContractCall<unknown>({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: resolveReadSourceAddress(params.sourceAddress),
    contractId: params.tokenContractId,
    method: "balance",
    args: [addressScVal(params.walletAddress)],
  });

  if (typeof result === "bigint") {
    return result;
  }

  if (typeof result === "number" || typeof result === "string") {
    return BigInt(result);
  }

  return 0n;
}

export async function getStablecoinBalanceOnChain(params: {
  rpcUrl: string;
  networkPassphrase: string;
  stablecoinTokenContractId: string;
  sourceAddress: string;
  walletAddress: string;
}): Promise<bigint> {
  return await getTokenBalanceOnChain({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    tokenContractId: params.stablecoinTokenContractId,
    sourceAddress: params.sourceAddress,
    walletAddress: params.walletAddress,
  });
}
