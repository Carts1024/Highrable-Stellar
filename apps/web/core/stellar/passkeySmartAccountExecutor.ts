"use client";

import { Buffer } from "buffer";

import { toTokenUnits } from "@/core/stellar/amounts";
import { bytesToHex } from "@/core/stellar/hashes";
import { evaluateSmartAccountMainnetReadiness } from "@/core/stellar/mainnet-readiness";
import {
  getSmartAccountConfig,
  KNOWN_INCOMPATIBLE_SMART_ACCOUNT_WASM_HASHES,
  SMART_ACCOUNT_KIT_TESTNET_DEFAULTS,
  SMART_ACCOUNT_KIT_VERSION,
} from "@/core/stellar/smart-account-config";
import {
  clearSmartAccountLocalSession,
  connectFreshPasskeySmartAccount,
  getSmartAccountKit,
} from "@/core/stellar/smart-account-kit";
import { stablecoinConfig } from "@/core/stellar/stablecoin-config";
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  hash,
  Keypair,
  nativeToScVal,
  Operation,
  rpc,
  scValToNative,
  contract as stellarContract,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

import type { ContextRule, ContextRuleType, ContractSigner } from "smart-account-kit";

export type TPasskeyExecutionStatus = "success" | "failed";

export interface IPasskeySmartAccountExecutionResult {
  readonly txHash: string;
  readonly status: TPasskeyExecutionStatus;
  readonly result?: unknown;
  readonly returnValue?: xdr.ScVal;
  readonly errorMessage?: string;
}

export interface IPasskeySmartAccountExecutionParams {
  readonly smartAccountAddress: string;
  readonly actionLabel: string;
  readonly contractId: string;
  readonly method: string;
  readonly args: readonly xdr.ScVal[];
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
}

export type TPasskeyFeePath = "relayer" | "classic_source_account" | "missing";

export interface IPasskeyEscrowExecutionReadiness {
  readonly canExecute: boolean;
  readonly network: "testnet" | "mainnet" | string;
  readonly hasRelayer: boolean;
  readonly relayerUrl?: string;
  readonly hasClassicSourceAccount: boolean;
  readonly classicSourceAddress?: string;
  readonly classicSourceIsFunded: boolean;
  readonly feePath: TPasskeyFeePath;
  readonly missingReasons: string[];
  readonly warnings: string[];
  readonly reason: string | null;
  readonly usesRelayer: boolean;
  readonly feeSourceAddress: string | null;
}

const CONTRACT_ACCOUNT_PATTERN = /^C[A-Z2-7]{55}$/;
const CLASSIC_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;
const DEFAULT_CONTEXT_RULE_ID = 0;
export const SMART_ACCOUNT_COMPATIBILITY_ERROR_MESSAGE = `Connected passkey smart account is not compatible with smart-account-kit ${SMART_ACCOUNT_KIT_VERSION}. Use NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH=${SMART_ACCOUNT_KIT_TESTNET_DEFAULTS.accountWasmHash}, restart the web app, clear the old local passkey session, then create a new passkey smart account.`;
type TCallContractContextRuleType = Extract<ContextRuleType, { tag: "CallContract" }>;
type TCreateContractContextRuleType = Extract<ContextRuleType, { tag: "CreateContract" }>;

async function resetStalePasskeySessionIfNeeded(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (!isSmartAccountAuthPayloadMismatch(message)) {
    return;
  }

  try {
    await clearSmartAccountLocalSession();
  } catch {
    // The auth error is still the primary signal; local cleanup is best-effort.
  }
}

function addressScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

function u64ScVal(value: string): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: "u64" });
}

function u32ScVal(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u32" });
}

function i128ScVal(amount: bigint): xdr.ScVal {
  return nativeToScVal(amount, { type: "i128" });
}

function toEscrowTokenAmount(amount: number, decimals = stablecoinConfig.decimals): bigint {
  return toTokenUnits(amount, decimals);
}

function bytesN32ScVal(bytes: Uint8Array): xdr.ScVal {
  if (bytes.byteLength !== 32) {
    throw new Error("Expected a 32-byte hash for BytesN<32>.");
  }

  return nativeToScVal(bytes, { type: "bytes" });
}

function methodNameScVal(method: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(method);
}

function vecScVal(values: readonly xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec([...values]);
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

function createPasskeyExecutionReadiness(
  input: Omit<IPasskeyEscrowExecutionReadiness, "reason" | "usesRelayer" | "feeSourceAddress">,
): IPasskeyEscrowExecutionReadiness {
  return {
    ...input,
    reason: input.missingReasons[0] ?? null,
    usesRelayer: input.feePath === "relayer",
    feeSourceAddress: input.classicSourceAddress ?? null,
  };
}

function toReadablePasskeyError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Passkey smart account transaction failed.";

  const normalizedMessage = message.toLowerCase();

  if (isSmartAccountAbiMismatch(message)) {
    return "Connected passkey smart account is not compatible with the configured smart account artifact.";
  }

  if (isSmartAccountAuthPayloadMismatch(message)) {
    return "Clear the local passkey session, reconnect, and try again.";
  }

  if (
    normalizedMessage.includes("not connected") ||
    normalizedMessage.includes("call connectwallet")
  ) {
    return "Reconnect your passkey smart account to continue.";
  }

  if (
    normalizedMessage.includes("cancel") ||
    normalizedMessage.includes("abort") ||
    normalizedMessage.includes("notallowederror")
  ) {
    return "Passkey approval was cancelled.";
  }

  if (
    normalizedMessage.includes("relayer is not configured") ||
    normalizedMessage.includes("smart account transaction fees are not configured") ||
    normalizedMessage.includes("deployer account to exist") ||
    normalizedMessage.includes("account not found")
  ) {
    return "Smart account transaction fees are not configured.";
  }

  if (normalizedMessage.includes("classic source account is not funded")) {
    return "Classic source account is not funded on mainnet.";
  }

  if (
    normalizedMessage.includes("not linked to this smart account") ||
    normalizedMessage.includes("not an active signer") ||
    normalizedMessage.includes("selected passkey is not linked")
  ) {
    return "The selected passkey is not linked to this smart account.";
  }

  if (normalizedMessage.includes("unauthorized") || normalizedMessage.includes("auth")) {
    return "This smart account is not authorized for the escrow action.";
  }

  if (normalizedMessage.includes("invalidstatus") || normalizedMessage.includes("invalid status")) {
    return "This escrow is not in the correct state for this action.";
  }

  if (normalizedMessage.includes("timeout") || normalizedMessage.includes("timed out")) {
    return "The network is taking longer than expected. Check the transaction status and retry if needed.";
  }

  if (
    normalizedMessage.includes("executeandsubmit") ||
    normalizedMessage.includes("signandsubmit") ||
    normalizedMessage.includes("assembled")
  ) {
    return "The current smart-account-kit version does not expose the required transaction execution method.";
  }

  return message;
}

