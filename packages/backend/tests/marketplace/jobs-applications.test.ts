import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import { FIXED_TEST_TIME } from "../setup";

const ESCROW_ASSET = `C${"A".repeat(55)}`;
const CLIENT_WALLET = "GCLIENTMARKET";
const FREELANCER_WALLET = "GFREELANCERMARKET";
const OTHER_FREELANCER_WALLET = "GOTHERMARKET";
const DAY_MS = 24 * 60 * 60 * 1000;

type MarketplaceTest = ReturnType<typeof createTest>;

function createTest() {
  return convexTest(schema, modules);
}

async function seedOnboardedUsers(t: MarketplaceTest, wallets: string[]) {
  await t.run(async (ctx) => {
    for (const walletAddress of wallets) {
      await ctx.db.insert("users", {
        walletAddress,
        walletType: "external_wallet",
        onboardingCompletedAt: FIXED_TEST_TIME,
        createdAt: FIXED_TEST_TIME,
      });
    }
  });
}

function jobArgs(
  overrides: {
    title?: string;
    description?: string;
    clientWallet?: string;
    deadlineAt?: number;
  } = {},
) {
  return {
    title: overrides.title ?? "  Build a Soroban landing page  ",
    description: overrides.description ?? "Responsive marketing page for an escrow product.",
    budget: 250,
    asset: ESCROW_ASSET,
    clientWallet: overrides.clientWallet ?? CLIENT_WALLET,
    deadlineAt: overrides.deadlineAt ?? FIXED_TEST_TIME + 7 * DAY_MS,
    jobHash: "job-hash-marketplace",
  };
}

async function createOpenJob(t: MarketplaceTest): Promise<Id<"jobs">> {
  return await t.mutation(api.jobs.createJob, jobArgs());
}

async function countRows(t: MarketplaceTest) {
  return await t.run(async (ctx) => ({
    jobs: (await ctx.db.query("jobs").collect()).length,
    applications: (await ctx.db.query("applications").collect()).length,
    deadlineAuditEvents: (await ctx.db.query("deadlineAuditEvents").collect()).length,
    users: (await ctx.db.query("users").collect()).length,
  }));
}

describe("marketplace job posting", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID", ESCROW_ASSET);
  });

  it("creates an open micro-gig with sanitized fields and an initial deadline audit event", async () => {
    const t = createTest();
    await seedOnboardedUsers(t, [CLIENT_WALLET]);

    const jobId = await t.mutation(
      api.jobs.createJob,
      jobArgs({ clientWallet: CLIENT_WALLET.toLowerCase() }),
    );

    const { job, auditEvents } = await t.run(async (ctx) => ({
      job: await ctx.db.get(jobId),
      auditEvents: await ctx.db.query("deadlineAuditEvents").collect(),
    }));
    expect(job).toMatchObject({
      title: "Build a Soroban landing page",
      clientWallet: CLIENT_WALLET,
      jobType: "micro_gig",
      status: "open",
      totalBudget: 250,
      milestoneCount: 0,
      revisionPolicy: "fixed",
      revisionLimit: 2,
      revisionCount: 0,
      createdAt: FIXED_TEST_TIME,
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      parentType: "micro_gig",
      parentId: jobId,
      reason: "initial_deadline",
      changedByWallet: CLIENT_WALLET,
    });
  });

  it("rejects job posts that ask for seed phrases without writing any rows", async () => {
    const t = createTest();
    await seedOnboardedUsers(t, [CLIENT_WALLET]);
    const before = await countRows(t);

    await expect(
      t.mutation(
        api.jobs.createJob,
        jobArgs({ description: "Send me your seed phrase to unlock the bonus." }),
      ),
    ).rejects.toThrow("seed phrases");

    expect(await countRows(t)).toEqual(before);
  });

  it("rejects clients who have not completed onboarding and rolls back the identity insert", async () => {
    const t = createTest();

    await expect(t.mutation(api.jobs.createJob, jobArgs())).rejects.toThrow(
      "Complete onboarding before using this action.",
    );

    expect(await countRows(t)).toEqual({
      jobs: 0,
      applications: 0,
      deadlineAuditEvents: 0,
      users: 0,
    });
  });

  it("rejects deadlines less than 30 minutes ahead", async () => {
    const t = createTest();
    await seedOnboardedUsers(t, [CLIENT_WALLET]);

    await expect(
      t.mutation(api.jobs.createJob, jobArgs({ deadlineAt: FIXED_TEST_TIME + 10 * 60 * 1000 })),
    ).rejects.toThrow("at least 30 minutes in the future");
    expect((await countRows(t)).jobs).toBe(0);
  });
});

