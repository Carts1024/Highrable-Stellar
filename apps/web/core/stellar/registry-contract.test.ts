import { Keypair, rpc } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/stellar/smart-account-kit", () => ({
  getSmartAccountKit: vi.fn(),
}));

import { checkRegistryTransaction, normalizeUserRegistration } from "./registry-contract";

const walletAddress = Keypair.random().publicKey();

function missingTransactionResponse(params: {
  latestLedgerCloseTime: number;
  oldestLedgerCloseTime: number;
}): rpc.Api.GetMissingTransactionResponse {
  return {
    status: rpc.Api.GetTransactionStatus.NOT_FOUND,
    txHash: "0".repeat(64),
    latestLedger: 20,
    latestLedgerCloseTime: params.latestLedgerCloseTime,
    oldestLedger: 10,
    oldestLedgerCloseTime: params.oldestLedgerCloseTime,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registry contract reads and recovery", () => {
  it("normalizes a matching wallet registration", () => {
    expect(
      normalizeUserRegistration(
        { address: walletAddress, registered_at: 1_700_000_000n },
        walletAddress.toLowerCase(),
      ),
    ).toEqual({ address: walletAddress, registeredAt: 1_700_000_000 });
  });

  it("rejects records for another wallet and unsafe timestamps", () => {
    const otherWallet = Keypair.random().publicKey();

    expect(() =>
      normalizeUserRegistration(
        { address: otherWallet, registered_at: 1_700_000_000 },
        walletAddress,
      ),
    ).toThrow("different wallet");
    expect(() =>
      normalizeUserRegistration(
        { address: walletAddress, registered_at: Number.MAX_SAFE_INTEGER + 1 },
        walletAddress,
      ),
    ).toThrow("invalid registration timestamp");
  });

  it("allows retry only after the chain proves expiry within retained history", async () => {
    vi.spyOn(rpc.Server.prototype, "getTransaction").mockResolvedValue(
      missingTransactionResponse({
        latestLedgerCloseTime: 2_000,
        oldestLedgerCloseTime: 500,
      }),
    );

    await expect(
      checkRegistryTransaction({
        rpcUrl: "https://rpc.example.test",
        transactionHash: "a".repeat(64),
        validUntil: 1_000,
        createdAt: 900_000,
      }),
    ).resolves.toEqual({ status: "expired" });
  });

  it("keeps missing transactions pending when they are unexpired or outside RPC history", async () => {
    vi.spyOn(rpc.Server.prototype, "getTransaction")
      .mockResolvedValueOnce(
        missingTransactionResponse({
          latestLedgerCloseTime: 900,
          oldestLedgerCloseTime: 500,
        }),
      )
      .mockResolvedValueOnce(
        missingTransactionResponse({
          latestLedgerCloseTime: 2_000,
          oldestLedgerCloseTime: 1_500,
        }),
      );

    await expect(
      checkRegistryTransaction({
        rpcUrl: "https://rpc.example.test",
        transactionHash: "b".repeat(64),
        validUntil: 1_000,
        createdAt: 900_000,
      }),
    ).resolves.toEqual({ status: "pending" });
    await expect(
      checkRegistryTransaction({
        rpcUrl: "https://rpc.example.test",
        transactionHash: "c".repeat(64),
        validUntil: 1_000,
        createdAt: 900_000,
      }),
    ).resolves.toEqual({ status: "pending" });
  });

  it("rejects malformed transaction hashes rather than treating them as absent", async () => {
    const getTransaction = vi.spyOn(rpc.Server.prototype, "getTransaction");

    await expect(
      checkRegistryTransaction({
        rpcUrl: "https://rpc.example.test",
        transactionHash: "not-a-hash",
        validUntil: 1_000,
        createdAt: 900_000,
      }),
    ).rejects.toThrow("transaction hash is invalid");
    expect(getTransaction).not.toHaveBeenCalled();
  });
});
