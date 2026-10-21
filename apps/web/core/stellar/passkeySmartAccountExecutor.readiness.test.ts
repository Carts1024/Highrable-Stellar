import { Keypair, rpc, StrKey, contract as stellarContract } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  config: null as null | Record<string, unknown>,
  evaluateReadiness: vi.fn(),
  getSmartAccountKit: vi.fn(),
  connectFreshPasskeySmartAccount: vi.fn(),
}));

vi.mock("@/core/stellar/smart-account-config", () => ({
  getSmartAccountConfig: () => runtime.config,
  KNOWN_INCOMPATIBLE_SMART_ACCOUNT_WASM_HASHES: new Set(["f".repeat(64)]),
  SMART_ACCOUNT_KIT_TESTNET_DEFAULTS: { accountWasmHash: "e".repeat(64) },
  SMART_ACCOUNT_KIT_VERSION: "0.2.10",
}));
vi.mock("@/core/stellar/smart-account-kit", () => ({
  clearSmartAccountLocalSession: vi.fn(),
  connectFreshPasskeySmartAccount: runtime.connectFreshPasskeySmartAccount,
  getSmartAccountKit: runtime.getSmartAccountKit,
}));
vi.mock("@/core/stellar/mainnet-readiness", () => ({
  evaluateSmartAccountMainnetReadiness: runtime.evaluateReadiness,
}));
vi.mock("@/core/stellar/stablecoin-config", () => ({ stablecoinConfig: { decimals: 6 } }));

import {
  executeWithPasskeySmartAccount,
  getPasskeyEscrowExecutionReadiness,
} from "./passkeySmartAccountExecutor";

const contractId = StrKey.encodeContract(Buffer.alloc(32, 9));
const smartAccountAddress = StrKey.encodeContract(Buffer.alloc(32, 10));
const sourceAddress = Keypair.random().publicKey();
const wasmHashBytes = new Uint8Array(32).fill(0xab);
const wasmHash = Buffer.from(wasmHashBytes).toString("hex");

function mockLedgerEntry() {
  return {
    entries: [
      {
        val: {
          contractData: () => ({
            val: () => ({
              instance: () => ({ executable: () => ({ wasmHash: () => wasmHashBytes }) }),
            }),
          }),
        },
      },
    ],
  };
}

function createKit(isConnected = true) {
  return {
    isConnected,
    contractId: isConnected ? smartAccountAddress : undefined,
    credentialId: "credential-id",
    wallet: {},
    relayer: null,
    deployerPublicKey: sourceAddress,
    deployerKeypair: Keypair.random(),
    networkPassphrase: "Test SDF Network ; September 2015",
    timeoutInSeconds: 30,
    rpc: {
      getAccount: vi.fn(async () => ({})),
    },
  };
}

beforeEach(() => {
  runtime.config = {
    rpcUrl: "https://rpc.example.test",
    networkPassphrase: "Test SDF Network ; September 2015",
    accountWasmHash: wasmHash,
    webauthnVerifierAddress: contractId,
    rpId: "example.test",
    rpName: "Highrable",
    relayerUrl: null,
  };
  runtime.evaluateReadiness.mockReturnValue({
    isMainnet: false,
    network: "testnet",
    capabilities: { canExecuteMainnetPasskeyEscrow: true },
    blockingIssues: [],
    warnings: [],
  });
  runtime.getSmartAccountKit.mockReturnValue(createKit());
  runtime.connectFreshPasskeySmartAccount.mockImplementation(
    async ({ preferredContractId }: { preferredContractId: string }) => {
      const kit = runtime.getSmartAccountKit.mock.results[0]?.value as ReturnType<typeof createKit>;
      kit.isConnected = true;
      kit.contractId = preferredContractId;
      return { contractId: preferredContractId };
    },
  );
  vi.spyOn(rpc.Server.prototype, "getLedgerEntries").mockResolvedValue(mockLedgerEntry() as never);
  vi.spyOn(rpc.Server.prototype, "getAccount").mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("passkey escrow readiness", () => {
  it("reads and verifies the connected account WASM hash once per readiness evaluation", async () => {
    const readiness = await getPasskeyEscrowExecutionReadiness();

    expect(readiness).toMatchObject({ canExecute: true, feePath: "classic_source_account" });
    expect(rpc.Server.prototype.getLedgerEntries).toHaveBeenCalledOnce();
  });

  it("rejects an incompatible account without proceeding to the fee account read", async () => {
    runtime.config = { ...runtime.config, accountWasmHash: "c".repeat(64) };

    const readiness = await getPasskeyEscrowExecutionReadiness();

    expect(readiness.canExecute).toBe(false);
    expect(readiness.reason).toContain("not compatible");
    expect(rpc.Server.prototype.getLedgerEntries).toHaveBeenCalledOnce();
    expect(rpc.Server.prototype.getAccount).not.toHaveBeenCalled();
  });

  it("retains the relayer fee path while validating the account once", async () => {
    runtime.config = { ...runtime.config, relayerUrl: "https://relayer.example.test" };

    const readiness = await getPasskeyEscrowExecutionReadiness();

    expect(readiness).toMatchObject({ canExecute: true, feePath: "relayer", usesRelayer: true });
    expect(rpc.Server.prototype.getLedgerEntries).toHaveBeenCalledOnce();
    expect(rpc.Server.prototype.getAccount).not.toHaveBeenCalled();
  });

  it("reconnects before performing one fresh compatibility evaluation in the executor", async () => {
    const kit = createKit(false);
    runtime.getSmartAccountKit.mockReturnValue(kit);
    runtime.connectFreshPasskeySmartAccount.mockImplementationOnce(async () => {
      kit.isConnected = true;
      kit.contractId = smartAccountAddress;
      return { contractId: smartAccountAddress };
    });
    vi.spyOn(stellarContract.AssembledTransaction, "buildWithOp").mockRejectedValue(
      new Error("stop after executor readiness"),
    );

    const result = await executeWithPasskeySmartAccount({
      smartAccountAddress,
      actionLabel: "create_escrow",
      contractId,
      method: "create_escrow",
      args: [],
      rpcUrl: "https://rpc.example.test",
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    expect(runtime.connectFreshPasskeySmartAccount).toHaveBeenCalledOnce();
    expect(result.status).toBe("failed");
    expect(rpc.Server.prototype.getLedgerEntries).toHaveBeenCalledOnce();
  });
});
