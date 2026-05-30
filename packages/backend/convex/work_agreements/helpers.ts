import sanitizeHtml from "sanitize-html";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TWalletType } from "../users/schema";
import type {
  TAgreementEventType,
  TAgreementLockReason,
  TAgreementLockedBy,
  TAgreementStatus,
  TAgreementType,
} from "./schema";

import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { resolveStablecoinEscrowAssetId } from "../_shared/escrowAssets";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";
import { isPreviewSupported } from "../attachments/helpers";
import { createSystemMessageForEvent } from "../conversations/helpers";

const EDITABLE_STATUSES = new Set<TAgreementStatus>(["draft", "pending_preview", "ready_to_send"]);
const PREPARED_STATUSES = new Set<TAgreementStatus>(["draft", "pending_preview", "ready_to_send"]);
const ACCEPTED_STATUSES = new Set<TAgreementStatus>(["accepted", "locked"]);
const NON_BLOCKING_STATUSES = new Set<TAgreementStatus>(["rejected", "cancelled", "superseded"]);
const AGREEMENT_FILE_TYPES = new Set(["pdf", "document", "markdown", "file"]);
const DEFAULT_STABLECOIN_SYMBOL = "USDC";
const DEFAULT_STABLECOIN_DECIMALS = 7;
const NATIVE_XLM_DECIMALS = 7;
const AGREEMENT_CONTENT_MAX_LENGTH = 30000;
const AGREEMENT_ALLOWED_HEADER_LEVELS = [1, 2] as const;
const AGREEMENT_ALLOWED_LIST_TYPES = ["ordered", "bullet"] as const;
const REQUIRED_DISCLAIMER =
  "Highrable provides this as a workflow template, not legal advice. For regulated, high-value, or jurisdiction-specific work, get qualified review before acceptance.";

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

export interface IAgreementImmutableSnapshot extends IAgreementSnapshot {
  agreementId: string;
  agreementNumber: string;
  agreementVersion: number;
  agreementType: TAgreementType;
  title: string;
  escrowId?: string;
  onChainEscrowId?: string;
  clientWallet: string;
  clientWalletType: TWalletType;
  freelancerWallet: string;
  freelancerWalletType: TWalletType;
  contentMarkdown?: string;
  contentDelta?: string;
  contentHtml?: string;
  sourceAttachment?: {
    attachmentId: string;
    storageId?: string;
    name: string;
    size?: number;
    mimeType?: string;
    type: string;
    uploadedAt: number;
    fileHash?: string;
    fileHashTodo?: string;
  };
  acceptedAt: number;
}

export interface IAgreementRichTextInput {
  delta: string;
  html: string;
  text: string;
}

export interface IAgreementRichTextValue {
  contentDelta: string;
  contentHtml: string;
}

type TAgreementInlineAttributes = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  link?: string;
};

type TAgreementBlockAttributes = {
  blockquote?: boolean;
  list?: (typeof AGREEMENT_ALLOWED_LIST_TYPES)[number];
  header?: (typeof AGREEMENT_ALLOWED_HEADER_LEVELS)[number];
};

type TAgreementRichTextAttributes = TAgreementInlineAttributes & TAgreementBlockAttributes;

interface IAgreementRichTextOperation {
  insert: string;
  attributes?: TAgreementRichTextAttributes;
}

interface IAgreementRichTextDelta {
  ops: IAgreementRichTextOperation[];
}

type TAgreementSource = {
  job: Doc<"jobs">;
  escrow?: Doc<"escrows"> | null;
  milestones: Doc<"milestones">[];
};