function normalizeWasmHash(value: string): string {
  return value.trim().toLowerCase();
}

function isSmartAccountAuthPayloadMismatch(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("__check_auth") &&
    normalizedMessage.includes("invalidaction") &&
    normalizedMessage.includes("unreachablecodereached")
  );
}

function isSmartAccountAbiMismatch(message: string): boolean {
  return message.toLowerCase().includes("trying to invoke non-existent contract function");
}

type TAuthPayload = {
  context_rule_ids: number[];
  signers: Map<ContractSigner, Buffer>;
};

type TPasskeyWebAuthnResponse = {
  readonly response: {
    readonly authenticatorData: string;
    readonly clientDataJSON: string;
    readonly signature: string;
  };
};

type TLegacyCompatibleSmartAccountKit = {
  readonly rpc: rpc.Server;
  readonly networkPassphrase: string;
  readonly deployerPublicKey: string;
  readonly contractId?: string;
  readonly credentialId?: string;
  readonly rpId?: string;
  readonly timeoutInSeconds: number;
  readonly deployerKeypair: Keypair;
  readonly webAuthn: {
    readonly startAuthentication: (args: {
      readonly optionsJSON: {
        readonly challenge: string;
        readonly rpId?: string;
        readonly userVerification: "preferred";
        readonly timeout: number;
        readonly allowCredentials: readonly [{ readonly id: string; readonly type: "public-key" }];
      };
    }) => Promise<TPasskeyWebAuthnResponse>;
  };
  readonly storage: {
    readonly update: (
      credentialId: string,
      updates: { readonly lastUsedAt?: number },
    ) => Promise<void>;
  };
  readonly wallet?: TSmartAccountWalletWithContextRuleFallback;
  readonly getContractDetailsFromIndexer: (contractId: string) => Promise<{
    readonly contextRules: readonly { readonly context_rule_id: number }[];
  } | null>;
  readonly calculateExpiration: () => Promise<number>;
  readonly shouldUseFeeSponsoring: (options?: {
    readonly forceMethod?: "relayer" | "rpc";
  }) => boolean;
  readonly hasSourceAccountAuth: (transaction: Transaction) => boolean;
  readonly sendAndPoll: (
    transaction: Transaction,
    options?: { readonly forceMethod?: "relayer" | "rpc" },
  ) => Promise<{
    readonly success: boolean;
    readonly hash: string;
    readonly error?: string;
  }>;
};

function decodeBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function encodeBase64Url(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function compactSignature(derSignature: Buffer): Buffer {
  let offset = 2;

  const rLength = derSignature[offset + 1];
  if (rLength === undefined) {
    throw new Error("Invalid DER signature: missing R length");
  }
  const r = derSignature.slice(offset + 2, offset + 2 + rLength);

  offset += 2 + rLength;

  const sLength = derSignature[offset + 1];
  if (sLength === undefined) {
    throw new Error("Invalid DER signature: missing S length");
  }
  const s = derSignature.slice(offset + 2, offset + 2 + sLength);

  const rBigInt = BigInt(`0x${r.toString("hex")}`);
  let sBigInt = BigInt(`0x${s.toString("hex")}`);
  const curveOrder = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
  const halfCurveOrder = curveOrder / 2n;

  if (sBigInt > halfCurveOrder) {
    sBigInt = curveOrder - sBigInt;
  }

  return Buffer.concat([
    Buffer.from(rBigInt.toString(16).padStart(64, "0"), "hex"),
    Buffer.from(sBigInt.toString(16).padStart(64, "0"), "hex"),
  ]);
}

function buildSignaturePayload(
  networkPassphrase: string,
  entry: xdr.SorobanAuthorizationEntry,
  expiration: number,
): Buffer {
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(networkPassphrase)),
      nonce: entry.credentials().address().nonce(),
      signatureExpirationLedger: expiration,
      invocation: entry.rootInvocation(),
    }),
  );

  return hash(preimage.toXDR());
}

function buildAuthDigest(signaturePayload: Buffer, contextRuleIds: readonly number[]): Buffer {
  const ruleIdsXdr = xdr.ScVal.scvVec(
    contextRuleIds.map((contextRuleId) => xdr.ScVal.scvU32(contextRuleId)),
  ).toXDR();

  return hash(Buffer.concat([signaturePayload, ruleIdsXdr]));
}

function buildWebAuthnSignatureBytes(sigData: {
  readonly authenticator_data: Buffer;
  readonly client_data: Buffer;
  readonly signature: Buffer;
}): Buffer {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("authenticator_data"),
      val: xdr.ScVal.scvBytes(sigData.authenticator_data),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("client_data"),
      val: xdr.ScVal.scvBytes(sigData.client_data),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(sigData.signature),
    }),
  ]).toXDR();
}

