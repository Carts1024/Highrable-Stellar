import { env } from "@/core/config/env";
import { BASE_FEE, Contract, rpc, scValToNative, TransactionBuilder } from "@stellar/stellar-sdk";

import type { Transaction, xdr } from "@stellar/stellar-sdk";

const TX_TIMEOUT_SECONDS = 30;
const POLL_ATTEMPTS = 18;
const POLL_DELAY_MS = 1500;

export type TSignedTransactionSubmitter = (
  xdr: string,
  options?: { requiresServerSession?: boolean },
) => Promise<string>;

export type TInvokeContractParams = {
  rpcUrl: string;
  networkPassphrase: string;
  sourceAddress: string;
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  signTransaction: TSignedTransactionSubmitter;
  operationId?: string;
};

export type TConfirmedContractTx = {
  txHash: string;
  result?: unknown;
  returnValue?: xdr.ScVal;
};

export class StellarTransactionError extends Error {
  public readonly txHash?: string;

  public constructor(message: string, txHash?: string) {
    super(message);
    this.name = "StellarTransactionError";
    this.txHash = txHash;
  }
}

export class StellarTransactionPendingError extends StellarTransactionError {
  public constructor(message: string, txHash?: string) {
    super(message, txHash);
    this.name = "StellarTransactionPendingError";
  }
}

export function isPendingStellarTransactionError(error: unknown): boolean {
  return error instanceof StellarTransactionPendingError;
}

type TVeloGasResponse = {
  operationId: string;
  requestId: string;
  transactionHash: string;
  outerTransactionHash: string | null;
  status: "claimed" | "submission_unknown" | "submitted" | "succeeded" | "failed" | "cancelled";
  actualFeeStroops: string | null;
  reconciliationRequired: boolean;
};

function shouldUseVeloGas(operationId?: string): boolean {
  return (
    env.NEXT_PUBLIC_ENABLE_VELO_GAS_STATION === true &&
    env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet" &&
    Boolean(operationId)
  );
}

async function postVeloGas<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!payload) {
    throw new Error(`Gas Station returned ${response.status} without a JSON response.`);
  }

  if (!response.ok && response.status !== 202) {
    throw new Error(payload.error ?? "Gas Station request failed.");
  }

  return payload as T;
}

async function submitViaVeloGas(params: {
  server: rpc.Server;
  operationId: string;
  signedTransactionXdr: string;
}): Promise<TConfirmedContractTx> {
  let gasResult = await postVeloGas<TVeloGasResponse>("/api/stellar/gas/submit", {
    operationId: params.operationId,
    signedTransactionXdr: params.signedTransactionXdr,
  });

  for (let attempt = 0; attempt < 3 && gasResult.status !== "succeeded"; attempt += 1) {
    if (gasResult.status === "failed" || gasResult.status === "cancelled") {
      throw new StellarTransactionError(`Velo Gas Station execution ${gasResult.status}.`);
    }

    gasResult = await postVeloGas<TVeloGasResponse>("/api/stellar/gas/status", {
      operationId: params.operationId,
      observeUntilTerminal: true,
    });
  }

  if (gasResult.status !== "succeeded") {
    throw new StellarTransactionPendingError(
      "Velo Gas Station execution is still pending. Use the transaction recovery status to continue observing.",
      gasResult.outerTransactionHash ?? undefined,
    );
  }

  const confirmationHash = gasResult.outerTransactionHash ?? gasResult.transactionHash;
  const confirmedTransaction = await pollTransaction(params.server, confirmationHash);

  return {
    txHash: confirmationHash,
    result: confirmedTransaction.returnValue
      ? scValToNative(confirmedTransaction.returnValue)
      : undefined,
    returnValue: confirmedTransaction.returnValue,
  };
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "object" && error !== null) {
    const possibleError = error as { message?: unknown; error?: unknown; status?: unknown };
    if (typeof possibleError.message === "string" && possibleError.message.trim()) {
      return possibleError.message.trim();
    }
    if (typeof possibleError.error === "string" && possibleError.error.trim()) {
      return possibleError.error.trim();
    }
    if (typeof possibleError.status === "string" && possibleError.status.trim()) {
      return possibleError.status.trim();
    }
  }

  return "Stellar transaction failed. Please try again.";
}

function isUserRejectedSigning(message: string): boolean {
  return (
    message.includes("user rejected") ||
    message.includes("rejected by user") ||
    message.includes("declined") ||
    message.includes("denied") ||
    message.includes("notallowederror") ||
    message.includes("cancelled") ||
    message.includes("canceled") ||
    message.includes("abort")
  );
}

