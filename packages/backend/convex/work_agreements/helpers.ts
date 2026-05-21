import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TWalletType } from "../users/schema";
import type { TAgreementEventType, TAgreementStatus, TAgreementType } from "./schema";

import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";
import { isPreviewSupported } from "../attachments/helpers";

const EDITABLE_STATUSES = new Set<TAgreementStatus>(["draft", "pending_preview"]);
const AGREEMENT_FILE_TYPES = new Set(["pdf", "document", "markdown", "file"]);
const DEFAULT_STABLECOIN_SYMBOL = "USDC";
const DEFAULT_STABLECOIN_DECIMALS = 7;
const NATIVE_XLM_DECIMALS = 7;
const REQUIRED_DISCLAIMER =
  "This Highrable-generated agreement is provided as a workflow template and is not legal advice. For high-value, regulated, or jurisdiction-specific work, both parties should consult a qualified professional.";

export interface IAgreementParticipant {
  wallet: string;
  walletType?: TWalletType;
  displayName?: string;
}

export interface IAgreementMilestoneSnapshot {
  milestoneId: string;
  order: number;
  title: string;
  description?: string;
  requiredOutput?: string;
  amount: number;
  asset: string;
  deadlineAt?: number;
  revisionPolicy?: string;
  revisionLimit?: number | null;
  revisionCount?: number;
  assignedFreelancerWallet?: string;
  escrowId?: string;
}

export interface IAgreementSnapshot {
  jobId: string;
  jobTitle: string;
  jobDescription: string;
  jobType: "micro_gig" | "milestone_project";
  client: IAgreementParticipant;
  freelancer?: IAgreementParticipant;
  paymentAmount: number;
  paymentAssetContractId: string;
  paymentAssetSymbol: string;
  paymentAssetDecimals: number;
  paymentWarning?: string;
  deadlineAt?: number;
  milestones: IAgreementMilestoneSnapshot[];
  revisionPolicy?: string;
  revisionLimit?: number | null;
  revisionCount?: number;
  disputePolicySummary: string;
  cancellationPolicySummary: string;
  contentProtectionRuleSummary: string;
  contentProtectionEnabled: boolean;
  generatedAt: number;
  generatedByWallet: string;
  generatedByWalletType: TWalletType;
  version: number;
}

type TAgreementSource = {
  job: Doc<"jobs">;
  escrow?: Doc<"escrows"> | null;
  milestones: Doc<"milestones">[];
};

function isSameWallet(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  return normalizeWalletAddress(left) === normalizeWalletAddress(right);
}

function sanitizeTitle(value: string): string {
  const title = requireNonEmptyString(value, "title").replace(/\s+/g, " ").slice(0, 160);
  if (title.length < 3) {
    throw new BadRequestError("Agreement title is too short.");
  }
  return title;
}

function getStablecoinDecimals(): number {
  const rawValue = Number(process.env.NEXT_PUBLIC_STABLECOIN_DECIMALS);
  if (!Number.isInteger(rawValue) || rawValue < 0 || rawValue > 18) return DEFAULT_STABLECOIN_DECIMALS;
  return rawValue;
}

function resolvePaymentAsset(assetContractId: string): {
  symbol: string;
  decimals: number;
  warning?: string;
} {
  const stablecoinContractId = process.env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID?.trim();
  const nativeXlmTokenContractId = process.env.NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID?.trim();

  if (stablecoinContractId && stablecoinContractId === assetContractId) {
    return {
      symbol: process.env.NEXT_PUBLIC_STABLECOIN_SYMBOL?.trim() || DEFAULT_STABLECOIN_SYMBOL,
      decimals: getStablecoinDecimals(),
    };
  }

  if (nativeXlmTokenContractId && nativeXlmTokenContractId === assetContractId) {
    return { symbol: "XLM", decimals: NATIVE_XLM_DECIMALS };
  }

  return {
    symbol: process.env.NEXT_PUBLIC_STABLECOIN_SYMBOL?.trim() || DEFAULT_STABLECOIN_SYMBOL,
    decimals: getStablecoinDecimals(),
    warning:
      "Payment asset configuration could not be fully matched. Verify the escrow token contract before relying on these payment terms.",
  };
}

function formatWalletType(walletType?: string): string {
  if (!walletType) return "Pending";
  return walletType.replace(/_/g, " ");
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return "Not specified";
  return new Date(timestamp).toISOString();
}

