import { env } from "@/core/config/env";
import {
  Address,
  BASE_FEE,
  Contract,
  FeeBumpTransaction,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

type TAdminChainConfig = {
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly network: string;
  readonly escrowContractId: string;
};

type TExpectedAdminCall = {
  readonly method: "add_dispute_admin" | "remove_dispute_admin" | "resolve_dispute";
  readonly actorWallet: string;
  readonly targetWallet?: string;
  readonly escrowId?: string;
  readonly freelancerShareBps?: number;
};

export type TAdminChainOperationStatus = "succeeded" | "failed" | "pending" | "expired";

function getAdminChainConfig(): TAdminChainConfig {
  const rpcUrl = env.NEXT_PUBLIC_STELLAR_RPC_URL?.trim();
  const networkPassphrase = env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE?.trim();
  const network = env.NEXT_PUBLIC_STELLAR_NETWORK?.trim().toLowerCase();
  const escrowContractId = env.NEXT_PUBLIC_ESCROW_CONTRACT_ID?.trim();
  if (!rpcUrl || !networkPassphrase || !network || !escrowContractId) {
    throw new Error(
      "Admin chain verification requires the configured Stellar network and escrow contract.",
    );
  }
  return { rpcUrl, networkPassphrase, network, escrowContractId };
}

function createRpcServer(config: TAdminChainConfig): rpc.Server {
  return new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
    timeout: 30_000,
  });
}

function assertAdminChainScope(
  config: TAdminChainConfig,
  network: string,
  contractId: string,
): void {
  if (
    config.network !== network.trim().toLowerCase() ||
    config.escrowContractId.toUpperCase() !== contractId.trim().toUpperCase()
  ) {
    throw new Error(
      "Pending admin operation belongs to a different Stellar network or escrow contract.",
    );
  }
}

function getTransactionBody(envelope: xdr.TransactionEnvelope) {
  try {
    return envelope.v1().tx();
  } catch {
    try {
      return envelope.v0().tx();
    } catch {
      return envelope.feeBump().tx().innerTx().v1().tx();
    }
  }
}

function normalizeAddress(value: unknown): string {
  if (value instanceof Address) {
    return value.toString().toUpperCase();
  }
  if (typeof value === "string") {
    return new Address(value.trim().toUpperCase()).toString();
  }
  throw new Error("Transaction invocation contains an unreadable Stellar address.");
}

function normalizeInteger(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }
  throw new Error("Transaction invocation contains an unreadable integer argument.");
}

function assertExpectedInvocation(
  envelope: xdr.TransactionEnvelope,
  config: TAdminChainConfig,
  expected: TExpectedAdminCall,
): void {
  const transaction = getTransactionBody(envelope);
  const operations = transaction.operations();
  if (
    operations.length !== 1 ||
    operations[0]?.body().switch() !== xdr.OperationType.invokeHostFunction()
  ) {
    throw new Error("Transaction does not contain the expected single Soroban contract call.");
  }

  const hostFunction = operations[0]!.body().invokeHostFunctionOp().hostFunction();
  const invocation = hostFunction.invokeContract();
  const contractId = Address.fromScAddress(invocation.contractAddress()).toString().toUpperCase();
  const method = invocation.functionName().toString();
  const args = invocation.args().map((arg) => scValToNative(arg));

  if (
    contractId !== config.escrowContractId.toUpperCase() ||
    method !== expected.method ||
    normalizeAddress(args[0]) !== expected.actorWallet.trim().toUpperCase()
  ) {
    throw new Error("Transaction does not match the expected admin operation.");
  }

  if (expected.method === "add_dispute_admin" || expected.method === "remove_dispute_admin") {
    if (
      args.length !== 2 ||
      !expected.targetWallet ||
      normalizeAddress(args[1]) !== expected.targetWallet.trim().toUpperCase()
    ) {
      throw new Error("Membership transaction wallet does not match the pending operation.");
    }
    return;
  }

  if (
    args.length !== 4 ||
    !expected.escrowId ||
    expected.freelancerShareBps === undefined ||
    normalizeInteger(args[1]) !== BigInt(expected.escrowId) ||
    normalizeInteger(args[2]) !== BigInt(expected.freelancerShareBps)
  ) {
    throw new Error("Settlement transaction escrow or split does not match the persisted attempt.");
  }
}

