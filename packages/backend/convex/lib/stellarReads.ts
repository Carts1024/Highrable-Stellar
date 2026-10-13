import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

import type { TEscrowStatus } from "../escrows/schema";

const TX_TIMEOUT_SECONDS = 30;

const STELLAR_NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

const STATUS_RANK_MAP: Record<TEscrowStatus, number> = {
  created: 0,
  funded: 1,
  submitted: 2,
  released: 3,
  cancelled: 99,
  disputed: 99,
};

const ON_CHAIN_STATUS_MAP: Record<string, TEscrowStatus> = {
  Created: "created",
  Funded: "funded",
  Submitted: "submitted",
  Released: "released",
  Cancelled: "cancelled",
  Disputed: "disputed",
};

export type TOnChainEscrow = {
  escrow_id: bigint;
  client: string;
  freelancer?: string | null;
  asset: string;
  amount: bigint;
  job_hash: Uint8Array;
  status: unknown;
  created_at: bigint;
  funded_at: bigint;
  submitted_at: bigint;
  released_at: bigint;
};

export type TOnChainCompletionRecord = {
  escrow_id: bigint;
  client: string;
  freelancer: string;
  asset: string;
  amount: bigint;
  job_hash: Uint8Array;
  rating: number;
  review_hash: Uint8Array;
  completed_at: bigint;
};

export type TStellarReadConfig = {
  rpcUrl: string;
  networkPassphrase: string;
  escrowContractId: string;
  reputationContractId: string;
  readSourceAccount: string;
};

