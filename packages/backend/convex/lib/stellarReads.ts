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
  return nativeToScVal(BigInt(value), { type: "u64" });
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

  const record = result as Partial<TOnChainEscrow> | undefined;
  if (!record || typeof record !== "object" || record.escrow_id === undefined) {
    throw new Error(`On-chain escrow "${escrowId}" was not found or is unreadable.`);
  }

  return record as TOnChainEscrow;
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

  const record = result as Partial<TOnChainCompletionRecord>;
  if (typeof record !== "object" || record.escrow_id === undefined) {
    return null;
  }

  return record as TOnChainCompletionRecord;
}

export function normalizeOnChainEscrowStatus(onChainStatus: unknown): TEscrowStatus | null {
  if (typeof onChainStatus === "string") {
    return ON_CHAIN_STATUS_MAP[onChainStatus] ?? null;
  }

  if (Array.isArray(onChainStatus)) {
    if (onChainStatus.length !== 1) {
      return null;
    }

    return normalizeOnChainEscrowStatus(onChainStatus[0]);
  }

  if (typeof onChainStatus === "object" && onChainStatus !== null) {
    const keys = Object.keys(onChainStatus);
    if (keys.length === 1 && keys[0]) {
      return ON_CHAIN_STATUS_MAP[keys[0]] ?? null;
    }
  }

  return null;
}

export function getStatusRank(status: TEscrowStatus): number {
  return STATUS_RANK_MAP[status];
}

export function normalizeOnChainAddress(address: unknown): string {
  if (typeof address === "string") {
    return address.trim().toUpperCase();
  }

  if (address instanceof Address) {
    return address.toString().toUpperCase();
  }

  throw new Error("On-chain address is not a valid Stellar address.");
}

export function normalizeOnChainBytes32(bytes: unknown): string | undefined {
  if (bytes instanceof Uint8Array || Buffer.isBuffer(bytes)) {
    return Buffer.from(bytes).toString("hex");
  }

  return undefined;
}
