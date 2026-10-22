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

  it("validates a default-rule passkey signer on-chain without requesting indexer details", async () => {
    const credentialId = "010203";
    const keyData = new Uint8Array(68);
    keyData.set([1, 2, 3], 65);
    const getContractDetailsFromIndexer = vi.fn(async () => {
      throw new Error("The indexer must not be called for a default-rule passkey.");
    });
    const kit = {
      wallet: {
        get_context_rule: vi.fn(async () => ({
          result: {
            signers: [
              {
                tag: "External",
                values: ["C" + "A".repeat(55), keyData],
              },
            ],
          },
        })),
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
    expect(getContractDetailsFromIndexer).not.toHaveBeenCalled();
  });
});
