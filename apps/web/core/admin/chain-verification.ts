import { env } from "@/core/config/env";
import {
  Address,
  BASE_FEE,
  Contract,
  FeeBumpTransaction,
  Horizon,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

type TAdminChainConfig = {
  readonly horizonUrl: string;
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
  const horizonUrl = env.NEXT_PUBLIC_STELLAR_HORIZON_URL?.trim();
  const rpcUrl = env.NEXT_PUBLIC_STELLAR_RPC_URL?.trim();
  const networkPassphrase = env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE?.trim();
  const network = env.NEXT_PUBLIC_STELLAR_NETWORK?.trim().toLowerCase();
  const escrowContractId = env.NEXT_PUBLIC_ESCROW_CONTRACT_ID?.trim();
  if (!horizonUrl || !rpcUrl || !networkPassphrase || !network || !escrowContractId) {
    throw new Error(
      "Admin chain verification requires the configured Stellar network and escrow contract.",
    );
  }
  return { horizonUrl, rpcUrl, networkPassphrase, network, escrowContractId };
}

function createRpcServer(config: TAdminChainConfig): rpc.Server {
  return new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
    timeout: 30_000,
  });
}

function createHorizonServer(config: TAdminChainConfig): Horizon.Server {
  return new Horizon.Server(config.horizonUrl, {
    allowHttp: config.horizonUrl.startsWith("http://"),
    appName: "Highrable Admin Recovery",
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

function matchesResolutionInvocation(
  envelope: xdr.TransactionEnvelope,
  config: TAdminChainConfig,
  actorWallet: string,
  escrowId: string,
): boolean {
  try {
    const transaction = getTransactionBody(envelope);
    const operations = transaction.operations();
    if (
      operations.length !== 1 ||
      operations[0]?.body().switch() !== xdr.OperationType.invokeHostFunction()
    ) {
      return false;
    }

    const invocation = operations[0]!.body().invokeHostFunctionOp().hostFunction().invokeContract();
    const args = invocation.args().map((arg) => scValToNative(arg));
    const freelancerShareBps = normalizeInteger(args[2]);
    return (
      Address.fromScAddress(invocation.contractAddress()).toString().toUpperCase() ===
        config.escrowContractId.toUpperCase() &&
      invocation.functionName().toString() === "resolve_dispute" &&
      args.length === 4 &&
      normalizeAddress(args[0]) === actorWallet.trim().toUpperCase() &&
      normalizeInteger(args[1]) === BigInt(escrowId) &&
      freelancerShareBps >= 0n &&
      freelancerShareBps <= 10_000n
    );
  } catch {
    return false;
  }
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

export async function verifySuccessfulAdminResolutionTransaction(args: {
  readonly transactionHash: string;
  readonly network: string;
  readonly contractId: string;
  readonly actorWallet: string;
  readonly escrowId: string;
}): Promise<{ freelancerShareBps: number; transactionValidUntil: number }> {
  const config = getAdminChainConfig();
  assertAdminChainScope(config, args.network, args.contractId);
  if (!/^[0-9a-fA-F]{64}$/.test(args.transactionHash)) {
    throw new Error("Settlement transaction hash must be a 64-character hexadecimal hash.");
  }

  const response = await createRpcServer(config).getTransaction(args.transactionHash);
  if (response.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error("Stellar does not report this resolution transaction as successful.");
  }

  const transaction = TransactionBuilder.fromXDR(response.envelopeXdr, config.networkPassphrase);
  const expectedHash = args.transactionHash.toLowerCase();
  if (
    transaction.hash().toString("hex") !== expectedHash &&
    !(
      transaction instanceof FeeBumpTransaction &&
      transaction.innerTransaction.hash().toString("hex") === expectedHash
    )
  ) {
    throw new Error("Stellar returned a transaction that does not match the supplied hash.");
  }

  const envelope = transaction.toEnvelope();
  const txBody = getTransactionBody(envelope);
  const operations = txBody.operations();
  if (
    operations.length !== 1 ||
    operations[0]?.body().switch() !== xdr.OperationType.invokeHostFunction()
  ) {
    throw new Error("Transaction does not contain a single Soroban resolution call.");
  }

  const invocation = operations[0]!.body().invokeHostFunctionOp().hostFunction().invokeContract();
  const contractId = Address.fromScAddress(invocation.contractAddress()).toString().toUpperCase();
  const argsNative = invocation.args().map((value) => scValToNative(value));
  if (
    contractId !== config.escrowContractId.toUpperCase() ||
    invocation.functionName().toString() !== "resolve_dispute" ||
    argsNative.length !== 4 ||
    normalizeAddress(argsNative[0]) !== args.actorWallet.trim().toUpperCase() ||
    normalizeInteger(argsNative[1]) !== BigInt(args.escrowId)
  ) {
    throw new Error("Transaction does not match this dispute's escrow and assigned admin.");
  }

  const freelancerShareBps = normalizeInteger(argsNative[2]);
  if (freelancerShareBps < 0n || freelancerShareBps > 10_000n) {
    throw new Error("Settlement transaction contains an invalid freelancer share.");
  }

  const submittedTransaction =
    transaction instanceof FeeBumpTransaction ? transaction.innerTransaction : transaction;
  const transactionValidUntil = Number(submittedTransaction.timeBounds?.maxTime ?? Number.NaN);
  if (!Number.isSafeInteger(transactionValidUntil) || transactionValidUntil <= 0) {
    throw new Error("Settlement transaction does not contain a usable expiry.");
  }

  return { freelancerShareBps: Number(freelancerShareBps), transactionValidUntil };
}

const ADMIN_RESOLUTION_HISTORY_PAGE_SIZE = 200;
const ADMIN_RESOLUTION_HISTORY_SCAN_LIMIT = 2_000;

/**
 * Finds a prior resolution for this unique escrow in the assigned admin's Horizon
 * transaction history, then verifies its exact hash and invocation through Soroban RPC.
 */
export async function findSuccessfulAdminResolutionTransaction(args: {
  readonly network: string;
  readonly contractId: string;
  readonly actorWallet: string;
  readonly escrowId: string;
  readonly searchAfterTransactionHash?: string;
}): Promise<{
  readonly transactionHash: string;
  readonly freelancerShareBps: number;
  readonly transactionValidUntil: number;
} | null> {
  const config = getAdminChainConfig();
  assertAdminChainScope(config, args.network, args.contractId);
  const actorWallet = new Address(args.actorWallet.trim().toUpperCase()).toString();
  if (!/^\d+$/.test(args.escrowId)) {
    throw new Error("Dispute escrow ID must be a nonnegative integer.");
  }

  const horizon = createHorizonServer(config);
  let searchAfterLedger: number | null = null;
  if (
    args.searchAfterTransactionHash &&
    /^[0-9a-fA-F]{64}$/.test(args.searchAfterTransactionHash)
  ) {
    try {
      const disputeMark = await horizon
        .transactions()
        .transaction(args.searchAfterTransactionHash.toLowerCase())
        .call();
      if (Number.isSafeInteger(disputeMark.ledger_attr) && disputeMark.ledger_attr > 0) {
        searchAfterLedger = disputeMark.ledger_attr;
      }
    } catch {
      // The anchor only narrows the scan. If Horizon cannot load it, scan the bounded recent history.
    }
  }

  const history = horizon
    .transactions()
    .forAccount(actorWallet)
    .order("desc")
    .limit(ADMIN_RESOLUTION_HISTORY_PAGE_SIZE);
  let page = await history.call();
  let scannedRecords = 0;

  while (page.records.length > 0 && scannedRecords < ADMIN_RESOLUTION_HISTORY_SCAN_LIMIT) {
    for (const record of page.records.slice(
      0,
      ADMIN_RESOLUTION_HISTORY_SCAN_LIMIT - scannedRecords,
    )) {
      if (
        searchAfterLedger !== null &&
        Number.isSafeInteger(record.ledger_attr) &&
        record.ledger_attr < searchAfterLedger
      ) {
        return null;
      }
      scannedRecords += 1;
      if (record.successful !== true || !/^[0-9a-fA-F]{64}$/.test(record.hash)) {
        continue;
      }

      let envelope: xdr.TransactionEnvelope;
      try {
        envelope = xdr.TransactionEnvelope.fromXDR(record.envelope_xdr, "base64");
      } catch {
        continue;
      }
      if (!matchesResolutionInvocation(envelope, config, actorWallet, args.escrowId)) continue;

      const transactionHash = record.hash.toLowerCase();
      const verified = await verifySuccessfulAdminResolutionTransaction({
        transactionHash,
        network: args.network,
        contractId: args.contractId,
        actorWallet,
        escrowId: args.escrowId,
      });
      return { transactionHash, ...verified };
    }

    if (
      page.records.length < ADMIN_RESOLUTION_HISTORY_PAGE_SIZE ||
      scannedRecords >= ADMIN_RESOLUTION_HISTORY_SCAN_LIMIT
    ) {
      break;
    }
    page = await page.next();
  }

  return null;
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