function contractSignersEqual(left: ContractSigner, right: ContractSigner): boolean {
  if (left.tag !== right.tag) {
    return false;
  }

  if (left.tag === "Delegated" && right.tag === "Delegated") {
    return left.values[0] === right.values[0];
  }

  if (left.tag === "External" && right.tag === "External") {
    return (
      left.values[0] === right.values[0] &&
      Buffer.from(left.values[1]).equals(Buffer.from(right.values[1]))
    );
  }

  return false;
}

function emptyAuthPayload(): TAuthPayload {
  return {
    context_rule_ids: [],
    signers: new Map(),
  };
}

function signerToScVal(signer: ContractSigner): xdr.ScVal {
  if (signer.tag === "Delegated") {
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Delegated"),
      xdr.ScVal.scvAddress(Address.fromString(signer.values[0]).toScAddress()),
    ]);
  }

  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("External"),
    xdr.ScVal.scvAddress(Address.fromString(signer.values[0]).toScAddress()),
    xdr.ScVal.scvBytes(Buffer.from(signer.values[1])),
  ]);
}

function parseSignerScVal(value: xdr.ScVal): ContractSigner {
  if (value.switch().name !== "scvVec") {
    throw new Error("Signer key is not encoded as a vector");
  }

  const items = value.vec() ?? [];
  const first = items[0];
  const second = items[1];
  const third = items[2];

  if (!first || !second || first.switch().name !== "scvSymbol") {
    throw new Error("Signer key is not a valid enum encoding");
  }

  const variant = first.sym().toString();
  if (variant === "Delegated") {
    if (second.switch().name !== "scvAddress") {
      throw new Error("Delegated signer is missing an address");
    }

    return {
      tag: "Delegated",
      values: [Address.fromScAddress(second.address()).toString()],
    };
  }

  if (
    variant === "External" &&
    second.switch().name === "scvAddress" &&
    third?.switch().name === "scvBytes"
  ) {
    return {
      tag: "External",
      values: [Address.fromScAddress(second.address()).toString(), Buffer.from(third.bytes())],
    };
  }

  throw new Error(`Unknown signer variant: ${variant}`);
}

function readAuthPayload(signature: xdr.ScVal): TAuthPayload {
  if (signature.switch().name === "scvVoid") {
    return emptyAuthPayload();
  }

  if (signature.switch().name !== "scvMap") {
    throw new Error("Smart account auth signature is not encoded as AuthPayload");
  }

  const payload = emptyAuthPayload();
  for (const entry of signature.map() ?? []) {
    if (entry.key().switch().name !== "scvSymbol") {
      continue;
    }

    const field = entry.key().sym().toString();
    if (field === "context_rule_ids") {
      if (entry.val().switch().name !== "scvVec") {
        throw new Error("AuthPayload.context_rule_ids is not a vector");
      }

      payload.context_rule_ids = (entry.val().vec() ?? []).map((item) => {
        if (item.switch().name !== "scvU32") {
          throw new Error("AuthPayload.context_rule_ids contains a non-u32 value");
        }

        return item.u32();
      });
      continue;
    }

    if (field === "signers") {
      if (entry.val().switch().name !== "scvMap") {
        throw new Error("AuthPayload.signers is not a map");
      }

      for (const signerEntry of entry.val().map() ?? []) {
        const signer = parseSignerScVal(signerEntry.key());
        if (signerEntry.val().switch().name !== "scvBytes") {
          throw new Error("AuthPayload.signers contains a non-bytes signature value");
        }

        payload.signers.set(signer, Buffer.from(signerEntry.val().bytes()));
      }
    }
  }

  return payload;
}

function writeAuthPayload(payload: TAuthPayload): xdr.ScVal {
  const signerEntries = Array.from(payload.signers.entries()).map(
    ([signer, signatureBytes]) =>
      new xdr.ScMapEntry({
        key: signerToScVal(signer),
        val: xdr.ScVal.scvBytes(signatureBytes),
      }),
  );

  signerEntries.sort((left, right) =>
    left.key().toXDR("hex").localeCompare(right.key().toXDR("hex")),
  );

  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("context_rule_ids"),
      val: xdr.ScVal.scvVec(
        payload.context_rule_ids.map((contextRuleId) => xdr.ScVal.scvU32(contextRuleId)),
      ),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signers"),
      val: xdr.ScVal.scvMap(signerEntries),
    }),
  ]);
}

function upsertAuthPayloadSigner(
  payload: TAuthPayload,
  signer: ContractSigner,
  signatureBytes: Buffer,
): void {
  for (const existingSigner of payload.signers.keys()) {
    if (contractSignersEqual(existingSigner, signer)) {
      payload.signers.delete(existingSigner);
      break;
    }
  }

  payload.signers.set(signer, signatureBytes);
}

function contextRuleTypeKey(value: ContextRuleType): string {
  if (value.tag === "Default") {
    return "Default";
  }

  if (value.tag === "CallContract") {
    return `CallContract:${value.values[0]}`;
  }

  return `CreateContract:${Buffer.from(value.values[0]).toString("hex")}`;
}

function extractExecuteTargetContract(args: xdr.InvokeContractArgs): string | null {
  if (args.functionName().toString() !== "execute") {
    return null;
  }

  const contractArgs = args.args();
  if (!contractArgs || contractArgs.length < 3) {
    return null;
  }

  const [targetArg, targetFnArg, targetArgsArg] = contractArgs;
  if (!targetArg || !targetFnArg || !targetArgsArg) {
    return null;
  }

  if (targetArg.switch().name !== "scvAddress") {
    return null;
  }

  const targetFnType = targetFnArg.switch().name;
  if (targetFnType !== "scvSymbol" && targetFnType !== "scvString") {
    return null;
  }

  if (targetArgsArg.switch().name !== "scvVec") {
    return null;
  }

  return Address.fromScAddress(targetArg.address()).toString();
}

