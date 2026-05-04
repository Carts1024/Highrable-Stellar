import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";

import { toTokenAmount } from "./amounts";
import { invokeContract, simulateContractCall } from "./transaction";

import type { TConfirmedContractTx, TSignedTransactionSubmitter } from "./transaction";

type TBaseEscrowCallParams = {
  rpcUrl: string;
  networkPassphrase: string;
  escrowContractId: string;
  sourceAddress: string;
  signTransaction: TSignedTransactionSubmitter;
};

type TEscrowResult = TConfirmedContractTx;

export type TOnChainEscrow = {
  escrow_id: bigint;
  client: string;
  freelancer: string;
  asset: string;
  amount: bigint;
  job_hash: Uint8Array;
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

function normalizeOnChainEscrow(value: unknown): TOnChainEscrow {
  const record = value as Partial<TOnChainEscrow> | undefined;
  if (!record || typeof record !== "object" || record.escrow_id === undefined) {
    throw new Error("On-chain escrow response was not readable.");
  }

  return record as TOnChainEscrow;
}

export async function createEscrowOnChain(
  params: TBaseEscrowCallParams & {
    client: string;
    freelancer: string;
    asset: string;
    amount: number;
    jobHash: Uint8Array;
  },
): Promise<TEscrowResult & { escrowId: string }> {
  const result = await invokeContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    contractId: params.escrowContractId,
    method: "create_escrow",
    args: [
      addressScVal(params.client),
      addressScVal(params.freelancer),
      addressScVal(params.asset),
      i128ScVal(toTokenAmount(params.amount)),
      bytesN32ScVal(params.jobHash),
    ],
    signTransaction: params.signTransaction,
  });

  if (!result.returnValue) {
    throw new Error("Create escrow transaction did not return an escrow ID.");
  }

  const escrowId = scValToNative(result.returnValue);
  if (typeof escrowId !== "bigint" && typeof escrowId !== "number") {
    throw new Error("Create escrow return value was not a u64 escrow ID.");
  }

  return {
    ...result,
    escrowId: escrowId.toString(),
  };
}

export async function fundEscrowOnChain(
  params: TBaseEscrowCallParams & { client: string; escrowId: string },
): Promise<TEscrowResult> {
  return await invokeContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    contractId: params.escrowContractId,
    method: "fund_escrow",
    args: [addressScVal(params.client), u64ScVal(params.escrowId)],
    signTransaction: params.signTransaction,
  });
}

export async function submitWorkOnChain(
  params: TBaseEscrowCallParams & { freelancer: string; escrowId: string },
): Promise<TEscrowResult> {
  return await invokeContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    contractId: params.escrowContractId,
    method: "submit_work",
    args: [addressScVal(params.freelancer), u64ScVal(params.escrowId)],
    signTransaction: params.signTransaction,
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
  return await invokeContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    contractId: params.escrowContractId,
    method: "approve_and_release",
    args: [
      addressScVal(params.client),
      u64ScVal(params.escrowId),
      u32ScVal(params.rating),
      bytesN32ScVal(params.reviewHash),
    ],
    signTransaction: params.signTransaction,
  });
}

export async function cancelEscrowOnChain(
  params: TBaseEscrowCallParams & { client: string; escrowId: string },
): Promise<TEscrowResult> {
  return await invokeContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    contractId: params.escrowContractId,
    method: "cancel_escrow",
    args: [addressScVal(params.client), u64ScVal(params.escrowId)],
    signTransaction: params.signTransaction,
  });
}

export async function markDisputedOnChain(
  params: TBaseEscrowCallParams & { caller: string; escrowId: string },
): Promise<TEscrowResult> {
  return await invokeContract({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    contractId: params.escrowContractId,
    method: "mark_disputed",
    args: [addressScVal(params.caller), u64ScVal(params.escrowId)],
    signTransaction: params.signTransaction,
  });
}

export async function getEscrowOnChain(
  params: Omit<TBaseEscrowCallParams, "signTransaction"> & { escrowId: string },
): Promise<TOnChainEscrow> {
  const result = await simulateContractCall<unknown>({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    contractId: params.escrowContractId,
    method: "get_escrow",
    args: [u64ScVal(params.escrowId)],
  });

  return normalizeOnChainEscrow(result);
}

export async function getStablecoinBalanceOnChain(params: {
  rpcUrl: string;
  networkPassphrase: string;
  stablecoinTokenContractId: string;
  sourceAddress: string;
  walletAddress: string;
}): Promise<bigint> {
  const result = await simulateContractCall<unknown>({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    sourceAddress: params.sourceAddress,
    contractId: params.stablecoinTokenContractId,
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
