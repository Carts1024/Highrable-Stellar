import { IndexerError } from "smart-account-kit";
import { describe, expect, it, vi } from "vitest";

vi.mock("smart-account-kit", () => ({
  IndexedDBStorage: class {},
  IndexerError: class IndexerError extends Error {
    public constructor(
      message: string,
      public readonly status: number,
    ) {
      super(message);
    }
  },
  LocalStorageAdapter: class {},
  SmartAccountKit: class {},
  getCredentialIdFromSigner: (signer: { values: readonly [string, Uint8Array] }) =>
    Buffer.from(signer.values[1]).subarray(65).toString("base64url"),
}));

vi.mock("@/core/stellar/smart-account-config", () => ({
  assertPasskeyFeatureEnabled: vi.fn(),
  getSmartAccountConfigOrThrow: () => ({
    accountWasmHash: "a".repeat(64),
    networkPassphrase: "Test SDF Network ; September 2015",
    relayerUrl: null,
    rpId: "example.test",
    rpName: "Highrable",
    rpcUrl: "https://rpc.example.test",
    webauthnVerifierAddress: "C" + "A".repeat(55),
  }),
  PasskeyConfigError: class PasskeyConfigError extends Error {},
}));

vi.mock("@/core/stellar/smart-account-context-rules", () => ({
  readDefaultContextRule: vi.fn(),
}));

import { readDefaultContextRule } from "@/core/stellar/smart-account-context-rules";

import {
  discoverPasskeyContractsWithFallback,
  ensureConnectedPasskeyWalletShape,
} from "./smart-account-kit";

describe("smart-account-kit passkey discovery", () => {
  it("allows RPC-based account connection when indexer discovery fails", async () => {
    const kit = {
      discoverContractsByCredential: vi.fn(async () => {
        throw new IndexerError("Indexer request failed: 500", 500);
      }),
    } as never;

    await expect(discoverPasskeyContractsWithFallback(kit, "010203")).resolves.toBeNull();
  });

  it("validates a default-rule passkey signer from direct RPC data without requesting indexer details", async () => {
    const credentialId = "010203";
    const keyData = Buffer.alloc(68);
    keyData.set([1, 2, 3], 65);
    const getContractDetailsFromIndexer = vi.fn(async () => {
      throw new Error("The indexer must not be called for a default-rule passkey.");
    });
    const getContextRules = vi.fn(async () => {
      throw new Error("The unsupported get_context_rules entrypoint must not be called.");
    });
    vi.mocked(readDefaultContextRule).mockResolvedValue({
      context_type: { tag: "Default", values: undefined },
      id: 0,
      name: "Default",
      policies: [],
      signers: [
        {
          tag: "External",
          values: ["C" + "A".repeat(55), keyData],
        },
      ],
      valid_until: undefined,
    });
    const kit = {
      deployerPublicKey: "G" + "A".repeat(55),
      wallet: {
        get_context_rules: getContextRules,
      },
      getContractDetailsFromIndexer,
    } as never;

    await expect(
      ensureConnectedPasskeyWalletShape({
        kit,
        contractId: "C" + "B".repeat(55),
        credentialId,
      }),
    ).resolves.toBeUndefined();
    expect(readDefaultContextRule).toHaveBeenCalledWith({
      rpcUrl: "https://rpc.example.test",
      networkPassphrase: "Test SDF Network ; September 2015",
      contractId: "C" + "B".repeat(55),
      sourceAccount: "G" + "A".repeat(55),
    });
    expect(getContextRules).not.toHaveBeenCalled();
    expect(getContractDetailsFromIndexer).not.toHaveBeenCalled();
  });
});