export function normalizeStellarError(error: unknown): string {
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("smart account is not authorized") ||
    normalizedMessage.includes("passkey smart account") ||
    normalizedMessage.includes("__check_auth")
  ) {
    return message;
  }

  if (isUserRejectedSigning(normalizedMessage)) {
    return "Wallet signing was rejected.";
  }

  if (
    normalizedMessage.includes("account not found") ||
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("does not exist")
  ) {
    return "Stellar account is not funded on testnet. Fund it with Friendbot, then try again.";
  }

  if (normalizedMessage.includes("simulate") || normalizedMessage.includes("simulation")) {
    return `Transaction simulation failed: ${message}`;
  }

  if (normalizedMessage.includes("unauthorized") || normalizedMessage.includes("auth")) {
    return "Wrong wallet for this escrow action. Connect the required client or freelancer wallet.";
  }

  if (normalizedMessage.includes("invalidstatus") || normalizedMessage.includes("invalid status")) {
    return "Escrow is not in the required status for this action.";
  }

  if (normalizedMessage.includes("timeout") || normalizedMessage.includes("timed out")) {
    return "Stellar RPC timed out while confirming the transaction. Check the explorer before retrying.";
  }

  if (normalizedMessage.includes("tx_failed") || normalizedMessage.includes("failed")) {
    return `On-chain transaction failed: ${message}`;
  }

  return message;
}

function createRpcServer(rpcUrl: string): rpc.Server {
  return new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
    timeout: 30000,
  });
}

export async function simulateContractCall<T = unknown>({
  rpcUrl,
  networkPassphrase,
  sourceAddress,
  contractId,
  method,
  args,
}: Omit<TInvokeContractParams, "signTransaction">): Promise<T> {
  const server = createRpcServer(rpcUrl);
  const sourceAccount = await server.getAccount(sourceAddress);
  const contract = new Contract(contractId);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .setTimeout(TX_TIMEOUT_SECONDS)
    .addOperation(contract.call(method, ...args))
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if ("error" in simulation && simulation.error) {
    throw new Error(String(simulation.error));
  }

  if (!("result" in simulation) || !simulation.result) {
    throw new Error("Contract simulation did not return a result.");
  }

  return scValToNative(simulation.result.retval) as T;
}

async function pollTransaction(
  server: rpc.Server,
  txHash: string,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const transaction = await server.getTransaction(txHash);

    if (transaction.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return transaction;
    }

    if (transaction.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("On-chain transaction failed.");
    }

    await wait(POLL_DELAY_MS);
  }

  throw new Error("Stellar RPC confirmation timed out.");
}

export async function invokeContract(params: TInvokeContractParams): Promise<TConfirmedContractTx> {
  const server = createRpcServer(params.rpcUrl);
  const sourceAccount = await server.getAccount(params.sourceAddress);
  const contract = new Contract(params.contractId);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: params.networkPassphrase,
  })
    .setTimeout(TX_TIMEOUT_SECONDS)
    .addOperation(contract.call(params.method, ...params.args))
    .build();

  const preparedTransaction = (await server.prepareTransaction(transaction)) as Transaction;
  const useVeloGas = shouldUseVeloGas(params.operationId);
  const signedXdr = await params.signTransaction(preparedTransaction.toXDR(), {
    requiresServerSession: useVeloGas,
  });

  if (useVeloGas) {
    return await submitViaVeloGas({
      server,
      operationId: params.operationId!,
      signedTransactionXdr: signedXdr,
    });
  }

  const signedTransaction = TransactionBuilder.fromXDR(signedXdr, params.networkPassphrase);
  const submittedTransaction = await server.sendTransaction(signedTransaction);

  if (submittedTransaction.status !== "PENDING" && submittedTransaction.status !== "DUPLICATE") {
    throw new StellarTransactionError(
      `Stellar RPC rejected the transaction: ${submittedTransaction.status}`,
      submittedTransaction.hash,
    );
  }

  let confirmedTransaction: rpc.Api.GetSuccessfulTransactionResponse;
  try {
    confirmedTransaction = await pollTransaction(server, submittedTransaction.hash);
  } catch (error) {
    throw new StellarTransactionError(getErrorMessage(error), submittedTransaction.hash);
  }

  return {
    txHash: submittedTransaction.hash,
    result: confirmedTransaction.returnValue
      ? scValToNative(confirmedTransaction.returnValue)
      : undefined,
    returnValue: confirmedTransaction.returnValue,
  };
}
