import { getRequiredRegistryConfig } from "@/core/config/stellar-contracts";
import { getSmartAccountKit } from "@/core/stellar/smart-account-kit";
import { Address, rpc } from "@stellar/stellar-sdk";

import type {
  TConfirmedContractTx,
  TStellarExecutionPhase,
  TStellarSubmissionIdentity,
  TSignedTransactionSubmitter,
} from "./transaction";
import type { TWalletExecutionMode } from "./transactionExecutor";
import type { xdr } from "@stellar/stellar-sdk";

import { simulateContractCall } from "./transaction";
import { executeHighrableContractCall } from "./transactionExecutor";

const STELLAR_ADDRESS_PATTERN = /^[GC][A-Z2-7]{55}$/;
const CONTRACT_ADDRESS_PATTERN = /^C[A-Z2-7]{55}$/;
const HASH_PATTERN = /^[0-9a-fA-F]{64}$/;
const NO_HASH_RETRY_GRACE_SECONDS = 120;

function normalizeLedgerCloseTime(value: unknown, name: string): number {
  let normalized: number;
  if (typeof value === "number") {
    normalized = value;
  } else if (typeof value === "string" && /^\d+$/.test(value)) {
    const timestamp = BigInt(value);
    if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Stellar RPC returned an invalid ${name} time.`);
    }
    normalized = Number(timestamp);
  } else {
    throw new Error(`Stellar RPC returned an invalid ${name} time.`);
  }

  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`Stellar RPC returned an invalid ${name} time.`);
  }
  return normalized;
}

export type TOnChainUserRegistration = {
  readonly address: string;
  readonly registeredAt: number;
};

export type TRegistryTransactionOutcome =
  | { readonly status: "confirmed" }
  | { readonly status: "failed" }
  | { readonly status: "pending" }
  | { readonly status: "expired" };

function addressScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

function normalizeAddress(address: unknown): string {
  if (typeof address !== "string") {
    throw new Error("Registry returned an unreadable wallet address.");
  }
  const normalized = new Address(address.trim().toUpperCase()).toString().toUpperCase();
  if (!STELLAR_ADDRESS_PATTERN.test(normalized)) {
    throw new Error("Registry returned an invalid Stellar wallet address.");
  }
  return normalized;
}

function normalizeTimestamp(timestamp: unknown): number {
  let value: bigint;
  if (typeof timestamp === "bigint") {
    value = timestamp;
  } else if (typeof timestamp === "number" && Number.isSafeInteger(timestamp)) {
    value = BigInt(timestamp);
  } else if (typeof timestamp === "string" && /^\d+$/.test(timestamp)) {
    value = BigInt(timestamp);
  } else {
    throw new Error("Registry returned an invalid registration timestamp.");
  }

  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Registry registration timestamp is outside the supported range.");
  }
  return Number(value);
}

export function normalizeUserRegistration(
  value: unknown,
  expectedAddress: string,
): TOnChainUserRegistration | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Registry returned an unreadable registration record.");
  }

  const record = value as Record<string, unknown>;
  const address = normalizeAddress(record.address);
  const expected = normalizeAddress(expectedAddress);
  if (address !== expected) {
    throw new Error("Registry record belongs to a different wallet.");
  }

  return {
    address,
    registeredAt: normalizeTimestamp(record.registered_at),
  };
}

function resolveReadSourceAddress(walletAddress: string, walletType: TWalletExecutionMode): string {
  if (walletType === "external_wallet") {
    return normalizeAddress(walletAddress);
  }

  const sourceAddress = getSmartAccountKit().deployerPublicKey.trim().toUpperCase();
  if (!/^G[A-Z2-7]{55}$/.test(sourceAddress)) {
    throw new Error("Passkey registration reads require a configured classic source account.");
  }
  return sourceAddress;
}

export async function getUserRegistration(params: {
  readonly walletAddress: string;
  readonly walletType: TWalletExecutionMode;
}): Promise<TOnChainUserRegistration | null> {
  const config = getRequiredRegistryConfig();
  const walletAddress = normalizeAddress(params.walletAddress);
  const result = await simulateContractCall<unknown>({
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    sourceAddress: resolveReadSourceAddress(walletAddress, params.walletType),
    contractId: config.registryContractId,
    method: "get_registration",
    args: [addressScVal(walletAddress)],
  });
  return normalizeUserRegistration(result, walletAddress);
}

export async function registerUser(params: {
  readonly walletAddress: string;
  readonly walletType: TWalletExecutionMode;
  readonly signTransaction?: TSignedTransactionSubmitter;
  readonly operationId: string;
  readonly onSigned?: (identity: TStellarSubmissionIdentity) => Promise<void>;
  readonly onPhase?: (phase: TStellarExecutionPhase) => void;
}): Promise<TConfirmedContractTx> {
  const config = getRequiredRegistryConfig();
  const walletAddress = normalizeAddress(params.walletAddress);
  if (!CONTRACT_ADDRESS_PATTERN.test(config.registryContractId)) {
    throw new Error("NEXT_PUBLIC_REGISTRY_CONTRACT_ID is not a valid Stellar contract address.");
  }

  return await executeHighrableContractCall({
    walletType: params.walletType,
    walletAddress,
    action: "register user",
    contractId: config.registryContractId,
    method: "register",
    args: [addressScVal(walletAddress)],
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    signTransaction: params.signTransaction,
    operationId: params.operationId,
    onSigned: params.onSigned,
    onPhase: params.onPhase,
  });
}

export async function checkRegistryTransaction(params: {
  readonly rpcUrl: string;
  readonly transactionHash?: string;
  readonly validUntil?: number;
  readonly createdAt: number;
}): Promise<TRegistryTransactionOutcome> {
  const server = new rpc.Server(params.rpcUrl, {
    allowHttp: params.rpcUrl.startsWith("http://"),
    timeout: 30_000,
  });

  if (params.transactionHash !== undefined && !HASH_PATTERN.test(params.transactionHash)) {
    throw new Error("Registration transaction hash is invalid.");
  }
  const hasTransactionHash = params.transactionHash !== undefined;
  const lookupHash = params.transactionHash ?? "0".repeat(64);
  const transaction = await server.getTransaction(lookupHash);
  if (hasTransactionHash) {
    if (transaction.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { status: "confirmed" };
    }
    if (transaction.status === rpc.Api.GetTransactionStatus.FAILED) {
      return { status: "failed" };
    }
  }
  if (transaction.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
    return { status: "pending" };
  }

  const latestCloseTime = normalizeLedgerCloseTime(
    transaction.latestLedgerCloseTime,
    "latest-ledger",
  );
  const oldestCloseTime = normalizeLedgerCloseTime(
    transaction.oldestLedgerCloseTime,
    "oldest-ledger",
  );

  const fallbackValidUntil = Math.floor(params.createdAt / 1000) + NO_HASH_RETRY_GRACE_SECONDS;
  const validUntil = params.validUntil ?? fallbackValidUntil;
  return latestCloseTime > validUntil && oldestCloseTime <= validUntil
    ? { status: "expired" }
    : { status: "pending" };
}