function normalizeMarkdownText(value: string | undefined, fallback: string): string {
  const text = value?.trim();
  if (!text) return fallback;
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function formatAmount(amount: number, symbol: string): string {
  if (!Number.isFinite(amount) || amount <= 0) return `Missing ${symbol} amount`;
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 7 })} ${symbol}`;
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function normalizeAgreementStatus(status: TAgreementStatus): TAgreementStatus {
  return status;
}

export function createAgreementNumber(now = Date.now()): string {
  return `HWA-${new Date(now).toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

export async function getAgreementOrThrow(ctx: QueryCtx, agreementId: Id<"workAgreements">) {
  const agreement = await ctx.db.get(agreementId);
  if (!agreement) {
    throw new NotFoundError("Work agreement not found.");
  }
  return agreement;
}

export async function getActiveAgreementByJob(ctx: QueryCtx, jobId: Id<"jobs">) {
  const agreements = await ctx.db
    .query("workAgreements")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .collect();

  return (
    agreements
      .filter((agreement) => agreement.status !== "cancelled")
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
  );
}

export async function assertCanCreateWorkAgreement(
  ctx: QueryCtx,
  input: { jobId: Id<"jobs">; walletAddress: string },
) {
  const walletAddress = normalizeWalletAddress(input.walletAddress);
  const job = await ctx.db.get(input.jobId);
  if (!job) {
    throw new NotFoundError("Job not found.");
  }
  if (!isSameWallet(job.clientWallet, walletAddress)) {
    throw new ForbiddenError("Only the client can create a work agreement for this job.");
  }

  const existing = await getActiveAgreementByJob(ctx, input.jobId);
  if (existing) {
    throw new ConflictError("A work agreement already exists for this job.");
  }

  return { job, walletAddress };
}

export async function assertCanViewWorkAgreement(
  ctx: QueryCtx,
  agreement: Doc<"workAgreements">,
  viewerWallet?: string,
) {
  if (!viewerWallet) {
    throw new NotFoundError("Work agreement not found.");
  }
  const normalizedViewerWallet = normalizeWalletAddress(viewerWallet);
  if (
    isSameWallet(agreement.clientWallet, normalizedViewerWallet) ||
    isSameWallet(agreement.freelancerWallet, normalizedViewerWallet)
  ) {
    return normalizedViewerWallet;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", normalizedViewerWallet))
    .first();
  if (user?.role === "admin") {
    return normalizedViewerWallet;
  }

  throw new NotFoundError("Work agreement not found.");
}

export async function assertCanEditWorkAgreement(
  ctx: QueryCtx,
  input: { agreementId: Id<"workAgreements">; walletAddress: string },
) {
  const agreement = await getAgreementOrThrow(ctx, input.agreementId);
  const walletAddress = normalizeWalletAddress(input.walletAddress);
  if (!isSameWallet(agreement.clientWallet, walletAddress)) {
    throw new ForbiddenError("Only the client can edit this work agreement.");
  }
  if (!EDITABLE_STATUSES.has(agreement.status)) {
    throw new BadRequestError("This agreement draft can no longer be modified.");
  }
  return { agreement, walletAddress };
}

export async function resolveAgreementParticipants(
  ctx: QueryCtx,
  input: {
    job: Doc<"jobs">;
    clientWalletType: TWalletType;
    freelancerWalletType?: TWalletType;
  },
) {
  const clientWallet = normalizeWalletAddress(input.job.clientWallet);
  const freelancerWallet = input.job.selectedFreelancerWallet
    ? normalizeWalletAddress(input.job.selectedFreelancerWallet)
    : undefined;

  const users = await Promise.all([
    ctx.db
      .query("users")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", clientWallet))
      .first(),
    freelancerWallet
      ? ctx.db
          .query("users")
          .withIndex("by_walletAddress", (q) => q.eq("walletAddress", freelancerWallet))
          .first()
      : Promise.resolve(null),
  ]);

  const clientUser = users[0];
  const freelancerUser = users[1];

  return {
    client: {
      wallet: clientWallet,
      walletType: input.clientWalletType,
      displayName: clientUser?.companyName ?? clientUser?.name,
    },
    freelancer: freelancerWallet
      ? {
          wallet: freelancerWallet,
          walletType: input.freelancerWalletType ?? freelancerUser?.walletType,
          displayName: freelancerUser?.name ?? freelancerUser?.companyName,
        }
      : undefined,
  };
}

export async function resolveAgreementSource(
  ctx: QueryCtx,
  jobId: Id<"jobs">,
): Promise<TAgreementSource> {
  const job = await ctx.db.get(jobId);
  if (!job) {
    throw new NotFoundError("Job not found.");
  }

  const [escrow, milestones] = await Promise.all([
    ctx.db
      .query("escrows")
      .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
      .first(),
    ctx.db
      .query("milestones")
      .withIndex("by_jobId_order", (q) => q.eq("jobId", jobId))
      .order("asc")
      .take(500),
  ]);

  return { job, escrow, milestones };
}

export async function buildAgreementSnapshot(
  ctx: QueryCtx,
  input: {
    jobId: Id<"jobs">;
    generatedByWallet: string;
    generatedByWalletType: TWalletType;
    clientWalletType: TWalletType;
    freelancerWalletType?: TWalletType;
    version: number;
  },
): Promise<IAgreementSnapshot> {
  const { job, escrow, milestones } = await resolveAgreementSource(ctx, input.jobId);
  const jobType = job.jobType ?? "micro_gig";
  const paymentAssetContractId = escrow?.asset ?? job.asset;
  const paymentAmount = jobType === "milestone_project" ? (job.totalBudget ?? job.budget) : (escrow?.amount ?? job.budget);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new BadRequestError("Payment details are missing, so the agreement cannot be generated yet.");
  }
  const asset = resolvePaymentAsset(paymentAssetContractId);
  const participants = await resolveAgreementParticipants(ctx, {
    job,
    clientWalletType: input.clientWalletType,
    freelancerWalletType: input.freelancerWalletType,
  });

  if (jobType === "milestone_project" && milestones.length === 0) {
    throw new BadRequestError("Milestone details are incomplete.");
  }

  return {
    jobId: input.jobId,
    jobTitle: job.title,
    jobDescription: job.description,
    jobType,
    client: participants.client,
    freelancer: participants.freelancer,
    paymentAmount,
    paymentAssetContractId,
    paymentAssetSymbol: asset.symbol,
    paymentAssetDecimals: asset.decimals,
    ...(asset.warning ? { paymentWarning: asset.warning } : {}),
    ...(job.deadlineAt ? { deadlineAt: job.deadlineAt } : {}),
    milestones: milestones.map((milestone) => ({
      milestoneId: milestone._id,
      order: milestone.order,
      title: milestone.title,
      ...(milestone.description ? { description: milestone.description } : {}),
      ...(milestone.requiredOutput ? { requiredOutput: milestone.requiredOutput } : {}),
      amount: milestone.amount,
      asset: milestone.asset,
      ...(milestone.deadlineAt ? { deadlineAt: milestone.deadlineAt } : {}),
      ...(milestone.revisionPolicy ? { revisionPolicy: milestone.revisionPolicy } : {}),
      ...(milestone.revisionLimit !== undefined ? { revisionLimit: milestone.revisionLimit } : {}),
      ...(milestone.revisionCount !== undefined ? { revisionCount: milestone.revisionCount } : {}),
      ...(milestone.assignedFreelancerWallet
        ? { assignedFreelancerWallet: milestone.assignedFreelancerWallet }
        : {}),
      ...(milestone.escrowId ? { escrowId: milestone.escrowId } : {}),
    })),
    ...(job.revisionPolicy ? { revisionPolicy: job.revisionPolicy } : {}),
    ...(job.revisionLimit !== undefined ? { revisionLimit: job.revisionLimit } : {}),
    ...(job.revisionCount !== undefined ? { revisionCount: job.revisionCount } : {}),
    disputePolicySummary:
      "Disputes are handled through Highrable's platform-reviewed dispute workflow using available work evidence.",
    cancellationPolicySummary:
      "Cancellation depends on commitment, escrow funding, work state, overdue state, freelancer agreement, or dispute outcome.",
    contentProtectionRuleSummary:
      "Freelancer deliverables may use protected, watermarked, access-logged previews before payment release.",
    contentProtectionEnabled: true,
    generatedAt: Date.now(),
    generatedByWallet: normalizeWalletAddress(input.generatedByWallet),
    generatedByWalletType: input.generatedByWalletType,
    version: input.version,
  };
}

export function formatAgreementPaymentTerms(snapshot: IAgreementSnapshot): string {
  const terms = [
    `Total price: ${formatAmount(snapshot.paymentAmount, snapshot.paymentAssetSymbol)}.`,
    `Escrow payment asset: ${snapshot.paymentAssetSymbol}.`,
    `Payment asset contract ID: ${snapshot.paymentAssetContractId}.`,
    "Native XLM is used for Stellar network fees only unless the configured escrow asset is explicitly XLM.",
    "Escrow should be funded through Highrable before payment release is expected.",
    "Payment release should follow the Highrable escrow release workflow after acceptable proof of work is submitted.",
  ];
  if (snapshot.paymentWarning) {
    terms.unshift(`Payment asset warning: ${snapshot.paymentWarning}`);
  }
  return bulletList(terms);
}

export function formatAgreementDeadlineTerms(snapshot: IAgreementSnapshot): string {
  if (snapshot.jobType === "milestone_project") {
    return "Milestone timelines are listed in the milestone breakdown. Highrable may surface reminder and overdue states based on those dates.";
  }
  return `Micro gig deadline: ${formatTimestamp(snapshot.deadlineAt)}. Highrable may surface reminder and overdue states based on this date.`;
}

export function formatAgreementRevisionTerms(snapshot: IAgreementSnapshot): string {
  const policy = snapshot.revisionPolicy ?? "Not specified";
  const limit =
    snapshot.revisionLimit === null || snapshot.revisionLimit === undefined
      ? "Not specified"
      : String(snapshot.revisionLimit);
  return bulletList([
    `Revision policy: ${policy}.`,
    `Revision limit: ${limit}.`,
    `Current revision count: ${snapshot.revisionCount ?? 0}.`,
    "Revision requests and responses are handled through Highrable.",
  ]);
}

export function formatAgreementDisputeTerms(snapshot: IAgreementSnapshot): string {
  return bulletList([
    snapshot.disputePolicySummary,
    "Evidence may include proof submissions, revisions, deadlines, chat messages, and attachments.",
    "This agreement does not claim decentralized arbitration.",
  ]);
}

export function formatAgreementCancellationTerms(snapshot: IAgreementSnapshot): string {
  return bulletList([
    snapshot.cancellationPolicySummary,
    "Client cancellation may be unrestricted before commitment or funding where Highrable allows it.",
    "After work starts or escrow is funded, cancellation may require freelancer agreement, overdue state, or dispute outcome.",
    "Proof-submitted work should go through revision or dispute instead of arbitrary cancellation.",
  ]);
}

export function formatAgreementContentProtectionTerms(snapshot: IAgreementSnapshot): string {
  return bulletList([
    snapshot.contentProtectionRuleSummary,
    "Client previews may be watermarked and access logged.",
    "Downloads may be restricted until funds are released.",
    "Cancellation or dispute does not automatically unlock unpaid freelancer deliverables unless a resolution explicitly says so.",
  ]);
}

export function renderMicroGigAgreementSections(snapshot: IAgreementSnapshot): string {
  return [
    "## Deliverables",
    normalizeMarkdownText(snapshot.jobDescription, "Required output is described in the job scope."),
    "",
    "## Timeline and Deadlines",
    formatAgreementDeadlineTerms(snapshot),
  ].join("\n");
}

export function renderMilestoneAgreementSections(snapshot: IAgreementSnapshot): string {
  const rows = snapshot.milestones.map((milestone) =>
    [
      `### Milestone ${milestone.order}: ${normalizeMarkdownText(milestone.title, "Untitled milestone")}`,
      `- Amount: ${formatAmount(milestone.amount, snapshot.paymentAssetSymbol)}`,
      `- Deadline: ${formatTimestamp(milestone.deadlineAt)}`,
      `- Required output: ${normalizeMarkdownText(milestone.requiredOutput, "Not specified")}`,
      `- Proof submission: Required through Highrable for this milestone.`,
      `- Revision policy: ${milestone.revisionPolicy ?? snapshot.revisionPolicy ?? "Not specified"}`,
      `- Revision limit: ${milestone.revisionLimit ?? snapshot.revisionLimit ?? "Not specified"}`,
    ].join("\n"),
  );

  return ["## Deliverables and Milestones", ...rows].join("\n\n");
}

export function renderHighrableAgreementMarkdown(snapshot: IAgreementSnapshot): string {
  const freelancer = snapshot.freelancer;
  const jobTypeLabel = snapshot.jobType === "milestone_project" ? "Milestone-based" : "Micro gig";
  const conditionalSections =
    snapshot.jobType === "milestone_project"
      ? renderMilestoneAgreementSections(snapshot)
      : renderMicroGigAgreementSections(snapshot);

  return [
    "# Highrable Work Agreement",
    "",
    "## Agreement Summary",
    bulletList([
      `Agreement version: ${snapshot.version}`,
      `Generated timestamp: ${formatTimestamp(snapshot.generatedAt)}`,
      `Job title: ${normalizeMarkdownText(snapshot.jobTitle, "Untitled job")}`,
      `Job type: ${jobTypeLabel}`,
      `Payment: ${formatAmount(snapshot.paymentAmount, snapshot.paymentAssetSymbol)}`,
    ]),
    "",
    "## Parties",
    bulletList([
      `Client: ${snapshot.client.displayName ?? "Client"} (${snapshot.client.wallet})`,
      `Client wallet type: ${formatWalletType(snapshot.client.walletType)}`,
      `Freelancer: ${freelancer?.displayName ?? "Pending selected freelancer"}`,
      `Freelancer wallet: ${freelancer?.wallet ?? "Pending selected freelancer"}`,
      `Freelancer wallet type: ${formatWalletType(freelancer?.walletType)}`,
    ]),
    "",
    "## Highrable Platform Role",
    "Highrable is a platform and workflow provider. Highrable is not the employer of the client or freelancer.",
    "",
    "## Scope of Work",
    normalizeMarkdownText(snapshot.jobDescription, "The work scope has not been specified."),
    "",
    conditionalSections,
    "",
    "## Payment and Escrow Terms",
    formatAgreementPaymentTerms(snapshot),
    "",
    "## Proof of Work Submission",
    bulletList([
      "Freelancer must submit proof through Highrable.",
      "Proof may include files, links, images, videos, PDFs, documents, or Markdown.",
      "Proof metadata and files remain in Highrable or Convex storage.",
      "A proof hash may be generated and recorded through Highrable's proof workflow and may be anchored on-chain through the escrow flow.",
    ]),
    "",
    "## Revisions",
    formatAgreementRevisionTerms(snapshot),
    "",
    "## Pre-Settlement Deliverable Protection",
    formatAgreementContentProtectionTerms(snapshot),
    "",
    "## Cancellation",
    formatAgreementCancellationTerms(snapshot),
    "",
    "## Disputes",
    formatAgreementDisputeTerms(snapshot),
    "",
    "## Usage Rights and Intellectual Property",
    "Unless otherwise stated in a client-uploaded agreement or special terms, usage rights to final freelancer-submitted deliverables transfer to the client only after payment is released. Freelancer retains rights to unpaid work unless the parties agree otherwise or a dispute/review outcome explicitly states otherwise.",
    "",
    "## Confidentiality",
    bulletList([
      "Client materials should be used only for the work.",
      "Freelancer deliverables should not be misused before payment.",
      "Both parties should respect private files and communication.",
    ]),
    "",
    "## Acceptance Placeholder",
    bulletList([
      `Agreement version: ${snapshot.version}`,
      `Client wallet: ${snapshot.client.wallet}`,
      `Freelancer wallet: ${freelancer?.wallet ?? "Pending selected freelancer"}`,
      "Final acceptance is not enforced by this draft preview.",
    ]),
    "",
    "## Disclaimer",
    REQUIRED_DISCLAIMER,
    "",
  ].join("\n");
}

export async function validateAgreementSourceAttachment(
  ctx: QueryCtx,
  input: {
    attachmentId: Id<"attachments">;
    clientWallet: string;
  },
) {
  const attachment = await ctx.db.get(input.attachmentId);
  if (!attachment || attachment.status !== "active") {
    throw new NotFoundError("Uploaded agreement file missing.");
  }
  const clientWallet = normalizeWalletAddress(input.clientWallet);
  if (!isSameWallet(attachment.uploadedByWallet, clientWallet)) {
    throw new ForbiddenError("Users cannot use attachments they do not own as agreement files.");
  }
  if (!AGREEMENT_FILE_TYPES.has(attachment.type)) {
    throw new BadRequestError("Select a supported agreement file, such as PDF, DOCX, Markdown, or text.");
  }
  if (attachment.externalUrl && !attachment.storageId) {
    throw new BadRequestError("This attachment cannot be used as an agreement.");
  }

  return {
    attachment,
    previewSupported: isPreviewSupported(attachment),
  };
}

export async function createWorkAgreementEvent(
  ctx: MutationCtx,
  input: {
    agreementId: Id<"workAgreements">;
    jobId: Id<"jobs">;
    escrowId?: Id<"escrows">;
    type: TAgreementEventType;
    actorWallet: string;
    actorWalletType?: TWalletType;
    actorRole: "client" | "freelancer" | "system";
    message: string;
    oldStatus?: TAgreementStatus;
    newStatus?: TAgreementStatus;
    metadata?: unknown;
  },
) {
  return await ctx.db.insert("workAgreementEvents", {
    agreementId: input.agreementId,
    jobId: input.jobId,
    ...(input.escrowId ? { escrowId: input.escrowId } : {}),
    type: input.type,
    actorWallet: normalizeWalletAddress(input.actorWallet),
    ...(input.actorWalletType ? { actorWalletType: input.actorWalletType } : {}),
    actorRole: input.actorRole,
    message: input.message.slice(0, 500),
    ...(input.oldStatus ? { oldStatus: input.oldStatus } : {}),
    ...(input.newStatus ? { newStatus: input.newStatus } : {}),
    createdAt: Date.now(),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  });
}

export function buildBaseAgreementFields(input: {
  now: number;
  job: Doc<"jobs">;
  escrow?: Doc<"escrows"> | null;
  walletAddress: string;
  walletType: TWalletType;
  freelancerWalletType?: TWalletType;
  agreementType: TAgreementType;
  title?: string;
}) {
  const paymentAssetContractId = input.escrow?.asset ?? input.job.asset;
  const paymentAsset = resolvePaymentAsset(paymentAssetContractId);
  const paymentAmount =
    (input.job.jobType ?? "micro_gig") === "milestone_project"
      ? (input.job.totalBudget ?? input.job.budget)
      : (input.escrow?.amount ?? input.job.budget);
  const freelancerWallet = input.job.selectedFreelancerWallet
    ? normalizeWalletAddress(input.job.selectedFreelancerWallet)
    : undefined;

  return {
    agreementNumber: createAgreementNumber(input.now),
    jobId: input.job._id,
    ...((input.job.jobType ?? "micro_gig") === "micro_gig"
      ? { microGigId: input.job._id }
      : { milestoneGroupId: input.job._id }),
    ...(input.escrow ? { escrowId: input.escrow._id, onChainEscrowId: input.escrow.escrowId } : {}),
    clientWallet: normalizeWalletAddress(input.job.clientWallet),
    clientWalletType: input.walletType,
    ...(freelancerWallet ? { freelancerWallet } : {}),
    ...(input.freelancerWalletType ? { freelancerWalletType: input.freelancerWalletType } : {}),
    agreementType: input.agreementType,
    status: "draft" as const,
    title: sanitizeTitle(input.title ?? `${input.job.title} Work Agreement`),
    version: 1,
    paymentAmount,
    paymentAssetContractId,
    paymentAssetSymbol: paymentAsset.symbol,
    paymentAssetDecimals: paymentAsset.decimals,
    ...(input.job.deadlineAt ? { deadlineAt: input.job.deadlineAt } : {}),
    ...(input.job.revisionPolicy ? { revisionPolicy: input.job.revisionPolicy } : {}),
    ...(input.job.revisionLimit !== undefined ? { revisionLimit: input.job.revisionLimit } : {}),
    contentProtectionEnabled: true,
    disputePolicyVersion: "phase_31_platform_review",
    cancellationPolicyVersion: "phase_32_client_cancellation_judgment",
    createdByWallet: normalizeWalletAddress(input.walletAddress),
    createdByWalletType: input.walletType,
    createdAt: input.now,
    updatedAt: input.now,
    ...(paymentAsset.warning ? { metadata: { paymentWarning: paymentAsset.warning } } : {}),
  };
}

export function sanitizeAgreementUpdate(input: {
  title?: string;
  contentMarkdown?: string;
  metadata?: unknown;
}) {
  return {
    ...(input.title !== undefined ? { title: sanitizeTitle(input.title) } : {}),
    ...(input.contentMarkdown !== undefined
      ? { contentMarkdown: optionalNonEmptyString(input.contentMarkdown, "contentMarkdown") }
      : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
}