describe("marketplace applications and selection", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID", ESCROW_ASSET);
  });

  it("records a freelancer application and exposes it through the applied-job queries", async () => {
    const t = createTest();
    await seedOnboardedUsers(t, [CLIENT_WALLET, FREELANCER_WALLET]);
    const jobId = await createOpenJob(t);

    const applicationId = await t.mutation(api.applications.applyToJob, {
      jobId,
      freelancerWallet: FREELANCER_WALLET.toLowerCase(),
      proposal: "  I have shipped three Stellar dApps.  ",
    });

    const application = await t.run((ctx) => ctx.db.get(applicationId));
    expect(application).toMatchObject({
      jobId,
      freelancerWallet: FREELANCER_WALLET,
      proposal: "I have shipped three Stellar dApps.",
      createdAt: FIXED_TEST_TIME,
    });
    expect(
      await t.query(api.applications.hasAppliedToJob, {
        jobId,
        freelancerWallet: FREELANCER_WALLET,
      }),
    ).toBe(true);
    expect(
      await t.query(api.applications.listAppliedJobIdsByFreelancer, {
        freelancerWallet: FREELANCER_WALLET,
      }),
    ).toEqual([jobId]);
    expect(await t.query(api.applications.listApplicationsByJob, { jobId })).toHaveLength(1);
  });

  it("rejects a duplicate application from the same wallet regardless of casing", async () => {
    const t = createTest();
    await seedOnboardedUsers(t, [CLIENT_WALLET, FREELANCER_WALLET]);
    const jobId = await createOpenJob(t);
    await t.mutation(api.applications.applyToJob, {
      jobId,
      freelancerWallet: FREELANCER_WALLET,
      proposal: "First proposal",
    });

    await expect(
      t.mutation(api.applications.applyToJob, {
        jobId,
        freelancerWallet: FREELANCER_WALLET.toLowerCase(),
        proposal: "Second proposal",
      }),
    ).rejects.toThrow("Freelancer already applied to this job.");
    expect((await countRows(t)).applications).toBe(1);
  });

  it("prevents the client from applying to their own job", async () => {
    const t = createTest();
    await seedOnboardedUsers(t, [CLIENT_WALLET]);
    const jobId = await createOpenJob(t);

    await expect(
      t.mutation(api.applications.applyToJob, {
        jobId,
        freelancerWallet: CLIENT_WALLET,
        proposal: "Self-dealing proposal",
      }),
    ).rejects.toThrow("Client cannot apply to their own job.");
    expect(
      await t.query(api.applications.hasAppliedToJob, {
        jobId,
        freelancerWallet: CLIENT_WALLET,
      }),
    ).toBe(false);
  });

  it("only lets the job client select a freelancer and closes applications afterwards", async () => {
    const t = createTest();
    await seedOnboardedUsers(t, [CLIENT_WALLET, FREELANCER_WALLET, OTHER_FREELANCER_WALLET]);
    const jobId = await createOpenJob(t);

    await expect(
      t.mutation(api.jobs.selectFreelancer, {
        jobId,
        clientWallet: OTHER_FREELANCER_WALLET,
        freelancerWallet: FREELANCER_WALLET,
      }),
    ).rejects.toThrow("Only the job client can select a freelancer.");

    const selected = await t.mutation(api.jobs.selectFreelancer, {
      jobId,
      clientWallet: CLIENT_WALLET,
      freelancerWallet: FREELANCER_WALLET.toLowerCase(),
    });
    expect(selected).toMatchObject({
      status: "selected",
      selectedFreelancerWallet: FREELANCER_WALLET,
    });

    await expect(
      t.mutation(api.applications.applyToJob, {
        jobId,
        freelancerWallet: OTHER_FREELANCER_WALLET,
        proposal: "Late proposal",
      }),
    ).rejects.toThrow("Applications are only allowed for open jobs.");
  });
});
