import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { beforeEach, describe, expect, it } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import schema from "../../convex/schema";
import { modules } from "../convexModules";

type TProfileDraftArgs = {
  walletAddress: string;
  firstName: string;
  lastName: string;
  publicHandle: string;
  coreSkills: string[];
};

type TCompleteOnboardingArgs = { walletAddress: string };

type TApplyVerifiedRegistrationArgs = {
  network: string;
  registryContractId: string;
  walletAddress: string;
  registeredAt: number;
  verifiedAt: number;
};

const CONTRACT_ID = `C${"A".repeat(55)}`;
const FIRST_WALLET = `G${"B".repeat(55)}`;
const SECOND_WALLET = `G${"C".repeat(55)}`;
const saveProfileDraftRef = makeFunctionReference<"mutation", TProfileDraftArgs, Id<"users">>(
  "users/mutations:saveProfileDraft",
);
const completeOnboardingRef = makeFunctionReference<
  "mutation",
  TCompleteOnboardingArgs,
  Id<"users">
>("users/mutations:completeOnboarding");
const applyVerifiedRegistrationRef = makeFunctionReference<
  "mutation",
  TApplyVerifiedRegistrationArgs,
  Id<"registryRegistrations">
>("registry/mutations:applyVerifiedRegistration");

function profileDraft(walletAddress: string, publicHandle: string): TProfileDraftArgs {
  return {
    walletAddress,
    firstName: "  Ada  ",
    lastName: "Lovelace",
    publicHandle,
    coreSkills: ["Smart contracts", " smart   contracts ", "TypeScript"],
  };
}

describe("registry gated onboarding", () => {
  beforeEach(() => {
    process.env.STELLAR_NETWORK = "testnet";
    process.env.REGISTRY_CONTRACT_ID = CONTRACT_ID;
  });

  it("saves a sanitized profile draft without completing onboarding", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.mutation(saveProfileDraftRef, profileDraft(FIRST_WALLET, "AdaDev"));
    const user = await t.run((ctx) => ctx.db.get(userId));

    expect(user).toMatchObject({
      walletAddress: FIRST_WALLET,
      firstName: "Ada",
      lastName: "Lovelace",
      publicHandle: "adadev",
      normalizedPublicHandle: "adadev",
      skills: ["smart contracts", "TypeScript"],
      coreSkills: ["smart contracts", "TypeScript"],
    });
    expect(user?.onboardingCompletedAt).toBeUndefined();
  });

  it("rejects invalid drafts and duplicate public handles", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(saveProfileDraftRef, {
        ...profileDraft(FIRST_WALLET, "first-user"),
        coreSkills: [],
      }),
    ).rejects.toThrow("Add at least one core skill");

    await t.mutation(saveProfileDraftRef, profileDraft(FIRST_WALLET, "same-handle"));
    await expect(
      t.mutation(saveProfileDraftRef, profileDraft(SECOND_WALLET, "SAME-HANDLE")),
    ).rejects.toThrow("Public handle is already taken");
  });

  it("requires a verified registration before completing a new profile", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(saveProfileDraftRef, profileDraft(FIRST_WALLET, "new-user"));

    await expect(
      t.mutation(completeOnboardingRef, { walletAddress: FIRST_WALLET }),
    ).rejects.toThrow("Verify your on-chain wallet registration");
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_walletAddress", (q) => q.eq("walletAddress", FIRST_WALLET))
        .unique(),
    );
    expect(user?.onboardingCompletedAt).toBeUndefined();

    await t.mutation(applyVerifiedRegistrationRef, {
      network: "testnet",
      registryContractId: CONTRACT_ID,
      walletAddress: FIRST_WALLET,
      registeredAt: 1_700_000_000,
      verifiedAt: 1_700_000_100,
    });
    const userId = await t.mutation(completeOnboardingRef, { walletAddress: FIRST_WALLET });
    const completedUser = await t.run((ctx) => ctx.db.get(userId));
    expect(completedUser?.onboardingCompletedAt).toBeTypeOf("number");
  });

  it("preserves existing onboarding completion when registry configuration is absent", async () => {
    const t = convexTest(schema, modules);
    const completedAt = 1_700_000_000;
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        walletAddress: FIRST_WALLET,
        firstName: "Ada",
        lastName: "Lovelace",
        publicHandle: "legacy-user",
        normalizedPublicHandle: "legacy-user",
        coreSkills: ["Stellar"],
        skills: ["Stellar"],
        onboardingCompletedAt: completedAt,
        createdAt: completedAt,
      }),
    );
    delete process.env.STELLAR_NETWORK;
    delete process.env.REGISTRY_CONTRACT_ID;

    await expect(t.mutation(completeOnboardingRef, { walletAddress: FIRST_WALLET })).resolves.toBe(
      userId,
    );
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.onboardingCompletedAt).toBe(completedAt);
  });
});
