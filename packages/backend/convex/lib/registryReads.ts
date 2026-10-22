import {
  Address,
  BASE_FEE,
  Contract,
  rpc,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import type { xdr } from "@stellar/stellar-sdk";

import { getConfiguredRegistryScope } from "../registry/helpers";
import { normalizeOnChainAddress } from "./stellarReads";

const TX_TIMEOUT_SECONDS = 30;
const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};
const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;

export type TRegistryReadConfig = {
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
  registryContractId: string;
  readSourceAccount: string;
};

export type TOnChainRegistration = {
  address: string;
  registeredAt: number;
};

function requireEnvVar(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing Convex environment variable: ${name}.`);
  }
  return value;
}

export function loadRegistryReadConfig(): TRegistryReadConfig {
  const scope = getConfiguredRegistryScope();
  const rpcUrl = requireEnvVar("STELLAR_RPC_URL");
  const readSourceAccount = requireEnvVar("STELLAR_READ_SOURCE_ACCOUNT");
  const configuredPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE?.trim();
  const networkPassphrase = configuredPassphrase ?? NETWORK_PASSPHRASES[scope.network];

  if (!CONTRACT_ID_PATTERN.test(scope.registryContractId)) {
    throw new Error("REGISTRY_CONTRACT_ID must be a valid Stellar contract address.");
  }
  if (!networkPassphrase) {
    throw new Error("STELLAR_NETWORK_PASSPHRASE is required for the local Stellar network.");
  }
  if (!/^G[A-Z2-7]{55}$/.test(readSourceAccount.toUpperCase())) {
    throw new Error("STELLAR_READ_SOURCE_ACCOUNT must be a classic Stellar account address.");
  }

  return {
    ...scope,
    rpcUrl,
    networkPassphrase,
    readSourceAccount: readSourceAccount.toUpperCase(),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("On-chain registration is not a readable record.");
  }
  return value as Record<string, unknown>;
}

function normalizeTimestamp(value: unknown): number {
  let timestamp: bigint;
  if (typeof value === "bigint") {
    timestamp = value;
  } else if (typeof value === "number" && Number.isSafeInteger(value)) {
    timestamp = BigInt(value);
  } else if (typeof value === "string" && /^\d+$/.test(value)) {
    timestamp = BigInt(value);
  } else {
    throw new Error("On-chain registration contains an invalid timestamp.");
  }

  if (timestamp < 0n || timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("On-chain registration timestamp is outside the supported range.");
  }
  return Number(timestamp);
}

export function normalizeOnChainRegistration(
  value: unknown,
  expectedAddress: string,
): TOnChainRegistration | null {
  if (value === null || value === undefined) {
    return null;
  }

  const record = asRecord(value);
  const address = normalizeOnChainAddress(record.address);
  const expected = normalizeOnChainAddress(expectedAddress);
  if (address !== expected) {
    throw new Error("On-chain registration address does not match the requested wallet.");
  }

  return {
    address,
    registeredAt: normalizeTimestamp(record.registered_at),
  };
}

function createRpcServer(rpcUrl: string): rpc.Server {
  return new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
    timeout: 30_000,
  });
}

async function simulateRegistryCall<T>(
  config: TRegistryReadConfig,
  method: "get_registration" | "is_registered",
  walletAddress: string,
): Promise<T> {
  const server = createRpcServer(config.rpcUrl);
  const sourceAccount = await server.getAccount(config.readSourceAccount);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .setTimeout(TX_TIMEOUT_SECONDS)
    .addOperation(
      new Contract(config.registryContractId).call(
        method,
        new Address(walletAddress).toScVal() as xdr.ScVal,
      ),
    )
    .build();
  const simulation = await server.simulateTransaction(transaction);
  if ("error" in simulation && simulation.error) {
    throw new Error(`Registry contract simulation error: ${String(simulation.error)}`);
  }
  if (!("result" in simulation) || !simulation.result) {
    throw new Error("Registry contract simulation returned no result.");
  }
  return scValToNative(simulation.result.retval) as T;
}

export async function getRegistrationFromRegistry(
  config: TRegistryReadConfig,
  walletAddress: string,
): Promise<TOnChainRegistration | null> {
  const result = await simulateRegistryCall<unknown>(config, "get_registration", walletAddress);
  return normalizeOnChainRegistration(result, walletAddress);
}

export async function isRegisteredInRegistry(
  config: TRegistryReadConfig,
  walletAddress: string,
): Promise<boolean> {
  const result = await simulateRegistryCall<unknown>(config, "is_registered", walletAddress);
  if (typeof result !== "boolean") {
    throw new Error("Registry contract returned an invalid membership result.");
  }
  return result;
}