function compareAgreementsByVersionThenUpdate(
  left: Doc<"workAgreements">,
  right: Doc<"workAgreements">,
): number {
  if (left.version !== right.version) {
    return right.version - left.version;
  }
  return right.updatedAt - left.updatedAt;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isAllowedHeaderLevel(value: unknown): value is 1 | 2 {
  return AGREEMENT_ALLOWED_HEADER_LEVELS.includes(value as 1 | 2);
}

function isAllowedListType(value: unknown): value is "ordered" | "bullet" {
  return AGREEMENT_ALLOWED_LIST_TYPES.includes(value as "ordered" | "bullet");
}

function normalizeAgreementLink(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  if (trimmedValue.startsWith("mailto:")) {
    try {
      const mailtoUrl = new URL(trimmedValue);
      return mailtoUrl.protocol === "mailto:" ? mailtoUrl.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  const candidateValue =
    /^https?:\/\//i.test(trimmedValue) || /^[a-z][a-z0-9+.-]*:/i.test(trimmedValue)
      ? trimmedValue
      : `https://${trimmedValue}`;

  try {
    const url = new URL(candidateValue);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return url.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function normalizeAgreementRichTextAttributes(
  value: unknown,
  { isLineBreak }: { isLineBreak: boolean },
): TAgreementRichTextAttributes | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const allowedAttributeKeys = new Set([
    "bold",
    "italic",
    "underline",
    "strike",
    "link",
    "blockquote",
    "list",
    "header",
  ]);
  const unsupportedAttribute = Object.keys(value).find((key) => !allowedAttributeKeys.has(key));
  if (unsupportedAttribute) {
    throw new BadRequestError("Agreement content contains unsupported formatting.");
  }

  const attributes: TAgreementRichTextAttributes = {};

  if (value.bold !== undefined && value.bold !== true) {
    throw new BadRequestError("Agreement content contains invalid bold formatting.");
  }
  if (value.italic !== undefined && value.italic !== true) {
    throw new BadRequestError("Agreement content contains invalid italic formatting.");
  }
  if (value.underline !== undefined && value.underline !== true) {
    throw new BadRequestError("Agreement content contains invalid underline formatting.");
  }
  if (value.strike !== undefined && value.strike !== true) {
    throw new BadRequestError("Agreement content contains invalid strikethrough formatting.");
  }

  if (value.bold === true) attributes.bold = true;
  if (value.italic === true) attributes.italic = true;
  if (value.underline === true) attributes.underline = true;
  if (value.strike === true) attributes.strike = true;

  const normalizedLink = normalizeAgreementLink(value.link);
  if (value.link !== undefined && !normalizedLink) {
    throw new BadRequestError("Agreement content contains an invalid link.");
  }
  if (normalizedLink) {
    attributes.link = normalizedLink;
  }

  if (isLineBreak) {
    if (value.blockquote !== undefined && value.blockquote !== true) {
      throw new BadRequestError("Agreement content contains invalid quote formatting.");
    }
    if (value.blockquote === true) {
      attributes.blockquote = true;
    }
    if (isAllowedListType(value.list)) {
      attributes.list = value.list;
    }
    if (isAllowedHeaderLevel(value.header)) {
      attributes.header = value.header;
    }
    if (value.list !== undefined && !isAllowedListType(value.list)) {
      throw new BadRequestError("Agreement content contains an invalid list format.");
    }
    if (value.header !== undefined && !isAllowedHeaderLevel(value.header)) {
      throw new BadRequestError("Agreement content contains an invalid heading format.");
    }
  } else if (
    value.blockquote !== undefined ||
    value.list !== undefined ||
    value.header !== undefined
  ) {
    throw new BadRequestError("Agreement content contains an invalid block format.");
  }

  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

function normalizeAgreementRichTextOperation(value: unknown): IAgreementRichTextOperation {
  if (!isRecord(value) || typeof value.insert !== "string") {
    throw new BadRequestError("Agreement content contains an unsupported rich text block.");
  }

  const insert = value.insert.replace(/\r\n?/g, "\n");
  if (!insert) {
    throw new BadRequestError("Agreement content contains an empty rich text block.");
  }

  const attributes = normalizeAgreementRichTextAttributes(value.attributes, {
    isLineBreak: insert === "\n",
  });

  if (
    insert !== "\n" &&
    attributes &&
    ("blockquote" in attributes || "list" in attributes || "header" in attributes)
  ) {
    throw new BadRequestError("Agreement content contains an invalid block format.");
  }

  return attributes ? { insert, attributes } : { insert };
}

function normalizeAgreementRichTextDelta(value: string): IAgreementRichTextDelta {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new BadRequestError("Agreement content contains malformed rich text.");
  }

  if (!isRecord(parsedValue) || !Array.isArray(parsedValue.ops)) {
    throw new BadRequestError("Agreement content is missing rich text operations.");
  }

  const ops = parsedValue.ops.map((operation) => normalizeAgreementRichTextOperation(operation));
  if (ops.length === 0) {
    throw new BadRequestError("Agreement content is missing rich text operations.");
  }

  const lastOperation = ops[ops.length - 1];
  if (!lastOperation || lastOperation.insert !== "\n") {
    ops.push({ insert: "\n" });
  }

  return { ops };
}

function getAgreementTextFromDelta(delta: IAgreementRichTextDelta): string {
  return delta.ops.map((operation) => operation.insert).join("");
}

function normalizeAgreementPlainText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function sanitizeAgreementHtml(value: string): string {
  const transformAnchorTag = (
    tagName: string,
    attribs: Record<string, string>,
  ): { tagName: string; attribs: Record<string, string> } => {
    const normalizedHref = normalizeAgreementLink(attribs.href);
    return {
      tagName,
      attribs: {
        ...(normalizedHref ? { href: normalizedHref } : {}),
        target: "_blank",
        rel: "noopener noreferrer",
      },
    };
  };

  return sanitizeHtml(value, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "a",
      "blockquote",
      "ol",
      "ul",
      "li",
      "h1",
      "h2",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: transformAnchorTag,
    },
  }).trim();
}

export function normalizeAgreementRichText(
  value: IAgreementRichTextInput | undefined,
): IAgreementRichTextValue | undefined {
  if (!value) {
    return undefined;
  }

  const normalizedDelta = normalizeAgreementRichTextDelta(value.delta);
  const deltaText = normalizeAgreementPlainText(getAgreementTextFromDelta(normalizedDelta));
  const providedText = normalizeAgreementPlainText(value.text);
  const normalizedText = deltaText || providedText;

  if (!normalizedText) {
    return undefined;
  }
  if (normalizedText.length > AGREEMENT_CONTENT_MAX_LENGTH) {
    throw new BadRequestError(
      `Agreement content must be ${AGREEMENT_CONTENT_MAX_LENGTH} characters or fewer.`,
    );
  }

  const sanitizedHtml = sanitizeAgreementHtml(value.html);
  if (!sanitizedHtml) {
    throw new BadRequestError("Agreement content contains no supported rich text.");
  }

  return {
    contentDelta: JSON.stringify(normalizedDelta),
    contentHtml: sanitizedHtml,
  };
}

function getStablecoinDecimals(): number {
  const rawValue = Number(process.env.NEXT_PUBLIC_STABLECOIN_DECIMALS);
  if (!Number.isInteger(rawValue) || rawValue < 0 || rawValue > 18)
    return DEFAULT_STABLECOIN_DECIMALS;
  return rawValue;
}

function resolvePaymentAsset(assetContractId: string): {
  symbol: string;
  decimals: number;
  warning?: string;
} {
  const stablecoinContractId = resolveStablecoinEscrowAssetId(
    process.env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID,
  );
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
  if (status === "ready_to_send") return "pending_acceptance";
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
      .filter((agreement) => !NON_BLOCKING_STATUSES.has(agreement.status))
      .sort(compareAgreementsByVersionThenUpdate)[0] ?? null
  );
}

export async function getCurrentAgreementByJob(ctx: QueryCtx, jobId: Id<"jobs">) {
  const agreements = await ctx.db
    .query("workAgreements")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .collect();

  const current = agreements
    .filter((agreement) => agreement.status !== "cancelled" && agreement.status !== "superseded")
    .sort(compareAgreementsByVersionThenUpdate)[0];
  if (current) return current;

  return (
    agreements
      .filter((agreement) => agreement.status === "rejected")
      .sort(compareAgreementsByVersionThenUpdate)[0] ?? null
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
    throw new BadRequestError(
      agreement.status === "accepted" || agreement.status === "locked"
        ? "Accepted agreements cannot be edited directly."
        : "This agreement draft can no longer be modified.",
    );
  }
  return { agreement, walletAddress };
}

export async function assertCanRecoverRejectedAgreement(
  ctx: QueryCtx,
  input: { agreementId: Id<"workAgreements">; walletAddress: string },
) {
  const agreement = await getAgreementOrThrow(ctx, input.agreementId);
  const walletAddress = normalizeWalletAddress(input.walletAddress);
  if (!isSameWallet(agreement.clientWallet, walletAddress)) {
    throw new ForbiddenError("Only the client can recover this rejected agreement.");
  }
  if (agreement.status !== "rejected") {
    throw new BadRequestError("Only rejected agreements can use this recovery action.");
  }
  return { agreement, walletAddress };
}

export async function assertAgreementIsMutable(
  ctx: QueryCtx,
  input: { agreementId: Id<"workAgreements">; walletAddress: string },
) {
  return await assertCanEditWorkAgreement(ctx, input);
}

export function getAgreementGuardMessage(status?: TAgreementStatus | null): string {
  if (status === "pending_acceptance") {
    return "This agreement is pending freelancer acceptance.";
  }
  if (status === "rejected") {
    return "This agreement was rejected. Create a new agreement before continuing.";
  }
  if (status === "cancelled") {
    return "A work agreement must be accepted before this work can start.";
  }
  return "A work agreement must be accepted before this work can start.";
}

export function isLegacyAgreementExempt(parent: {
  status?: string;
  submittedAt?: number;
  completedAt?: number;
  approvedAt?: number;
  createdAt?: number;
}) {
  return Boolean(
    parent.submittedAt ||
    parent.completedAt ||
    parent.approvedAt ||
    parent.status === "submitted" ||
    parent.status === "revision_submitted" ||
    parent.status === "completed" ||
    parent.status === "cancelled" ||
    parent.status === "disputed",
  );
}

export function requiresAcceptedAgreement(parent: {
  status?: string;
  submittedAt?: number;
  completedAt?: number;
  approvedAt?: number;
}) {
  return !isLegacyAgreementExempt(parent);
}

export async function hasAcceptedAgreement(ctx: QueryCtx, jobId: Id<"jobs">) {
  const agreements = await ctx.db
    .query("workAgreements")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .collect();
  return agreements.some((agreement) => ACCEPTED_STATUSES.has(agreement.status));
}

export async function getAcceptedAgreementForJob(ctx: QueryCtx, jobId: Id<"jobs">) {
  const agreements = await ctx.db
    .query("workAgreements")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .collect();
  return (
    agreements
      .filter((agreement) => ACCEPTED_STATUSES.has(agreement.status))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
  );
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
  const paymentAmount =
    jobType === "milestone_project"
      ? (job.totalBudget ?? job.budget)
      : (escrow?.amount ?? job.budget);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new BadRequestError(
      "Payment details are missing, so the agreement cannot be generated yet.",
    );
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
    normalizeMarkdownText(
      snapshot.jobDescription,
      "Required output is described in the job scope.",
    ),
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

export function renderAgreementMarkdownAsRichText(markdown: string): IAgreementRichTextValue {
  const ops: IAgreementRichTextOperation[] = [];
  const htmlParts: string[] = [];
  let activeList: "ul" | null = null;

  const closeList = () => {
    if (activeList) {
      htmlParts.push(`</${activeList}>`);
      activeList = null;
    }
  };

  for (const rawLine of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      ops.push({ insert: "\n" });
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      const text = line.slice(2).trim();
      ops.push({ insert: text }, { insert: "\n", attributes: { header: 1 } });
      htmlParts.push(`<h1>${escapeHtml(text)}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      const text = line.slice(3).trim();
      ops.push({ insert: text }, { insert: "\n", attributes: { header: 2 } });
      htmlParts.push(`<h2>${escapeHtml(text)}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      const text = line.slice(4).trim();
      ops.push({ insert: text, attributes: { bold: true } }, { insert: "\n" });
      htmlParts.push(`<p><strong>${escapeHtml(text)}</strong></p>`);
      continue;
    }

    if (line.startsWith("- ")) {
      const text = line.slice(2).trim();
      if (!activeList) {
        activeList = "ul";
        htmlParts.push("<ul>");
      }
      ops.push({ insert: text }, { insert: "\n", attributes: { list: "bullet" } });
      htmlParts.push(`<li>${escapeHtml(text)}</li>`);
      continue;
    }

    closeList();
    ops.push({ insert: line }, { insert: "\n" });
    htmlParts.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeList();

  return normalizeAgreementRichText({
    delta: JSON.stringify({ ops }),
    html: htmlParts.join(""),
    text: markdown,
  })!;
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
    throw new BadRequestError(
      "Select a supported agreement file, such as PDF, DOCX, Markdown, or text.",
    );
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
    agreementVersionId?: Id<"workAgreementVersions">;
    jobId: Id<"jobs">;
    microGigId?: Id<"jobs">;
    milestoneId?: Id<"milestones">;
    escrowId?: Id<"escrows">;
    type: TAgreementEventType;
    actorWallet: string;
    actorWalletType?: TWalletType;
    actorRole: "client" | "freelancer" | "system" | "moderator";
    message: string;
    oldStatus?: TAgreementStatus;
    newStatus?: TAgreementStatus;
    oldVersion?: number;
    newVersion?: number;
    relatedEntityType?: string;
    relatedEntityId?: string;
    metadata?: unknown;
  },
) {
  return await ctx.db.insert("workAgreementEvents", {
    agreementId: input.agreementId,
    ...(input.agreementVersionId ? { agreementVersionId: input.agreementVersionId } : {}),
    jobId: input.jobId,
    ...(input.microGigId ? { microGigId: input.microGigId } : {}),
    ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
    ...(input.escrowId ? { escrowId: input.escrowId } : {}),
    type: input.type,
    actorWallet: normalizeWalletAddress(input.actorWallet),
    ...(input.actorWalletType ? { actorWalletType: input.actorWalletType } : {}),
    actorRole: input.actorRole,
    message: input.message.slice(0, 500),
    ...(input.oldStatus ? { oldStatus: input.oldStatus } : {}),
    ...(input.newStatus ? { newStatus: input.newStatus } : {}),
    ...(input.oldVersion !== undefined ? { oldVersion: input.oldVersion } : {}),
    ...(input.newVersion !== undefined ? { newVersion: input.newVersion } : {}),
    ...(input.relatedEntityType ? { relatedEntityType: input.relatedEntityType } : {}),
    ...(input.relatedEntityId ? { relatedEntityId: input.relatedEntityId } : {}),
    createdAt: Date.now(),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  });
}

export async function getAgreementVersionByNumber(
  ctx: QueryCtx,
  input: { agreementId: Id<"workAgreements">; versionNumber: number },
) {
  return await ctx.db
    .query("workAgreementVersions")
    .withIndex("by_agreement_version", (q) =>
      q.eq("agreementId", input.agreementId).eq("versionNumber", input.versionNumber),
    )
    .first();
}

export async function getActiveAgreementVersionForAgreement(
  ctx: QueryCtx,
  agreement: Doc<"workAgreements">,
) {
  const locked = await ctx.db
    .query("workAgreementVersions")
    .withIndex("by_agreement_status", (q) =>
      q.eq("agreementId", agreement._id).eq("status", "locked"),
    )
    .order("desc")
    .first();
  if (locked) return locked;

  const accepted = await ctx.db
    .query("workAgreementVersions")
    .withIndex("by_agreement_status", (q) =>
      q.eq("agreementId", agreement._id).eq("status", "accepted"),
    )
    .order("desc")
    .first();
  return accepted;
}

export function buildAgreementVersionFromAgreement(
  agreement: Doc<"workAgreements">,
  status?: TAgreementStatus,
) {
  const now = Date.now();
  return {
    agreementId: agreement._id,
    versionNumber: agreement.version,
    status: status ?? agreement.status,
    agreementType: agreement.agreementType,
    ...(agreement.contentMarkdown ? { contentMarkdown: agreement.contentMarkdown } : {}),
    ...(agreement.contentDelta ? { contentDelta: agreement.contentDelta } : {}),
    ...(agreement.contentHtml ? { contentHtml: agreement.contentHtml } : {}),
    ...(agreement.sourceAttachmentId ? { sourceAttachmentId: agreement.sourceAttachmentId } : {}),
    ...(agreement.immutableSnapshot ? { immutableSnapshot: agreement.immutableSnapshot } : {}),
    ...(agreement.generatedFromSnapshot
      ? { generatedFromSnapshot: agreement.generatedFromSnapshot }
      : {}),
    ...(agreement.agreementHash ? { agreementHash: agreement.agreementHash } : {}),
    ...(agreement.hashAlgorithm ? { hashAlgorithm: agreement.hashAlgorithm } : {}),
    ...(agreement.hashEncoding ? { hashEncoding: agreement.hashEncoding } : {}),
    proposedByWallet: agreement.createdByWallet,
    proposedByWalletType: agreement.createdByWalletType,
    ...(agreement.acceptedByFreelancerAt
      ? { acceptedByFreelancerAt: agreement.acceptedByFreelancerAt }
      : {}),
    ...(agreement.acceptedByFreelancerWallet
      ? { acceptedByFreelancerWallet: agreement.acceptedByFreelancerWallet }
      : {}),
    ...(agreement.acceptedByFreelancerWalletType
      ? { acceptedByFreelancerWalletType: agreement.acceptedByFreelancerWalletType }
      : {}),
    ...(agreement.clientConfirmedAt ? { clientConfirmedAt: agreement.clientConfirmedAt } : {}),
    ...(agreement.lockedAt ? { lockedAt: agreement.lockedAt } : {}),
    paymentAmount: agreement.paymentAmount,
    paymentAssetContractId: agreement.paymentAssetContractId,
    paymentAssetSymbol: agreement.paymentAssetSymbol,
    paymentAssetDecimals: agreement.paymentAssetDecimals,
    ...(agreement.deadlineAt ? { deadlineAt: agreement.deadlineAt } : {}),
    ...(agreement.revisionPolicy ? { revisionPolicy: agreement.revisionPolicy } : {}),
    ...(agreement.revisionLimit !== undefined ? { revisionLimit: agreement.revisionLimit } : {}),
    contentProtectionEnabled: agreement.contentProtectionEnabled,
    createdAt: agreement.createdAt,
    updatedAt: now,
    metadata: {
      materializedFromAgreement: true,
      agreementStatusAtMaterialization: agreement.status,
    },
  };
}

export async function ensureAgreementVersionForAgreement(
  ctx: MutationCtx,
  input: { agreement: Doc<"workAgreements">; status?: TAgreementStatus },
) {
  const existing = await getAgreementVersionByNumber(ctx, {
    agreementId: input.agreement._id,
    versionNumber: input.agreement.version,
  });
  if (existing) return existing;

  const versionId = await ctx.db.insert(
    "workAgreementVersions",
    buildAgreementVersionFromAgreement(input.agreement, input.status),
  );
  return await ctx.db.get(versionId);
}

export async function resolveAgreementContextForParent(
  ctx: QueryCtx,
  input: { jobId?: Id<"jobs">; escrowId?: Id<"escrows">; viewerWallet?: string },
) {
  let agreement: Doc<"workAgreements"> | null = null;
  if (input.jobId) {
    agreement = await getAcceptedAgreementForJob(ctx, input.jobId);
  }
  if (!agreement && input.escrowId) {
    const escrow = await ctx.db.get(input.escrowId);
    if (escrow) agreement = await getAcceptedAgreementForJob(ctx, escrow.jobId);
  }
  if (!agreement) return null;
  await assertCanViewWorkAgreement(ctx, agreement, input.viewerWallet);
  const version = await getActiveAgreementVersionForAgreement(ctx, agreement);
  return {
    agreement,
    version,
    fallback: version ? null : "No materialized agreement version was found.",
    label: version ? `Agreement v${version.versionNumber}` : `Agreement v${agreement.version}`,
    agreementHash: version?.agreementHash ?? agreement.agreementHash ?? null,
    versionNumber: version?.versionNumber ?? agreement.version,
  };
}

export function assertAgreementVersionImmutable(version: Doc<"workAgreementVersions">) {
  if (
    version.status === "accepted" ||
    version.status === "locked" ||
    version.status === "superseded"
  ) {
    throw new BadRequestError("Locked agreement versions cannot be edited.");
  }
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export async function hashAgreementManifest(manifest: unknown): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(stableStringify(manifest));
    return toHex(await crypto.subtle.digest("SHA-256", bytes));
  } catch {
    throw new BadRequestError("Agreement hash could not be generated. Please try again.");
  }
}

async function hashAgreementContent(agreement: Doc<"workAgreements">): Promise<string | undefined> {
  if (!agreement.contentDelta && !agreement.contentHtml && !agreement.contentMarkdown) {
    return undefined;
  }
  return await hashAgreementManifest({
    content: {
      ...(agreement.contentDelta ? { delta: agreement.contentDelta } : {}),
      ...(agreement.contentHtml ? { html: agreement.contentHtml } : {}),
      ...(agreement.contentMarkdown ? { markdown: agreement.contentMarkdown } : {}),
    },
  });
}

export async function buildAgreementImmutableSnapshot(
  ctx: QueryCtx,
  input: {
    agreement: Doc<"workAgreements">;
    acceptedAt: number;
    freelancerWalletType: TWalletType;
  },
): Promise<IAgreementImmutableSnapshot> {
  const { agreement } = input;
  if (!agreement.freelancerWallet) {
    throw new BadRequestError("Agreement is missing freelancer wallet.");
  }
  const generatedSnapshot =
    agreement.generatedFromSnapshot && typeof agreement.generatedFromSnapshot === "object"
      ? (agreement.generatedFromSnapshot as IAgreementSnapshot)
      : await buildAgreementSnapshot(ctx, {
          jobId: agreement.jobId,
          generatedByWallet: agreement.createdByWallet,
          generatedByWalletType: agreement.createdByWalletType,
          clientWalletType: agreement.clientWalletType,
          freelancerWalletType: input.freelancerWalletType,
          version: agreement.version,
        });

  const sourceAttachment = agreement.sourceAttachmentId
    ? await ctx.db.get(agreement.sourceAttachmentId)
    : null;
  const metadata = sourceAttachment?.metadata as { fileHash?: string } | undefined;

  return {
    ...generatedSnapshot,
    agreementId: agreement._id,
    agreementNumber: agreement.agreementNumber,
    agreementVersion: agreement.version,
    agreementType: agreement.agreementType,
    title: agreement.title,
    ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
    ...(agreement.onChainEscrowId ? { onChainEscrowId: agreement.onChainEscrowId } : {}),
    clientWallet: agreement.clientWallet,
    clientWalletType: agreement.clientWalletType,
    freelancerWallet: agreement.freelancerWallet,
    freelancerWalletType: input.freelancerWalletType,
    ...(agreement.contentMarkdown ? { contentMarkdown: agreement.contentMarkdown } : {}),
    ...(agreement.contentDelta ? { contentDelta: agreement.contentDelta } : {}),
    ...(agreement.contentHtml ? { contentHtml: agreement.contentHtml } : {}),
    ...(sourceAttachment
      ? {
          sourceAttachment: {
            attachmentId: sourceAttachment._id,
            ...(sourceAttachment.storageId ? { storageId: sourceAttachment.storageId } : {}),
            name: sourceAttachment.name,
            ...(sourceAttachment.size !== undefined ? { size: sourceAttachment.size } : {}),
            ...(sourceAttachment.mimeType !== undefined
              ? { mimeType: sourceAttachment.mimeType }
              : {}),
            type: sourceAttachment.type,
            uploadedAt: sourceAttachment.createdAt,
            ...(metadata?.fileHash ? { fileHash: metadata.fileHash } : {}),
            ...(!metadata?.fileHash
              ? {
                  fileHashTodo:
                    "TODO(phase-36): compute and store file-content hashes for uploaded agreement source files.",
                }
              : {}),
          },
        }
      : {}),
    acceptedAt: input.acceptedAt,
  };
}

export async function buildAgreementHashManifest(
  ctx: QueryCtx,
  input: {
    agreement: Doc<"workAgreements">;
    immutableSnapshot: IAgreementImmutableSnapshot;
  },
) {
  const { agreement, immutableSnapshot } = input;
  const agreementContentHash = await hashAgreementContent(agreement);
  const sourceAttachment = agreement.sourceAttachmentId
    ? await ctx.db.get(agreement.sourceAttachmentId)
    : null;
  const sourceMetadata = sourceAttachment?.metadata as { fileHash?: string } | undefined;
  const sourceAttachmentHash = sourceMetadata?.fileHash
    ? sourceMetadata.fileHash
    : sourceAttachment
      ? await hashAgreementManifest({
          attachmentId: sourceAttachment._id,
          storageId: sourceAttachment.storageId,
          name: sourceAttachment.name,
          size: sourceAttachment.size,
          mimeType: sourceAttachment.mimeType,
          uploadedAt: sourceAttachment.createdAt,
        })
      : undefined;

  return {
    agreementVersion: 1,
    agreementType: agreement.agreementType,
    platform: "Highrable",
    jobId: agreement.jobId,
    escrowId: agreement.escrowId,
    clientWallet: agreement.clientWallet,
    clientWalletType: agreement.clientWalletType,
    freelancerWallet: immutableSnapshot.freelancerWallet,
    freelancerWalletType: immutableSnapshot.freelancerWalletType,
    paymentAmount: String(agreement.paymentAmount),
    paymentAssetContractId: agreement.paymentAssetContractId,
    paymentAssetSymbol: agreement.paymentAssetSymbol,
    paymentAssetDecimals: agreement.paymentAssetDecimals,
    deadlineAt: agreement.deadlineAt ? String(agreement.deadlineAt) : undefined,
    milestones: immutableSnapshot.milestones,
    revisionPolicy: agreement.revisionPolicy,
    revisionLimit:
      agreement.revisionLimit === undefined || agreement.revisionLimit === null
        ? undefined
        : String(agreement.revisionLimit),
    contentProtectionEnabled: agreement.contentProtectionEnabled,
    agreementContentHash,
    sourceAttachmentHash,
    generatedFromSnapshotHash: agreement.generatedFromSnapshot
      ? await hashAgreementManifest(agreement.generatedFromSnapshot)
      : undefined,
    acceptedAt: new Date(immutableSnapshot.acceptedAt).toISOString(),
  };
}

export async function assertCanSendAgreement(
  ctx: QueryCtx,
  input: { agreementId: Id<"workAgreements">; walletAddress: string },
) {
  const agreement = await getAgreementOrThrow(ctx, input.agreementId);
  const walletAddress = normalizeWalletAddress(input.walletAddress);
  if (!isSameWallet(agreement.clientWallet, walletAddress)) {
    throw new ForbiddenError("Only the client can send this agreement.");
  }
  if (!PREPARED_STATUSES.has(agreement.status)) {
    throw new BadRequestError("Agreement is not ready to send.");
  }
  const job = await ctx.db.get(agreement.jobId);
  if (!job) {
    throw new NotFoundError("Job not found.");
  }
  let freelancerWallet = job.selectedFreelancerWallet
    ? normalizeWalletAddress(job.selectedFreelancerWallet)
    : undefined;
  let milestoneId = agreement.milestoneId;
  if (!freelancerWallet && (job.jobType ?? "micro_gig") === "milestone_project") {
    const assignedMilestones = agreement.milestoneId
      ? [await ctx.db.get(agreement.milestoneId)]
      : await ctx.db
          .query("milestones")
          .withIndex("by_jobId_order", (q) => q.eq("jobId", job._id))
          .order("asc")
          .take(500);
    const assigned = assignedMilestones.filter(
      (milestone): milestone is Doc<"milestones"> => Boolean(milestone?.assignedFreelancerWallet),
    );
    const assignedWallets = new Set(
      assigned.map((milestone) => normalizeWalletAddress(milestone.assignedFreelancerWallet!)),
    );
    if (assignedWallets.size === 1) {
      freelancerWallet = [...assignedWallets][0];
      const onlyAssignedMilestone = assigned[0];
      if (!milestoneId && assigned.length === 1 && onlyAssignedMilestone) {
        milestoneId = onlyAssignedMilestone._id;
      }
    } else if (assignedWallets.size > 1) {
      throw new BadRequestError(
        "Create a milestone-specific agreement before sending agreements to different freelancers.",
      );
    }
  }
  if (!freelancerWallet) {
    throw new BadRequestError("Select a freelancer before sending the agreement.");
  }
  if (agreement.freelancerWallet && !isSameWallet(agreement.freelancerWallet, freelancerWallet)) {
    throw new BadRequestError(
      "This agreement is assigned to a different freelancer. Create a new agreement for the selected freelancer.",
    );
  }
  const freelancerUser = await ctx.db
    .query("users")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", freelancerWallet))
    .first();
  const freelancerWalletType = agreement.freelancerWalletType ?? freelancerUser?.walletType;
  if (!freelancerWalletType) {
    throw new BadRequestError("Agreement must include freelancer wallet type before sending.");
  }
  if (!Number.isFinite(agreement.paymentAmount) || agreement.paymentAmount <= 0) {
    throw new BadRequestError("Payment details are missing.");
  }
  if (!agreement.paymentAssetContractId || !agreement.paymentAssetSymbol) {
    throw new BadRequestError("Payment details are missing.");
  }
  if (agreement.agreementType === "highrable_generated" && !agreement.contentMarkdown) {
    throw new BadRequestError("Agreement must be previewed before sending.");
  }
  if (agreement.agreementType === "client_uploaded" && !agreement.sourceAttachmentId) {
    throw new BadRequestError("Agreement must be previewed before sending.");
  }
  return { agreement, job, walletAddress, freelancerWallet, freelancerWalletType, milestoneId };
}

export async function assertCanAcceptAgreement(
  ctx: QueryCtx,
  input: { agreementId: Id<"workAgreements">; walletAddress: string },
) {
  const agreement = await getAgreementOrThrow(ctx, input.agreementId);
  const walletAddress = normalizeWalletAddress(input.walletAddress);
  if (agreement.status === "accepted" || agreement.status === "locked") {
    throw new BadRequestError("This agreement has already been accepted.");
  }
  if (agreement.status === "rejected") {
    throw new BadRequestError(
      "This agreement has been rejected. Create a new agreement to continue.",
    );
  }
  if (agreement.status !== "pending_acceptance") {
    throw new BadRequestError("This agreement is not pending freelancer acceptance.");
  }
  if (!agreement.freelancerWallet || !isSameWallet(agreement.freelancerWallet, walletAddress)) {
    throw new ForbiddenError("Only the selected freelancer can accept this agreement.");
  }
  return { agreement, walletAddress };
}

export async function assertCanRejectAgreement(
  ctx: QueryCtx,
  input: { agreementId: Id<"workAgreements">; walletAddress: string },
) {
  const { agreement, walletAddress } = await assertCanAcceptAgreement(ctx, input);
  return { agreement, walletAddress };
}

export async function assertCanLockAgreement(
  ctx: QueryCtx,
  input: { agreementId: Id<"workAgreements">; actorWallet?: string },
) {
  const agreement = await getAgreementOrThrow(ctx, input.agreementId);
  if (agreement.status !== "accepted") {
    if (agreement.status === "locked") {
      throw new BadRequestError("This agreement is already locked.");
    }
    throw new BadRequestError("Only accepted agreements can be locked.");
  }
  if (input.actorWallet && !isSameWallet(input.actorWallet, agreement.clientWallet)) {
    throw new ForbiddenError("Only the client can manually lock this agreement.");
  }
  return agreement;
}

export async function createAgreementNotification(
  ctx: MutationCtx,
  input: {
    recipientWallet: string;
    recipientWalletType?: TWalletType;
    type: "agreement_sent" | "agreement_accepted" | "agreement_rejected" | "agreement_locked";
    title: string;
    body: string;
    jobId: Id<"jobs">;
    milestoneId?: Id<"milestones">;
    escrowId?: Id<"escrows">;
    agreementId: Id<"workAgreements">;
    agreementHash?: string;
  },
) {
  const parentType = input.milestoneId ? "milestone" : "micro_gig";
  return await ctx.db.insert("notifications", {
    recipientWallet: normalizeWalletAddress(input.recipientWallet),
    ...(input.recipientWalletType ? { recipientWalletType: input.recipientWalletType } : {}),
    type: input.type,
    title: input.title,
    body: input.body,
    parentType,
    parentId: input.milestoneId ?? input.jobId,
    jobId: input.jobId,
    ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
    ...(input.escrowId ? { escrowId: input.escrowId } : {}),
    createdAt: Date.now(),
    metadata: {
      agreementId: input.agreementId,
      ...(input.agreementHash ? { agreementHash: input.agreementHash } : {}),
    },
  });
}

export async function createAgreementSystemMessage(
  ctx: MutationCtx,
  input: {
    agreement: Doc<"workAgreements">;
    eventType:
      | "agreement_sent"
      | "agreement_accepted"
      | "agreement_rejected"
      | "agreement_locked"
      | "agreement_amendment_proposed"
      | "agreement_amendment_accepted"
      | "agreement_amendment_rejected"
      | "agreement_superseded"
      | "agreement_referenced_in_dispute"
      | "agreement_referenced_in_cancellation";
    body: string;
    agreementHash?: string;
  },
) {
  const parentType = input.agreement.escrowId
    ? "escrow"
    : input.agreement.milestoneId
      ? "milestone"
      : "job";
  const parentId = input.agreement.escrowId ?? input.agreement.milestoneId ?? input.agreement.jobId;
  const existing = await ctx.db
    .query("messages")
    .withIndex("by_event", (q) => q.eq("eventType", input.eventType))
    .order("desc")
    .take(50);
  const duplicate = existing.some((message) => {
    const payload = message.eventPayload as { agreementId?: string } | undefined;
    return payload?.agreementId === input.agreement._id;
  });
  if (duplicate) return null;

  return await createSystemMessageForEvent(ctx, {
    parentType,
    parentId,
    eventType: input.eventType,
    body: input.body,
    eventPayload: {
      agreementId: input.agreement._id,
      ...(input.agreementHash ? { agreementHash: input.agreementHash } : {}),
    },
  });
}

export async function lockWorkAgreementForCommitment(
  ctx: MutationCtx,
  input: {
    agreement: Doc<"workAgreements">;
    lockedBy: TAgreementLockedBy;
    lockReason: TAgreementLockReason;
    actorWallet?: string;
    actorWalletType?: TWalletType;
    escrowId?: Id<"escrows">;
    onChainEscrowId?: string;
  },
) {
  const agreement = {
    ...input.agreement,
    ...(input.escrowId ? { escrowId: input.escrowId } : {}),
    ...(input.onChainEscrowId ? { onChainEscrowId: input.onChainEscrowId } : {}),
  };
  if (agreement.status === "locked") return agreement;
  if (agreement.status !== "accepted") {
    throw new BadRequestError("Only accepted agreements can be locked.");
  }
  const now = Date.now();
  const immutableSnapshot =
    agreement.immutableSnapshot ??
    (await buildAgreementImmutableSnapshot(ctx, {
      agreement,
      acceptedAt: agreement.acceptedByFreelancerAt ?? now,
      freelancerWalletType:
        agreement.acceptedByFreelancerWalletType ??
        agreement.freelancerWalletType ??
        "external_wallet",
    }));
  const manifest = await buildAgreementHashManifest(ctx, { agreement, immutableSnapshot });
  const agreementHash = agreement.agreementHash ?? (await hashAgreementManifest(manifest));
  await ctx.db.patch(agreement._id, {
    status: "locked",
    ...(input.escrowId ? { escrowId: input.escrowId } : {}),
    ...(input.onChainEscrowId ? { onChainEscrowId: input.onChainEscrowId } : {}),
    lockedAt: now,
    lockedBy: input.lockedBy,
    lockReason: input.lockReason,
    immutableSnapshot,
    agreementHash,
    hashAlgorithm: "sha256",
    hashEncoding: "hex",
    lockedSnapshotHash: agreementHash,
    updatedAt: now,
  });
  const lockedAgreement = {
    ...agreement,
    status: "locked" as const,
    lockedAt: now,
    lockedBy: input.lockedBy,
    lockReason: input.lockReason,
    immutableSnapshot,
    agreementHash,
    hashAlgorithm: "sha256" as const,
    hashEncoding: "hex" as const,
    lockedSnapshotHash: agreementHash,
    updatedAt: now,
  };
  const lockedVersion = await ensureAgreementVersionForAgreement(ctx, {
    agreement: lockedAgreement,
    status: "locked",
  });
  if (lockedVersion && lockedVersion.status !== "locked") {
    await ctx.db.patch(lockedVersion._id, {
      status: "locked",
      lockedAt: now,
      agreementHash,
      hashAlgorithm: "sha256",
      hashEncoding: "hex",
      immutableSnapshot,
      updatedAt: now,
    });
  }
  await createWorkAgreementEvent(ctx, {
    agreementId: agreement._id,
    ...(lockedVersion ? { agreementVersionId: lockedVersion._id } : {}),
    jobId: agreement.jobId,
    ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
    type: "agreement_locked",
    actorWallet: input.actorWallet ?? agreement.clientWallet,
    ...(input.actorWalletType ? { actorWalletType: input.actorWalletType } : {}),
    actorRole: input.lockedBy === "client" ? "client" : "system",
    message: "Work agreement locked.",
    oldStatus: "accepted",
    newStatus: "locked",
    metadata: { agreementHash, lockedBy: input.lockedBy, lockReason: input.lockReason },
  });
  await createAgreementSystemMessage(ctx, {
    agreement,
    eventType: "agreement_locked",
    body: "Work agreement locked: Agreement is now locked for this work.",
    agreementHash,
  });
  await createAgreementNotification(ctx, {
    recipientWallet: agreement.clientWallet,
    recipientWalletType: agreement.clientWalletType,
    type: "agreement_locked",
    title: "Agreement locked",
    body: "The accepted work agreement is now locked for this work.",
    jobId: agreement.jobId,
    ...(agreement.milestoneId ? { milestoneId: agreement.milestoneId } : {}),
    ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
    agreementId: agreement._id,
    agreementHash,
  });
  if (agreement.freelancerWallet) {
    await createAgreementNotification(ctx, {
      recipientWallet: agreement.freelancerWallet,
      recipientWalletType: agreement.freelancerWalletType,
      type: "agreement_locked",
      title: "Agreement locked",
      body: "The accepted work agreement is now locked for this work.",
      jobId: agreement.jobId,
      ...(agreement.milestoneId ? { milestoneId: agreement.milestoneId } : {}),
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      agreementId: agreement._id,
      agreementHash,
    });
  }
  return await getAgreementOrThrow(ctx, agreement._id);
}

export async function lockAcceptedAgreementForJob(
  ctx: MutationCtx,
  input: {
    jobId: Id<"jobs">;
    lockedBy: TAgreementLockedBy;
    lockReason: TAgreementLockReason;
    actorWallet?: string;
    actorWalletType?: TWalletType;
    escrowId?: Id<"escrows">;
    onChainEscrowId?: string;
  },
) {
  const agreement = await getAcceptedAgreementForJob(ctx, input.jobId);
  if (!agreement || agreement.status !== "accepted") return null;
  return await lockWorkAgreementForCommitment(ctx, { agreement, ...input });
}

export async function recordAgreementGuardBlockedAction(
  ctx: MutationCtx,
  input: {
    jobId: Id<"jobs">;
    escrowId?: Id<"escrows">;
    actorWallet: string;
    actorWalletType?: TWalletType;
    action: string;
    message: string;
  },
) {
  const agreement = await getActiveAgreementByJob(ctx, input.jobId);
  if (!agreement) return null;
  return await createWorkAgreementEvent(ctx, {
    agreementId: agreement._id,
    jobId: input.jobId,
    ...(input.escrowId
      ? { escrowId: input.escrowId }
      : agreement.escrowId
        ? { escrowId: agreement.escrowId }
        : {}),
    type: "agreement_guard_blocked_action",
    actorWallet: input.actorWallet,
    ...(input.actorWalletType ? { actorWalletType: input.actorWalletType } : {}),
    actorRole: "freelancer",
    message: input.message,
    oldStatus: agreement.status,
    newStatus: agreement.status,
    metadata: { action: input.action },
  });
}

export async function assertAgreementAcceptedForProofSubmission(
  ctx: MutationCtx,
  input: {
    job: Doc<"jobs">;
    escrowId?: Id<"escrows">;
    actorWallet: string;
    actorWalletType?: TWalletType;
  },
) {
  if (!requiresAcceptedAgreement(input.job)) return;
  const agreement = await getActiveAgreementByJob(ctx, input.job._id);
  if (agreement && ACCEPTED_STATUSES.has(agreement.status)) return;
  const message =
    agreement?.status === "pending_acceptance"
      ? "The selected freelancer must accept the agreement before proof can be submitted."
      : "A work agreement must be accepted before proof can be submitted.";
  await recordAgreementGuardBlockedAction(ctx, {
    jobId: input.job._id,
    ...(input.escrowId ? { escrowId: input.escrowId } : {}),
    actorWallet: input.actorWallet,
    ...(input.actorWalletType ? { actorWalletType: input.actorWalletType } : {}),
    action: "proof_submission",
    message,
  });
  throw new ForbiddenError(message);
}

export async function assertAgreementAcceptedForWorkStart(
  ctx: MutationCtx,
  input: {
    job: Doc<"jobs">;
    escrowId?: Id<"escrows">;
    actorWallet: string;
    actorWalletType?: TWalletType;
  },
) {
  if (!requiresAcceptedAgreement(input.job)) return;
  const agreement = await getActiveAgreementByJob(ctx, input.job._id);
  if (agreement && ACCEPTED_STATUSES.has(agreement.status)) return;
  const message = getAgreementGuardMessage(agreement?.status);
  await recordAgreementGuardBlockedAction(ctx, {
    jobId: input.job._id,
    ...(input.escrowId ? { escrowId: input.escrowId } : {}),
    actorWallet: input.actorWallet,
    ...(input.actorWalletType ? { actorWalletType: input.actorWalletType } : {}),
    action: "work_start",
    message,
  });
  throw new ForbiddenError(message);
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
  content?: IAgreementRichTextInput;
  metadata?: unknown;
}) {
  const richText = normalizeAgreementRichText(input.content);
  return {
    ...(input.title !== undefined ? { title: sanitizeTitle(input.title) } : {}),
    ...(input.contentMarkdown !== undefined
      ? { contentMarkdown: optionalNonEmptyString(input.contentMarkdown, "contentMarkdown") }
      : {}),
    ...(richText ? richText : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
}