function requireEnvVar(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Convex environment variable: ${name}`);
  }
  return value;
}

export function loadStellarReadConfig(): TStellarReadConfig {
  const network = requireEnvVar("STELLAR_NETWORK");
  const rpcUrl = requireEnvVar("STELLAR_RPC_URL");
  const escrowContractId = requireEnvVar("ESCROW_CONTRACT_ID");
  const reputationContractId = requireEnvVar("REPUTATION_CONTRACT_ID");
  const readSourceAccount = requireEnvVar("STELLAR_READ_SOURCE_ACCOUNT");

  const networkPassphrase = STELLAR_NETWORK_PASSPHRASES[network] ?? network;

  return {
    rpcUrl,
    networkPassphrase,
    escrowContractId,
    reputationContractId,
    readSourceAccount,
  };
}

function u64ScVal(value: string): xdr.ScVal {
  return nativeToScVal(normalizeInteger(value, (1n << 64n) - 1n), { type: "u64" });
}

function normalizeInteger(value: unknown, maximum: bigint): bigint {
  if (
    typeof value !== "bigint" &&
    !(typeof value === "number" && Number.isSafeInteger(value)) &&
    !(typeof value === "string" && /^\d+$/.test(value))
  ) {
    throw new Error("On-chain record contains an unreadable integer.");
  }
  const integer = BigInt(value);
  if (integer < 0n || integer > maximum) {
    throw new Error("On-chain record contains an out-of-range integer.");
  }
  return integer;
}

function readRecord(value: unknown, escrowId: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`On-chain record for escrow "${escrowId}" is unreadable.`);
  }
  const record = value as Record<string, unknown>;
  const maximum = (1n << 64n) - 1n;
  if (normalizeInteger(record.escrow_id, maximum) !== normalizeInteger(escrowId, maximum)) {
    throw new Error("On-chain record does not match the requested escrow.");
  }
  return record;
}

function requireBytes32(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    throw new Error("On-chain record contains an unreadable 32-byte hash.");
  }
  return value;
}

function normalizeRecordFields(record: Record<string, unknown>) {
  return {
    escrow_id: normalizeInteger(record.escrow_id, (1n << 64n) - 1n),
    client: normalizeOnChainAddress(record.client),
    asset: normalizeOnChainAddress(record.asset),
    amount: normalizeInteger(record.amount, (1n << 127n) - 1n),
    job_hash: requireBytes32(record.job_hash),
  };
}

function createRpcServer(rpcUrl: string): rpc.Server {
  return new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
    timeout: 30_000,
  });
}

async function simulateReadCall<T>(
  config: TStellarReadConfig,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<T> {
  const server = createRpcServer(config.rpcUrl);
  const sourceAccount = await server.getAccount(config.readSourceAccount);
  const contract = new Contract(contractId);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .setTimeout(TX_TIMEOUT_SECONDS)
    .addOperation(contract.call(method, ...args))
    .build();

  const simulation = await server.simulateTransaction(transaction);

  if ("error" in simulation && simulation.error) {
    throw new Error(`Contract simulation error: ${String(simulation.error)}`);
  }

  if (!("result" in simulation) || !simulation.result) {
    throw new Error("Contract simulation returned no result.");
  }

  return scValToNative(simulation.result.retval) as T;
}

export async function getEscrowFromContract(
  config: TStellarReadConfig,
  escrowId: string,
): Promise<TOnChainEscrow> {
  const result = await simulateReadCall<unknown>(config, config.escrowContractId, "get_escrow", [
    u64ScVal(escrowId),
  ]);

  const record = readRecord(result, escrowId);
  if (!normalizeOnChainEscrowStatus(record.status)) {
    throw new Error("On-chain escrow contains an unrecognized status.");
  }
  return {
    ...normalizeRecordFields(record),
    freelancer: record.freelancer === null ? null : normalizeOnChainAddress(record.freelancer),
    status: record.status,
    created_at: normalizeInteger(record.created_at, (1n << 64n) - 1n),
    funded_at: normalizeInteger(record.funded_at, (1n << 64n) - 1n),
    submitted_at: normalizeInteger(record.submitted_at, (1n << 64n) - 1n),
    released_at: normalizeInteger(record.released_at, (1n << 64n) - 1n),
  };
}

export async function getCompletionFromContract(
  config: TStellarReadConfig,
  escrowId: string,
): Promise<TOnChainCompletionRecord | null> {
  const result = await simulateReadCall<unknown>(
    config,
    config.reputationContractId,
    "get_completion",
    [u64ScVal(escrowId)],
  );

  if (result === null || result === undefined) {
    return null;
  }

  const record = readRecord(result, escrowId);
  const rating = normalizeInteger(record.rating, 5n);
  if (rating < 1n) {
    throw new Error("On-chain completion contains an invalid rating.");
  }
  return {
    ...normalizeRecordFields(record),
    freelancer: normalizeOnChainAddress(record.freelancer),
    rating: Number(rating),
    review_hash: requireBytes32(record.review_hash),
    completed_at: normalizeInteger(record.completed_at, (1n << 64n) - 1n),
  };
}

export function normalizeOnChainEscrowStatus(onChainStatus: unknown): TEscrowStatus | null {
  if (typeof onChainStatus === "string") {
    return Object.hasOwn(ON_CHAIN_STATUS_MAP, onChainStatus)
      ? ON_CHAIN_STATUS_MAP[onChainStatus]!
      : null;
  }

  if (Array.isArray(onChainStatus)) {
    if (onChainStatus.length !== 1 || typeof onChainStatus[0] !== "string") {
      return null;
    }

    return normalizeOnChainEscrowStatus(onChainStatus[0]);
  }

  if (typeof onChainStatus === "object" && onChainStatus !== null) {
    const keys = Object.keys(onChainStatus);
    if (keys.length === 1 && keys[0]) {
      const payload = (onChainStatus as Record<string, unknown>)[keys[0]];
      if (payload !== null && !(Array.isArray(payload) && payload.length === 0)) return null;
      return normalizeOnChainEscrowStatus(keys[0]);
    }
  }

  return null;
}

export function getStatusRank(status: TEscrowStatus): number {
  return STATUS_RANK_MAP[status];
}

export function normalizeOnChainAddress(address: unknown): string {
  if (typeof address === "string") {
    return new Address(address.trim().toUpperCase()).toString();
  }

  if (address instanceof Address) {
    return address.toString().toUpperCase();
  }

  throw new Error("On-chain address is not a valid Stellar address.");
}

export function normalizeOnChainBytes32(bytes: unknown): string | undefined {
  if ((bytes instanceof Uint8Array || Buffer.isBuffer(bytes)) && bytes.length === 32) {
    return Buffer.from(bytes).toString("hex");
  }

  return undefined;
}