function buildInvocationContextTypes(entry: xdr.SorobanAuthorizationEntry): ContextRuleType[] {
  const contexts: ContextRuleType[] = [];
  const seen = new Set<string>();

  const pushContext = (context: ContextRuleType): void => {
    const key = contextRuleTypeKey(context);
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    contexts.push(context);
  };

  const walk = (invocation: xdr.SorobanAuthorizedInvocation): void => {
    const fn = invocation.function();
    const switchName = fn.switch().name;

    if (switchName === "sorobanAuthorizedFunctionTypeContractFn") {
      const args = fn.contractFn();
      pushContext({
        tag: "CallContract",
        values: [
          extractExecuteTargetContract(args) ??
            Address.fromScAddress(args.contractAddress()).toString(),
        ],
      });
    }

    for (const subInvocation of invocation.subInvocations()) {
      walk(subInvocation);
    }
  };

  walk(entry.rootInvocation());
  return contexts;
}

function signerMatchesCredentialId(signer: ContractSigner, credentialId: string): boolean {
  if (signer.tag !== "External") {
    return false;
  }

  const credentialIdBytes = decodeBase64Url(credentialId);
  const keyData = Buffer.from(signer.values[1]);

  if (keyData.length <= credentialIdBytes.length) {
    return false;
  }

  return keyData.slice(keyData.length - credentialIdBytes.length).equals(credentialIdBytes);
}

async function readConnectedContextRules(
  kit: TLegacyCompatibleSmartAccountKit,
  config: ReturnType<typeof getSmartAccountConfig>,
): Promise<readonly ContextRule[]> {
  const contractId = kit.contractId;
  if (!contractId || !config || !kit.wallet) {
    return [];
  }

  const details = await kit.getContractDetailsFromIndexer(contractId).catch(() => null);
  const discoveredRuleIds = Array.from(
    new Set(
      (details?.contextRules ?? [])
        .map((rule: { readonly context_rule_id: number }) => rule.context_rule_id)
        .filter((ruleId: number) => Number.isInteger(ruleId)),
    ),
  ).sort((left: number, right: number) => left - right);

  const rules: ContextRule[] = [];
  for (const contextRuleId of discoveredRuleIds) {
    try {
      const rule = await kit.wallet.get_context_rule({ context_rule_id: contextRuleId });
      if (rule.result) {
        const parsedRule = parseContextRule(rule.result);
        if (parsedRule) {
          rules.push(parsedRule);
        }
      }
    } catch {
      // Ignore stale indexer ids and fall back below when needed.
    }
  }

  if (rules.length > 0) {
    return rules;
  }

  const defaultRule = CLASSIC_ACCOUNT_PATTERN.test(kit.deployerPublicKey)
    ? await readDefaultContextRule({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        contractId,
        sourceAccount: kit.deployerPublicKey,
      })
    : null;

  return defaultRule ? [defaultRule] : [];
}

function findPasskeySignerForCredential(
  rules: readonly ContextRule[],
  credentialId: string,
): ContractSigner {
  const matches = rules
    .flatMap((rule) => rule.signers)
    .filter((signer) => signerMatchesCredentialId(signer, credentialId));

  if (matches.length === 1) {
    return matches[0]!;
  }

  if (matches.length === 0) {
    throw new Error("The authenticated passkey is not an active signer on this smart account.");
  }

  throw new Error(
    "Multiple WebAuthn signers matched the connected credential. Reconnect the intended passkey and retry.",
  );
}

function resolveContextRuleIdsForEntry(
  rules: readonly ContextRule[],
  entry: xdr.SorobanAuthorizationEntry,
  selectedSigner: ContractSigner,
): number[] {
  const contexts = buildInvocationContextTypes(entry);
  const defaultRule = rules.find((rule) => rule.context_type.tag === "Default");

  if (contexts.length === 0) {
    return defaultRule ? [defaultRule.id] : [DEFAULT_CONTEXT_RULE_ID];
  }

  return contexts.map((contextType) => {
    const candidates = rules.filter((rule) =>
      contextRuleCanAuthorize(rule.context_type, contextType),
    );

    const exactSignerMatches = candidates.filter(
      (rule) => rule.signers.length === 1 && contractSignersEqual(rule.signers[0]!, selectedSigner),
    );
    if (exactSignerMatches.length === 1) {
      return exactSignerMatches[0]!.id;
    }

    const signerSubsetMatches = candidates.filter(
      (rule) =>
        rule.policies.length === 0 &&
        rule.signers.every((ruleSigner) => contractSignersEqual(ruleSigner, selectedSigner)),
    );
    if (signerSubsetMatches.length === 1) {
      return signerSubsetMatches[0]!.id;
    }

    if (defaultRule) {
      return defaultRule.id;
    }

    if (candidates.length === 1) {
      return candidates[0]!.id;
    }

    throw new Error(
      `Unable to resolve a unique context rule for ${contextRuleTypeKey(contextType)} on this smart account.`,
    );
  });
}

