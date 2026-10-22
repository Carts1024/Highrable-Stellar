import { Buffer } from "buffer";

import {
  Account,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import type { ContextRule, ContextRuleType, ContractSigner } from "smart-account-kit";

const DEFAULT_CONTEXT_RULE_ID = 0;
const CONTRACT_ACCOUNT_PATTERN = /^C[A-Z2-7]{55}$/;
const CLASSIC_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;
type TCallContractContextRuleType = Extract<ContextRuleType, { tag: "CallContract" }>;
type TCreateContractContextRuleType = Extract<ContextRuleType, { tag: "CreateContract" }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTuple(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function toBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  return null;
}

function sanitizeContractId(contractId: string, label: string): string {
  const sanitized = contractId.trim().toUpperCase();
  if (!CONTRACT_ACCOUNT_PATTERN.test(sanitized)) {
    throw new Error(`${label} must be a valid Stellar contract address.`);
  }
  return sanitized;
}

function sanitizeClassicAccount(accountId: string, label: string): string {
  const sanitized = accountId.trim().toUpperCase();
  if (!CLASSIC_ACCOUNT_PATTERN.test(sanitized)) {
    throw new Error(`${label} must be a valid Stellar account address.`);
  }
  return sanitized;
}

function parseContextRuleType(value: unknown): ContextRuleType | null {
  if (!isTuple(value) || typeof value[0] !== "string") {
    return null;
  }

  switch (value[0]) {
    case "Default":
      return { tag: "Default", values: undefined };
    case "CallContract":
      return typeof value[1] === "string"
        ? { tag: "CallContract", values: [sanitizeContractId(value[1], "Context rule contract")] }
        : null;
    case "CreateContract": {
      const wasmHash = toBuffer(value[1]);
      return wasmHash ? { tag: "CreateContract", values: [wasmHash] } : null;
    }
    default:
      return null;
  }
}

function parseContractSigner(value: unknown): ContractSigner | null {
  if (!isTuple(value) || typeof value[0] !== "string") {
    return null;
  }

  switch (value[0]) {
    case "Delegated":
      return typeof value[1] === "string"
        ? { tag: "Delegated", values: [sanitizeClassicAccount(value[1], "Delegated signer")] }
        : null;
    case "External": {
      if (typeof value[1] !== "string") {
        return null;
      }

      const keyData = toBuffer(value[2]);
      return keyData
        ? {
            tag: "External",
            values: [sanitizeContractId(value[1], "External signer verifier"), keyData],
          }
        : null;
    }
    default:
      return null;
  }
}

export function parseContextRule(value: unknown): ContextRule | null {
  if (!isRecord(value) || !isTuple(value.signers)) {
    return null;
  }

  const contextType = parseContextRuleType(value.context_type);
  const id = typeof value.id === "number" ? value.id : null;
  const name = typeof value.name === "string" ? value.name : null;
  const signers = value.signers.map(parseContractSigner);

  if (!contextType || id === null || name === null || signers.some((signer) => signer === null)) {
    return null;
  }

  return {
    context_type: contextType,
    id,
    name,
    policies: [],
    signers: signers as ContractSigner[],
    valid_until: typeof value.valid_until === "number" ? value.valid_until : undefined,
  };
}

export function contextRuleCanAuthorize(
  ruleType: ContextRuleType,
  requestedType: ContextRuleType,
): boolean {
  if (ruleType.tag !== requestedType.tag) {
    return ruleType.tag === "Default";
  }

  switch (ruleType.tag) {
    case "Default":
      return true;
    case "CallContract": {
      const rightCallContractType = requestedType as TCallContractContextRuleType;
      return ruleType.values[0] === rightCallContractType.values[0];
    }
    case "CreateContract": {
      const rightCreateContractType = requestedType as TCreateContractContextRuleType;
      const leftValue = ruleType.values[0];
      const rightValue = rightCreateContractType.values[0];

      if (leftValue.byteLength !== rightValue.byteLength) {
        return false;
      }

      return leftValue.every((byte, index) => byte === rightValue[index]);
    }
    default:
      return false;
  }
}

export async function readDefaultContextRule(params: {
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly contractId: string;
  readonly sourceAccount: string;
}): Promise<ContextRule | null> {
  const server = new rpc.Server(params.rpcUrl, {
    allowHttp: params.rpcUrl.startsWith("http://"),
    timeout: 30000,
  });
  const smartAccount = new Contract(sanitizeContractId(params.contractId, "Smart account"));
  const sourceAccount = sanitizeClassicAccount(
    params.sourceAccount,
    "RPC simulation source account",
  );
  const transaction = new TransactionBuilder(new Account(sourceAccount, "0"), {
    fee: BASE_FEE,
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(
      smartAccount.call(
        "get_context_rule",
        nativeToScVal(DEFAULT_CONTEXT_RULE_ID, { type: "u32" }),
      ),
    )
    .setTimeout(30)
    .build();
  const simulation = await server.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(simulation) || !simulation.result?.retval) {
    return null;
  }

  return parseContextRule(scValToNative(simulation.result.retval));
}
