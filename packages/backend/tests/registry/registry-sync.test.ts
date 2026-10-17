import { Account, nativeToScVal, rpc, StrKey } from "@stellar/stellar-sdk";
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";

const walletAddress = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 11));
const otherWalletAddress = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 12));
const readSourceAddress = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 13));
const registryContractId = StrKey.encodeContract(Buffer.alloc(32, 14));
const rpcUrl = "https://rpc.example.test";

function rpcResult(value: unknown) {
  return { result: { retval: nativeToScVal(value) } } as never;
}

function registration(address = walletAddress) {
  return { address, registered_at: 1_700_000_000n };
}

beforeEach(() => {
  vi.spyOn(rpc.Server.prototype, "getAccount").mockResolvedValue(
    new Account(readSourceAddress, "1"),
  );
  vi.spyOn(rpc.Server.prototype, "sendTransaction").mockRejectedValue(
    new Error("Registry reads must not submit transactions."),
  );
  vi.stubEnv("STELLAR_NETWORK", "testnet");
  vi.stubEnv("STELLAR_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015");
  vi.stubEnv("STELLAR_RPC_URL", rpcUrl);
  vi.stubEnv("STELLAR_READ_SOURCE_ACCOUNT", readSourceAddress);
  vi.stubEnv("REGISTRY_CONTRACT_ID", registryContractId);
});

describe("syncUserRegistration", () => {
  it("mirrors a matching registration only after both RPC reads agree", async () => {
    const t = convexTest(schema, modules);
    const simulate = vi.spyOn(rpc.Server.prototype, "simulateTransaction");
    simulate
      .mockResolvedValueOnce(rpcResult(registration()))
      .mockResolvedValueOnce(rpcResult(true));

    await expect(
      t.action(api.sync.syncUserRegistration, {
        walletAddress,
        expectedNetwork: "testnet",
        expectedRegistryContractId: registryContractId,
      }),
    ).resolves.toMatchObject({
      ok: true,
      isRegistered: true,
      network: "testnet",
      registryContractId,
      registeredAt: 1_700_000_000,
    });

    const rows = await t.run((ctx) => ctx.db.query("registryRegistrations").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      walletAddress,
      network: "testnet",
      registryContractId,
      registeredAt: 1_700_000_000,
    });
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects a registry record whose address does not match the requested wallet", async () => {
    const t = convexTest(schema, modules);
    vi.spyOn(rpc.Server.prototype, "simulateTransaction")
      .mockResolvedValueOnce(rpcResult(registration(otherWalletAddress)))
      .mockResolvedValueOnce(rpcResult(true));

    await expect(
      t.action(api.sync.syncUserRegistration, {
        walletAddress,
        expectedNetwork: "testnet",
        expectedRegistryContractId: registryContractId,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "registry_read_failed" });
    await expect(t.run((ctx) => ctx.db.query("registryRegistrations").collect())).resolves.toEqual(
      [],
    );
  });

  it("rejects disagreement between the record and membership read", async () => {
    const t = convexTest(schema, modules);
    vi.spyOn(rpc.Server.prototype, "simulateTransaction")
      .mockResolvedValueOnce(rpcResult(null))
      .mockResolvedValueOnce(rpcResult(true));

    await expect(
      t.action(api.sync.syncUserRegistration, {
        walletAddress,
        expectedNetwork: "testnet",
        expectedRegistryContractId: registryContractId,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "registry_record_mismatch" });
    await expect(t.run((ctx) => ctx.db.query("registryRegistrations").collect())).resolves.toEqual(
      [],
    );
  });

  it("rejects mismatched browser scope before making RPC calls", async () => {
    const t = convexTest(schema, modules);
    const simulate = vi.spyOn(rpc.Server.prototype, "simulateTransaction");

    await expect(
      t.action(api.sync.syncUserRegistration, {
        walletAddress,
        expectedNetwork: "mainnet",
        expectedRegistryContractId: registryContractId,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "registry_scope_mismatch" });
    expect(simulate).not.toHaveBeenCalled();
  });

  it("reports missing registry configuration without writing a mirror", async () => {
    const t = convexTest(schema, modules);
    delete process.env.REGISTRY_CONTRACT_ID;

    await expect(
      t.action(api.sync.syncUserRegistration, {
        walletAddress,
        expectedNetwork: "testnet",
        expectedRegistryContractId: registryContractId,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "missing_or_invalid_config" });
    await expect(t.run((ctx) => ctx.db.query("registryRegistrations").collect())).resolves.toEqual(
      [],
    );
  });
});