async function signAuthEntryWithAuthPayload(
  kit: TLegacyCompatibleSmartAccountKit,
  entry: xdr.SorobanAuthorizationEntry,
  rules: readonly ContextRule[],
  credentialId: string,
): Promise<xdr.SorobanAuthorizationEntry> {
  const normalizedEntry = xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR());
  const credentials = normalizedEntry.credentials().address();
  const expiration = await kit.calculateExpiration();
  credentials.signatureExpirationLedger(expiration);

  const signer = findPasskeySignerForCredential(rules, credentialId);
  const contextRuleIds = resolveContextRuleIdsForEntry(rules, normalizedEntry, signer);
  const signaturePayload = buildSignaturePayload(
    kit.networkPassphrase,
    normalizedEntry,
    expiration,
  );
  const authDigest = buildAuthDigest(signaturePayload, contextRuleIds);
  const authResponse = await kit.webAuthn.startAuthentication({
    optionsJSON: {
      challenge: encodeBase64Url(authDigest),
      rpId: kit.rpId,
      userVerification: "preferred",
      timeout: 60_000,
      allowCredentials: [{ id: credentialId, type: "public-key" }],
    },
  });

  const authPayload = readAuthPayload(credentials.signature());
  if (
    authPayload.context_rule_ids.length > 0 &&
    authPayload.context_rule_ids.join(",") !== contextRuleIds.join(",")
  ) {
    throw new Error("Existing auth payload uses different context rule IDs");
  }

  authPayload.context_rule_ids = contextRuleIds;
  upsertAuthPayloadSigner(
    authPayload,
    signer,
    buildWebAuthnSignatureBytes({
      authenticator_data: decodeBase64Url(authResponse.response.authenticatorData),
      client_data: decodeBase64Url(authResponse.response.clientDataJSON),
      signature: compactSignature(decodeBase64Url(authResponse.response.signature)),
    }),
  );
  credentials.signature(writeAuthPayload(authPayload));

  await kit.storage.update(credentialId, { lastUsedAt: Date.now() }).catch(() => undefined);
  return normalizedEntry;
}

async function signAndSubmitWithAuthPayload(
  assembledTransaction: stellarContract.AssembledTransaction<xdr.ScVal>,
): Promise<{ readonly success: boolean; readonly hash: string; readonly error?: string }> {
  const kit = getSmartAccountKit() as unknown as TLegacyCompatibleSmartAccountKit;
  const config = getSmartAccountConfig();

  if (!config) {
    throw new Error("Passkey smart account execution is not configured.");
  }

  if (!kit.contractId || !kit.credentialId) {
    throw new Error("Reconnect your passkey smart account to continue.");
  }

  const builtTx = assembledTransaction.built;
  if (!builtTx || builtTx.operations.length !== 1) {
    throw new Error("Expected exactly one invokeHostFunction operation.");
  }

  const operation = builtTx.operations[0];
  if (!operation || operation.type !== "invokeHostFunction") {
    throw new Error("Expected invokeHostFunction operation.");
  }

  const authEntries = assembledTransaction.simulationData?.result?.auth;
  if (!authEntries || authEntries.length === 0) {
    throw new Error("Smart account transaction did not include any authorization entries.");
  }

  const rules = await readConnectedContextRules(kit, config);
  const signedAuthEntries = await Promise.all(
    authEntries.map((authEntry) =>
      signAuthEntryWithAuthPayload(kit, authEntry, rules, kit.credentialId!),
    ),
  );

  let sourceAccount: Account;
  const sourcePublicKey = kit.deployerKeypair.publicKey();
  if (!CLASSIC_ACCOUNT_PATTERN.test(sourcePublicKey)) {
    throw new Error("Smart account transaction fees are not configured.");
  }

  try {
    sourceAccount = await kit.rpc.getAccount(sourcePublicKey);
  } catch {
    throw new Error("Classic source account is not funded on mainnet.");
  }

  const invokeOp = operation as Operation.InvokeHostFunction;
  const resimTx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: kit.networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: invokeOp.func,
        auth: signedAuthEntries,
      }),
    )
    .setTimeout(kit.timeoutInSeconds)
    .build();

  const resimResult = await kit.rpc.simulateTransaction(resimTx);
  if (rpc.Api.isSimulationError(resimResult)) {
    throw new Error(`Re-simulation failed: ${resimResult.error}`);
  }

  const normalizedTx = TransactionBuilder.fromXDR(resimTx.toXDR(), kit.networkPassphrase);
  const preparedTx = rpc.assembleTransaction(normalizedTx as Transaction, resimResult).build();
  const submissionOptions = {};

  if (!kit.shouldUseFeeSponsoring(submissionOptions) || kit.hasSourceAccountAuth(preparedTx)) {
    preparedTx.sign(kit.deployerKeypair);
  }

  return await kit.sendAndPoll(preparedTx, submissionOptions);
}