export async function verifyAdminChainOperation(args: {
  readonly transactionHash: string;
  readonly transactionValidUntil: number;
  readonly network: string;
  readonly contractId: string;
  readonly expected: TExpectedAdminCall;
}): Promise<TAdminChainOperationStatus> {
  const config = getAdminChainConfig();
  assertAdminChainScope(config, args.network, args.contractId);
  if (
    !/^[0-9a-fA-F]{64}$/.test(args.transactionHash) ||
    !Number.isSafeInteger(args.transactionValidUntil) ||
    args.transactionValidUntil <= 0
  ) {
    throw new Error("The saved transaction hash or expiry is unreadable.");
  }
  const server = createRpcServer(config);
  const response = await server.getTransaction(args.transactionHash);

  if (response.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (
      !Number.isSafeInteger(response.latestLedgerCloseTime) ||
      response.latestLedgerCloseTime <= 0
    ) {
      throw new Error("Stellar returned an unreadable ledger close time; retry verification.");
    }
    return response.latestLedgerCloseTime - args.transactionValidUntil > 5 ? "expired" : "pending";
  }

  if (
    response.status !== rpc.Api.GetTransactionStatus.SUCCESS &&
    response.status !== rpc.Api.GetTransactionStatus.FAILED
  ) {
    throw new Error("Stellar returned an unrecognized transaction status; retry verification.");
  }
  const transaction = TransactionBuilder.fromXDR(response.envelopeXdr, config.networkPassphrase);
  const expectedHash = args.transactionHash.toLowerCase();
  // Sponsored submissions can be looked up using the saved inner transaction hash.
  if (
    transaction.hash().toString("hex") !== expectedHash &&
    !(
      transaction instanceof FeeBumpTransaction &&
      transaction.innerTransaction.hash().toString("hex") === expectedHash
    )
  ) {
    throw new Error("Stellar returned a transaction that does not match the saved hash.");
  }
  assertExpectedInvocation(response.envelopeXdr, config, args.expected);
  return response.status === rpc.Api.GetTransactionStatus.SUCCESS ? "succeeded" : "failed";
}

async function simulateContractRead<T>(args: {
  readonly config: TAdminChainConfig;
  readonly sourceAddress: string;
  readonly method: string;
  readonly args: xdr.ScVal[];
}): Promise<T> {
  const server = createRpcServer(args.config);
  const source = await server.getAccount(args.sourceAddress);
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: args.config.networkPassphrase,
  })
    .setTimeout(30)
    .addOperation(new Contract(args.config.escrowContractId).call(args.method, ...args.args))
    .build();
  const simulation = await server.simulateTransaction(transaction);
  if ("error" in simulation && simulation.error) {
    throw new Error(`Admin contract read failed: ${String(simulation.error)}`);
  }
  if (!("result" in simulation) || !simulation.result) {
    throw new Error("Admin contract read returned no result.");
  }
  return scValToNative(simulation.result.retval) as T;
}

export async function readDisputeAdminMembership(args: {
  readonly sourceAddress: string;
  readonly disputeAdminWallet: string;
  readonly network: string;
  readonly contractId: string;
}): Promise<boolean> {
  const config = getAdminChainConfig();
  assertAdminChainScope(config, args.network, args.contractId);
  const value = await simulateContractRead<unknown>({
    config,
    sourceAddress: args.sourceAddress,
    method: "is_dispute_admin",
    args: [new Address(args.disputeAdminWallet).toScVal()],
  });
  if (typeof value !== "boolean") {
    throw new Error("Escrow returned an invalid dispute-admin membership value.");
  }
  return value;
}

export async function readDisputedEscrowStatus(args: {
  readonly sourceAddress: string;
  readonly escrowId: string;
  readonly network: string;
  readonly contractId: string;
}): Promise<{ status: string; client: string; freelancer: string | null }> {
  const config = getAdminChainConfig();
  assertAdminChainScope(config, args.network, args.contractId);
  const value = await simulateContractRead<unknown>({
    config,
    sourceAddress: args.sourceAddress,
    method: "get_escrow",
    args: [nativeToScVal(BigInt(args.escrowId), { type: "u64" })],
  });
  if (typeof value !== "object" || value === null || Array.isArray(value) || !("status" in value)) {
    throw new Error("Escrow state could not be read from Stellar.");
  }
  const escrow = value as {
    escrow_id?: unknown;
    status: unknown;
    client: unknown;
    freelancer?: unknown;
  };
  if (normalizeInteger(escrow.escrow_id) !== BigInt(args.escrowId)) {
    throw new Error("Stellar returned a different escrow; retry verification.");
  }
  return {
    status: normalizeEnumValue(escrow.status),
    client: normalizeAddress(escrow.client),
    freelancer: escrow.freelancer === null ? null : normalizeAddress(escrow.freelancer),
  };
}

function normalizeEnumValue(value: unknown): string {
  const statuses = ["Created", "Funded", "Submitted", "Released", "Cancelled", "Disputed"];
  if (typeof value === "string" && statuses.includes(value)) {
    return value;
  }
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") {
    return normalizeEnumValue(value[0]);
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0]) {
      const payload = (value as Record<string, unknown>)[keys[0]];
      if (payload === null || (Array.isArray(payload) && payload.length === 0)) {
        return normalizeEnumValue(keys[0]);
      }
    }
  }
  throw new Error("Escrow returned an unrecognized status.");
}
