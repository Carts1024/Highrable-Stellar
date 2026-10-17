import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { beforeEach, describe, expect, it } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import schema from "../../convex/schema";
import { modules } from "../convexModules";

type TApplyVerifiedRegistrationArgs = {
  network: string;
  registryContractId: string;
  walletAddress: string;
  registeredAt: number;
  verifiedAt: number;
};

const CONTRACT_ID = `C${"A".repeat(55)}`;
const WALLET_ADDRESS = `G${"B".repeat(55)}`;
const applyVerifiedRegistrationRef = makeFunctionReference<
  "mutation",
  TApplyVerifiedRegistrationArgs,
  Id<"registryRegistrations">
>("registry/mutations:applyVerifiedRegistration");

describe("verified registry mirror", () => {
  beforeEach(() => {
    process.env.STELLAR_NETWORK = "testnet";
    process.env.REGISTRY_CONTRACT_ID = CONTRACT_ID;
  });

  it("upserts a verified registration idempotently within its configured scope", async () => {
    const t = convexTest(schema, modules);
    const args: TApplyVerifiedRegistrationArgs = {
      network: "testnet",
      registryContractId: CONTRACT_ID,
      walletAddress: WALLET_ADDRESS,
      registeredAt: 1_700_000_000,
      verifiedAt: 1_700_000_100,
    };

    await t.mutation(applyVerifiedRegistrationRef, args);
    await t.mutation(applyVerifiedRegistrationRef, {
      ...args,
      verifiedAt: 1_700_000_200,
    });

    const rows = await t.run((ctx) => ctx.db.query("registryRegistrations").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...args, verifiedAt: 1_700_000_200 });
  });

  it("rejects registrations from another network or contract", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(applyVerifiedRegistrationRef, {
        network: "mainnet",
        registryContractId: CONTRACT_ID,
        walletAddress: WALLET_ADDRESS,
        registeredAt: 1_700_000_000,
        verifiedAt: 1_700_000_100,
      }),
    ).rejects.toThrow("outside the configured registry scope");
  });
});