function contextRuleTypesEqual(left: ContextRuleType, right: ContextRuleType): boolean {
  if (left.tag !== right.tag) {
    return false;
  }

  switch (left.tag) {
    case "Default":
      return true;
    case "CallContract": {
      const rightCallContractType = right as TCallContractContextRuleType;
      return left.values[0] === rightCallContractType.values[0];
    }
    case "CreateContract": {
      const rightCreateContractType = right as TCreateContractContextRuleType;
      const leftValue = left.values[0];
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

function contextRuleCanAuthorize(
  ruleType: ContextRuleType,
  requestedType: ContextRuleType,
): boolean {
  return ruleType.tag === "Default" || contextRuleTypesEqual(ruleType, requestedType);
}

type TContextRule = {
  readonly context_type: ContextRuleType;
  readonly signers: readonly ContractSigner[];
};

type TSmartAccountWalletWithContextRuleFallback = {
  get_context_rule: (params: {
    readonly context_rule_id: number;
  }) => Promise<{ result?: TContextRule }>;
  get_context_rules?: (params: {
    readonly context_rule_type: ContextRuleType;
  }) => Promise<{ result: TContextRule[] }>;
  __highrableContextRulesFallbackInstalled?: boolean;
};

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

function parseContextRule(value: unknown): ContextRule | null {
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

async function readDefaultContextRule(params: {
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly contractId: string;
  readonly sourceAccount: string;
}): Promise<ContextRule | null> {
  const server = createRpcServer(params.rpcUrl);
  const smartAccount = new Contract(params.contractId);
  const transaction = new TransactionBuilder(new Account(params.sourceAccount, "0"), {
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

function installContextRulesCompatibilityFallback(
  kit: ReturnType<typeof getSmartAccountKit>,
): void {
  const wallet = kit.wallet as TSmartAccountWalletWithContextRuleFallback | undefined;
  if (!wallet || wallet.__highrableContextRulesFallbackInstalled) {
    return;
  }

  const sdkGetContextRules = wallet.get_context_rules?.bind(wallet);

  wallet.get_context_rules = async ({ context_rule_type }) => {
    const config = getSmartAccountConfig();
    const contractId = kit.contractId;
    const rule =
      config && contractId && CLASSIC_ACCOUNT_PATTERN.test(kit.deployerPublicKey)
        ? await readDefaultContextRule({
            rpcUrl: config.rpcUrl,
            networkPassphrase: config.networkPassphrase,
            contractId,
            sourceAccount: kit.deployerPublicKey,
          })
        : null;

    if (rule) {
      return {
        result: contextRuleCanAuthorize(rule.context_type, context_rule_type) ? [rule] : [],
      };
    }

    if (sdkGetContextRules) {
      return await sdkGetContextRules({ context_rule_type });
    }

    return {
      result: [],
    };
  };

  wallet.__highrableContextRulesFallbackInstalled = true;
}

function createRpcServer(rpcUrl: string): rpc.Server {
  return new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
    timeout: 30000,
  });
}

async function readReturnValue(params: {
  readonly rpcUrl: string;
  readonly txHash: string;
}): Promise<xdr.ScVal | undefined> {
  const server = createRpcServer(params.rpcUrl);
  const transaction = await server.getTransaction(params.txHash);

  if (transaction.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    return undefined;
  }

  return transaction.returnValue;
}

export async function readSmartAccountWasmHash(params: {
  readonly rpcUrl: string;
  readonly contractId: string;
}): Promise<string> {
  const server = createRpcServer(params.rpcUrl);
  const contractLedgerKey = new Contract(params.contractId).getFootprint();
  const response = await server.getLedgerEntries(contractLedgerKey);
  const ledgerEntry = response.entries[0]?.val;

  if (!ledgerEntry) {
    throw new Error("Smart account contract was not found on-chain.");
  }

  const wasmHash = ledgerEntry.contractData().val().instance().executable().wasmHash();
  return bytesToHex(wasmHash);
}

async function buildSmartAccountExecuteTransaction(params: {
  readonly smartAccountAddress: string;
  readonly contractId: string;
  readonly method: string;
  readonly args: readonly xdr.ScVal[];
  readonly sourceAccount: string;
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
}): Promise<stellarContract.AssembledTransaction<xdr.ScVal>> {
  const operation = new Contract(params.smartAccountAddress).call(
    "execute",
    addressScVal(params.contractId),
    methodNameScVal(params.method),
    vecScVal(params.args),
  );

  return await stellarContract.AssembledTransaction.buildWithOp(operation, {
    publicKey: params.sourceAccount,
    contractId: params.smartAccountAddress,
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    allowHttp: params.rpcUrl.startsWith("http://"),
    method: "execute",
    parseResultXdr: (value) => value,
  });
}

export async function assertSmartAccountKitCompatibility(
  kit: ReturnType<typeof getSmartAccountKit>,
): Promise<void> {
  if (!kit.wallet) {
    throw new Error("Reconnect your passkey smart account to continue.");
  }

  const config = getSmartAccountConfig();
  if (!config) {
    throw new Error("Passkey smart account execution is not configured.");
  }

  const configuredWasmHash = normalizeWasmHash(config.accountWasmHash);
  if (KNOWN_INCOMPATIBLE_SMART_ACCOUNT_WASM_HASHES.has(configuredWasmHash)) {
    throw new Error(
      `NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH is a known incompatible smart account artifact for smart-account-kit ${SMART_ACCOUNT_KIT_VERSION}. Use ${SMART_ACCOUNT_KIT_TESTNET_DEFAULTS.accountWasmHash}, restart the web app so the new environment is loaded, clear the old passkey session, then create a new passkey smart account.`,
    );
  }

  const connectedContractId = kit.contractId;
  if (!connectedContractId || !CONTRACT_ACCOUNT_PATTERN.test(connectedContractId)) {
    throw new Error("Reconnect your passkey smart account to continue.");
  }

  const deployedWasmHash = await readSmartAccountWasmHash({
    rpcUrl: config.rpcUrl,
    contractId: connectedContractId,
  });

  if (deployedWasmHash !== configuredWasmHash) {
    throw new Error(
      `${SMART_ACCOUNT_COMPATIBILITY_ERROR_MESSAGE} Expected WASM hash ${configuredWasmHash}. Connected account uses ${deployedWasmHash}.`,
    );
  }

  installContextRulesCompatibilityFallback(kit);
}

export async function getPasskeyEscrowExecutionReadiness(): Promise<IPasskeyEscrowExecutionReadiness> {
  const config = getSmartAccountConfig();
  if (!config) {
    return createPasskeyExecutionReadiness({
      canExecute: false,
      network: "unknown",
      hasRelayer: false,
      hasClassicSourceAccount: false,
      classicSourceIsFunded: false,
      feePath: "missing",
      missingReasons: ["Passkey smart account configuration is incomplete."],
      warnings: [],
    });
  }

  const configuredWasmHash = normalizeWasmHash(config.accountWasmHash);
  const staticReadiness = evaluateSmartAccountMainnetReadiness();
  const network = staticReadiness.network;
  if (
    config.networkPassphrase === "Test SDF Network ; September 2015" &&
    KNOWN_INCOMPATIBLE_SMART_ACCOUNT_WASM_HASHES.has(configuredWasmHash)
  ) {
    return createPasskeyExecutionReadiness({
      canExecute: false,
      network,
      hasRelayer: Boolean(config.relayerUrl),
      ...(config.relayerUrl ? { relayerUrl: config.relayerUrl } : {}),
      hasClassicSourceAccount: false,
      classicSourceIsFunded: false,
      feePath: "missing",
      missingReasons: [
        `NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH is a known incompatible smart account artifact for smart-account-kit ${SMART_ACCOUNT_KIT_VERSION}. ` +
          `Use ${SMART_ACCOUNT_KIT_TESTNET_DEFAULTS.accountWasmHash}, restart the web app so the new environment is loaded, clear the old passkey session, then create a new passkey smart account.`,
      ],
      warnings: [],
    });
  }

  const kit = getSmartAccountKit();
  const hasRelayer = Boolean(config.relayerUrl) || kit.relayer !== null;
  const classicSourceAddress = CLASSIC_ACCOUNT_PATTERN.test(kit.deployerPublicKey)
    ? kit.deployerPublicKey
    : undefined;
  const missingReasons: string[] = [];
  const warnings: string[] = [];
  let connectedAccountWasmHash: string | undefined;

  if (kit.isConnected) {
    try {
      await assertSmartAccountKitCompatibility(kit);
      if (kit.contractId) {
        connectedAccountWasmHash = await readSmartAccountWasmHash({
          rpcUrl: config.rpcUrl,
          contractId: kit.contractId,
        }).catch(() => undefined);
      }
    } catch (error) {
      return createPasskeyExecutionReadiness({
        canExecute: false,
        network,
        hasRelayer,
        ...(config.relayerUrl ? { relayerUrl: config.relayerUrl } : {}),
        hasClassicSourceAccount: Boolean(classicSourceAddress),
        ...(classicSourceAddress ? { classicSourceAddress } : {}),
        classicSourceIsFunded: false,
        feePath: "missing",
        missingReasons: [
          error instanceof Error
            ? error.message
            : "Passkey smart account configuration is incomplete.",
        ],
        warnings,
      });
    }
  } else {
    missingReasons.push("Reconnect your passkey smart account to continue.");
  }

  if (hasRelayer) {
    const readiness = evaluateSmartAccountMainnetReadiness({
      connectedAccountAddress: kit.contractId,
      connectedAccountWasmHash,
      sourceAccount: classicSourceAddress,
      sourceAccountFunded: null,
    });
    const canExecute = readiness.isMainnet
      ? readiness.capabilities.canExecuteMainnetPasskeyEscrow
      : true;
    const relayerMissingReasons = canExecute
      ? missingReasons
      : [
          ...missingReasons,
          readiness.blockingIssues[0] ??
            "Mainnet passkey escrow is blocked until readiness issues are resolved.",
        ];

    return createPasskeyExecutionReadiness({
      canExecute: canExecute && relayerMissingReasons.length === 0,
      network: readiness.network,
      hasRelayer: true,
      ...(config.relayerUrl ? { relayerUrl: config.relayerUrl } : {}),
      hasClassicSourceAccount: Boolean(classicSourceAddress),
      ...(classicSourceAddress ? { classicSourceAddress } : {}),
      classicSourceIsFunded: false,
      feePath: "relayer",
      missingReasons: relayerMissingReasons,
      warnings: readiness.warnings,
    });
  }

  if (!classicSourceAddress) {
    return createPasskeyExecutionReadiness({
      canExecute: false,
      network,
      hasRelayer: false,
      hasClassicSourceAccount: false,
      classicSourceIsFunded: false,
      feePath: "missing",
      missingReasons: [
        ...missingReasons,
        "Smart account transaction fees are not configured.",
        "No relayer URL is configured and no classic source account is available.",
      ],
      warnings,
    });
  }

  try {
    await createRpcServer(config.rpcUrl).getAccount(classicSourceAddress);
    const readiness = evaluateSmartAccountMainnetReadiness({
      connectedAccountAddress: kit.contractId,
      connectedAccountWasmHash,
      sourceAccount: classicSourceAddress,
      sourceAccountFunded: true,
    });
    const readinessMissingReasons =
      readiness.isMainnet && !readiness.capabilities.canExecuteMainnetPasskeyEscrow
        ? [
            ...missingReasons,
            readiness.blockingIssues[0] ??
              "Mainnet passkey escrow is blocked until readiness issues are resolved.",
          ]
        : missingReasons;

    return createPasskeyExecutionReadiness({
      canExecute: readinessMissingReasons.length === 0,
      network: readiness.network,
      hasRelayer: false,
      hasClassicSourceAccount: true,
      classicSourceAddress,
      classicSourceIsFunded: true,
      feePath: readinessMissingReasons.length === 0 ? "classic_source_account" : "missing",
      missingReasons: readinessMissingReasons,
      warnings: readiness.warnings,
    });
  } catch {
    const readiness = evaluateSmartAccountMainnetReadiness({
      connectedAccountAddress: kit.contractId,
      connectedAccountWasmHash,
      sourceAccount: classicSourceAddress,
      sourceAccountFunded: false,
    });
    const unfundedMessage =
      readiness.isMainnet || network === "mainnet"
        ? "Classic source account is not funded on mainnet."
        : "Smart account transaction fees are not configured.";

    return createPasskeyExecutionReadiness({
      canExecute: false,
      network: readiness.network,
      hasRelayer: false,
      hasClassicSourceAccount: true,
      classicSourceAddress,
      classicSourceIsFunded: false,
      feePath: "missing",
      missingReasons: [
        ...missingReasons,
        unfundedMessage,
        readiness.blockingIssues[0] ??
          "No relayer URL is configured and no classic source account is available.",
      ],
      warnings: readiness.warnings,
    });
  }
}

export async function executeWithPasskeySmartAccount(
  params: IPasskeySmartAccountExecutionParams,
): Promise<IPasskeySmartAccountExecutionResult> {
  const smartAccountAddress = sanitizeContractId(
    params.smartAccountAddress,
    "Smart account address",
  );
  const contractId = sanitizeContractId(params.contractId, "Contract ID");
  const kit = getSmartAccountKit();

  if (!kit.isConnected || kit.contractId !== smartAccountAddress) {
    const connected = await connectFreshPasskeySmartAccount({
      preferredContractId: smartAccountAddress,
    });

    if (!connected || connected.contractId !== smartAccountAddress) {
      throw new Error("Reconnect your passkey smart account to continue.");
    }
  }

  try {
    await assertSmartAccountKitCompatibility(kit);
    const readiness = await getPasskeyEscrowExecutionReadiness();
    if (!readiness.canExecute) {
      throw new Error(
        readiness.reason ??
          "Mainnet passkey escrow is blocked until the issues below are resolved.",
      );
    }
    const sourceAccount = sanitizeClassicAccount(
      readiness.classicSourceAddress ?? kit.deployerPublicKey,
      "Classic source account",
    );

    const assembledTransaction = await buildSmartAccountExecuteTransaction({
      smartAccountAddress,
      contractId,
      method: params.method,
      args: params.args,
      sourceAccount,
      rpcUrl: params.rpcUrl,
      networkPassphrase: params.networkPassphrase,
    });

    const result = await signAndSubmitWithAuthPayload(assembledTransaction);
    if (!result.success) {
      return {
        txHash: result.hash,
        status: "failed",
        errorMessage: toReadablePasskeyError(result.error ?? `${params.actionLabel} failed.`),
      };
    }

    const returnValue = await readReturnValue({
      rpcUrl: params.rpcUrl,
      txHash: result.hash,
    });

    return {
      txHash: result.hash,
      status: "success",
      returnValue,
      result: returnValue ? scValToNative(returnValue) : undefined,
    };
  } catch (error) {
    await resetStalePasskeySessionIfNeeded(error);

    return {
      txHash: "",
      status: "failed",
      errorMessage: toReadablePasskeyError(error),
    };
  }
}

interface IPasskeyEscrowWrapperBase {
  readonly smartAccountAddress: string;
  readonly escrowContractId: string;
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
}

export async function createEscrowWithPasskey(
  params: IPasskeyEscrowWrapperBase & {
    readonly freelancerWallet: string;
    readonly assetContractId: string;
    readonly amount: number;
    readonly assetDecimals?: number;
    readonly jobHashOrMilestoneHash: Uint8Array;
  },
): Promise<IPasskeySmartAccountExecutionResult> {
  return await executeWithPasskeySmartAccount({
    smartAccountAddress: params.smartAccountAddress,
    actionLabel: "create_escrow",
    contractId: params.escrowContractId,
    method: "create_escrow",
    args: [
      addressScVal(params.smartAccountAddress),
      addressScVal(params.freelancerWallet),
      addressScVal(params.assetContractId),
      i128ScVal(toEscrowTokenAmount(params.amount, params.assetDecimals)),
      bytesN32ScVal(params.jobHashOrMilestoneHash),
    ],
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
  });
}

export async function fundEscrowWithPasskey(
  params: IPasskeyEscrowWrapperBase & { readonly escrowId: string },
): Promise<IPasskeySmartAccountExecutionResult> {
  return await executeWithPasskeySmartAccount({
    smartAccountAddress: params.smartAccountAddress,
    actionLabel: "fund_escrow",
    contractId: params.escrowContractId,
    method: "fund_escrow",
    args: [addressScVal(params.smartAccountAddress), u64ScVal(params.escrowId)],
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
  });
}

export async function submitWorkWithPasskey(
  params: IPasskeyEscrowWrapperBase & { readonly escrowId: string; readonly proofHash: Uint8Array },
): Promise<IPasskeySmartAccountExecutionResult> {
  return await executeWithPasskeySmartAccount({
    smartAccountAddress: params.smartAccountAddress,
    actionLabel: "submit_work",
    contractId: params.escrowContractId,
    method: "submit_work",
    args: [
      addressScVal(params.smartAccountAddress),
      u64ScVal(params.escrowId),
      bytesN32ScVal(params.proofHash),
    ],
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
  });
}

export async function approveAndReleaseWithPasskey(
  params: IPasskeyEscrowWrapperBase & {
    readonly escrowId: string;
    readonly rating: number;
    readonly reviewHash: Uint8Array;
  },
): Promise<IPasskeySmartAccountExecutionResult> {
  return await executeWithPasskeySmartAccount({
    smartAccountAddress: params.smartAccountAddress,
    actionLabel: "approve_and_release",
    contractId: params.escrowContractId,
    method: "approve_and_release",
    args: [
      addressScVal(params.smartAccountAddress),
      u64ScVal(params.escrowId),
      u32ScVal(params.rating),
      bytesN32ScVal(params.reviewHash),
    ],
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
  });
}

export async function cancelEscrowWithPasskey(
  params: IPasskeyEscrowWrapperBase & { readonly escrowId: string },
): Promise<IPasskeySmartAccountExecutionResult> {
  return await executeWithPasskeySmartAccount({
    smartAccountAddress: params.smartAccountAddress,
    actionLabel: "cancel_escrow",
    contractId: params.escrowContractId,
    method: "cancel_escrow",
    args: [addressScVal(params.smartAccountAddress), u64ScVal(params.escrowId)],
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
  });
}

export async function markDisputedWithPasskey(
  params: IPasskeyEscrowWrapperBase & { readonly escrowId: string },
): Promise<IPasskeySmartAccountExecutionResult> {
  return await executeWithPasskeySmartAccount({
    smartAccountAddress: params.smartAccountAddress,
    actionLabel: "mark_disputed",
    contractId: params.escrowContractId,
    method: "mark_disputed",
    args: [addressScVal(params.smartAccountAddress), u64ScVal(params.escrowId)],
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
  });
}
