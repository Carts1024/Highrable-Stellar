// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { cloneElement, createElement, isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  IAdminDisputeDetail,
  IAdminDisputeListItem,
  IAdminDisputesResponse,
  TAdminResolutionRequest,
  TAdminResolutionSucceededResult,
  IAdminSessionResponse,
  TAdminReviewStatus,
} from "./types";
import type { TAttachmentUploaderWallet } from "@/features/attachments/types";
import type {
  TParticipantAgreementContextQueryResult,
  TParticipantCreateDisputeArgs,
  TParticipantDisputePermissionQueryResult,
  TParticipantDisputeQueryResult,
  TParticipantDisputeResponsePermissionQueryResult,
  TParticipantDisputeTimelineQueryResult,
  TParticipantAddDisputeEvidenceArgs,
} from "@/features/disputes/types";
import type { TConvexDoc, TConvexId, TConvexStorageId } from "@repo/convex-client";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const runtime = vi.hoisted(() => ({
  activeWalletContext: "client" as "admin" | "client" | "freelancer" | "unauthorized",
  wallets: {
    admin: { address: `G${"A".repeat(55)}`, walletType: "external_wallet" as const },
    client: { address: `G${"C".repeat(55)}`, walletType: "external_wallet" as const },
    freelancer: { address: `G${"F".repeat(55)}`, walletType: "external_wallet" as const },
    unauthorized: { address: `G${"U".repeat(55)}`, walletType: "external_wallet" as const },
  },
  convex: {
    subscriptions: new Map<string, unknown>(),
    calls: [] as Array<{ readonly name: string; readonly args: unknown }>,
    mutationCalls: [] as Array<{ readonly name: string; readonly args: unknown[] }>,
    returnedDisputeIds: [] as string[],
    mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  },
  stellar: {
    markDisputedOnChain: vi.fn(),
    resolveDisputeOnChain: vi.fn(),
  },
  upload: { fetches: 0 },
}));

vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => {
    const current = runtime.wallets[runtime.activeWalletContext];
    return {
      address: current.address,
      authSession: null,
      authenticateWallet: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      logoutWallet: vi.fn(),
      signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
      walletState: {
        status: "connected",
        walletAddress: current.address,
        isConnected: true,
        isConnecting: false,
        isTestnet: true,
        canWriteContracts: true,
        network: "testnet",
      },
    };
  },
}));

vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => {
    const current = runtime.wallets[runtime.activeWalletContext];
    return {
      walletAddress: current.address,
      walletType: current.walletType,
      activeWalletMode: current.walletType,
      isConnected: true,
    } satisfies {
      readonly walletAddress: string;
      readonly walletType: TAttachmentUploaderWallet["walletType"];
      readonly activeWalletMode: string;
      readonly isConnected: boolean;
    };
  },
}));

vi.mock("@/core/wallet/config", () => ({
  isWalletOnConfiguredNetwork: () => true,
  getWalletNetworkMismatchMessage: () => "Wrong network.",
}));

vi.mock("@/core/config/stellar-contracts", () => ({
  getRequiredAdminContractConfig: () => ({
    rpcUrl: "https://rpc.test",
    network: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowContractId: `C${"A".repeat(55)}`,
  }),
  getRequiredEscrowActionConfig: () => ({
    rpcUrl: "https://rpc.test",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowContractId: `C${"A".repeat(55)}`,
  }),
}));

vi.mock("@/core/stellar/escrow-contract", () => ({
  isDisputeAdminOnChain: vi.fn().mockResolvedValue(true),
  markDisputedOnChain: runtime.stellar.markDisputedOnChain,
  resolveDisputeOnChain: runtime.stellar.resolveDisputeOnChain,
}));
vi.mock("@/core/stellar/explorer", () => ({
  getTxExplorerUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
}));
vi.mock("@/core/stellar/hashes", () => ({ toBytesN32Hash: vi.fn() }));
vi.mock("@/core/stellar/passkeySmartAccountExecutor", () => ({
  getPasskeyEscrowExecutionReadiness: vi.fn(),
}));
vi.mock("@/core/stellar/transaction", () => ({
  isPendingStellarTransactionError: () => false,
  normalizeStellarError: (error: unknown) => (error instanceof Error ? error.message : "Error"),
}));

vi.mock("@repo/convex-client", () => ({
  api: {
    admin: {
      listAdminDisputes: "admin.listAdminDisputes",
      getAdminDispute: "admin.getAdminDispute",
      changeDisputeReviewStatus: "admin.changeDisputeReviewStatus",
      listDisputeAdmins: "admin.listDisputeAdmins",
    },
    disputes: {
      canOpenDispute: "disputes.canOpenDispute",
      canViewDispute: "disputes.canViewDispute",
      createDispute: "disputes.createDispute",
      getDispute: "disputes.getDispute",
      getDisputeTimeline: "disputes.getDisputeTimeline",
      canRespondToDispute: "disputes.canRespondToDispute",
      addDisputeEvidence: "disputes.addDisputeEvidence",
      addDisputeResponse: "disputes.addDisputeResponse",
      markDisputeOnChainStarted: "disputes.markDisputeOnChainStarted",
      markDisputeOnChainSucceeded: "disputes.markDisputeOnChainSucceeded",
      markDisputeOnChainFailed: "disputes.markDisputeOnChainFailed",
    },
    attachments: {
      generateUploadUrl: "attachments.generateUploadUrl",
      saveUploadedAttachment: "attachments.saveUploadedAttachment",
      createExternalAttachment: "attachments.createExternalAttachment",
      softDelete: "attachments.softDelete",
      recordDownloadAttempt: "attachments.recordDownloadAttempt",
    },
    escrows: { updateEscrowStatus: "escrows.updateEscrowStatus" },
    milestones: { updateMilestoneEscrowStatus: "milestones.updateMilestoneEscrowStatus" },
    transactions: {
      createTransaction: "transactions.createTransaction",
      updateTransactionStatus: "transactions.updateTransactionStatus",
    },
    work_agreements: {
      getAgreementContextForDispute: "work_agreements.getAgreementContextForDispute",
    },
    work_submissions: {
      getLatestSubmissionForEscrow: "work_submissions.getLatestSubmissionForEscrow",
    },
    revisions: { getRevisionRequestsByParent: "revisions.getRevisionRequestsByParent" },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => {
    runtime.convex.calls.push({ name, args });
    if (args === "skip") return undefined;
    return runtime.convex.subscriptions.get(queryKey(name, args));
  },
  useMutation: (name: string) => {
    const existing = runtime.convex.mutations.get(name);
    if (existing) return existing;
    const mutation = vi.fn((...args: unknown[]) => {
      runtime.convex.mutationCalls.push({ name, args });
      const result = handleConvexMutation(name, args[0]);
      if (name === "disputes.createDispute") {
        return result.then((value) => {
          runtime.convex.returnedDisputeIds.push(String(value));
          return value;
        });
      }
      return result;
    });
    runtime.convex.mutations.set(name, mutation);
    return mutation;
  },
}));

vi.mock("@/features/common", async () => ({
  ...(await vi.importActual<object>("@/features/common/components/section-card")),
  ...(await vi.importActual<object>("@/features/common/components/stat-card")),
  ...(await vi.importActual<object>("@/features/common/components/wallet-address-tile")),

  ProductPageHero: ({ title }: { readonly title: ReactNode }) =>
    createElement("h1", undefined, title),
  RouteCallout: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", { role: "alert" }, children),
  RouteEmptyState: ({ description }: { readonly description: ReactNode }) =>
    createElement("p", undefined, description),
  RoutePanel: ({ children }: { readonly children?: ReactNode }) =>
    createElement("section", undefined, children),
  RoutePanelHeader: ({
    title,
    description,
  }: {
    readonly title: string;
    readonly description: string;
  }) => createElement("header", undefined, createElement("h1", undefined, title), description),
  sanitizeMultilineInput: (value: string) => value,
  showWarningToast: vi.fn(),
}));

vi.mock("@/features/attachments/protected-viewer", () => ({
  AttachmentProtectionBadge: () => null,
  ProtectedAttachmentDialog: () => null,
}));

vi.mock("@/features/work-agreements/components", () => ({ AgreementReferenceCard: () => null }));

vi.mock("@repo/ui/components/highrable/v2-marketing", () => ({
  HighrableV2Badge: ({ children }: { readonly children?: ReactNode }) =>
    createElement("span", undefined, children),
  HighrableV2Bullet: () => createElement("span"),
  HighrableV2IconNotice: ({ label }: { readonly label: string }) =>
    createElement("span", { "aria-label": label }),
  HighrableV2Metric: ({ label, value }: { readonly label: string; readonly value: ReactNode }) =>
    createElement("div", undefined, `${label}: ${value}`),
  SectionLabel: ({ children }: { readonly children?: ReactNode }) =>
    createElement("span", undefined, children),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { readonly asChild?: boolean }) =>
    asChild && isValidElement(children)
      ? cloneElement(children, props)
      : createElement("button", props, children),
}));
vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => createElement("input", props),
}));
vi.mock("@repo/ui/components/ui/label", () => ({
  Label: ({ children, ...props }: { readonly children?: ReactNode; readonly htmlFor?: string }) =>
    createElement("label", props, children),
}));
vi.mock("@repo/ui/components/ui/native-select", () => ({
  NativeSelect: (props: Record<string, unknown>) => createElement("select", props),
  NativeSelectOption: ({ children, ...props }: { readonly children?: ReactNode }) =>
    createElement("option", props, children),
}));
vi.mock("@repo/ui/components/ui/textarea", () => ({
  Textarea: (props: Record<string, unknown>) => createElement("textarea", props),
}));
vi.mock("@repo/ui/components/ui/badge", () => ({
  Badge: ({ children, ...props }: { readonly children?: ReactNode }) =>
    createElement("span", props, children),
}));
vi.mock("@repo/ui/components/ui/select", () => ({
  Select: ({ children }: { readonly children?: ReactNode }) => createElement("div", null, children),
  SelectContent: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", null, children),
  SelectItem: ({ children, ...props }: { readonly children?: ReactNode }) =>
    createElement("span", props, children),
  SelectTrigger: ({ children, ...props }: { readonly children?: ReactNode }) =>
    createElement("button", props, children),
  SelectValue: ({ placeholder }: { readonly placeholder?: string }) =>
    createElement("span", null, placeholder),
}));
vi.mock("@repo/ui/components/ui/switch", () => ({
  Switch: ({ checked, disabled, onCheckedChange, ...props }: Record<string, unknown>) =>
    createElement("input", {
      ...props,
      type: "checkbox",
      checked,
      disabled,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        (onCheckedChange as ((value: boolean) => void) | undefined)?.(event.target.checked),
    }),
}));
vi.mock("@repo/ui/responsive-dialog", () => ({
  ResponsiveDialog: ({
    open,
    children,
  }: {
    readonly open: boolean;
    readonly children?: ReactNode;
  }) => (open ? children : null),
  ResponsiveDialogContent: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", { role: "dialog" }, children),
  ResponsiveDialogBody: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", undefined, children),
  ResponsiveDialogDescription: ({ children }: { readonly children?: ReactNode }) =>
    createElement("p", undefined, children),
  ResponsiveDialogHeader: ({ children }: { readonly children?: ReactNode }) =>
    createElement("header", undefined, children),
  ResponsiveDialogTitle: ({ children }: { readonly children?: ReactNode }) =>
    createElement("h2", undefined, children),
}));
vi.mock("lucide-react", () => {
  const Icon = (props: Record<string, unknown>) => createElement("span", props);
  return {
    Activity: Icon,
    Users: Icon,
    CheckCircle2: Icon,
    Clock: Icon,
    Scale: Icon,
    History: Icon,
    Paperclip: Icon,
    Wallet: Icon,
    Copy: Icon,
    Check: Icon,
    AlertTriangle: Icon,
    ArrowLeft: Icon,
    Download: Icon,
    ExternalLink: Icon,
    File: Icon,
    FileArchive: Icon,
    FileText: Icon,
    Image: Icon,
    Link2: Icon,
    Loader2: Icon,
    RotateCcw: Icon,
    ShieldCheck: Icon,
    Trash2: Icon,
    Upload: Icon,
    Video: Icon,
  };
});
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    readonly href: string;
    readonly children?: ReactNode;
  }) => createElement("a", { href, ...props }, children),
}));

import { DisputeDetailPanel } from "@/features/disputes/components/dispute-detail-panel";
import { OpenDisputeButton } from "@/features/disputes/components/open-dispute-button";
import { formatDisputeDate } from "@/features/disputes/lib";

import { AdminDisputeDetailPage } from "./admin-dispute-detail-page";
import { AdminDisputesPage } from "./admin-disputes-page";

type TCanonicalCase = TConvexDoc<"disputes">;
type TCanonicalEvent = TConvexDoc<"disputeEvents">;
type TCanonicalAttachment = TConvexDoc<"attachments">;
type TParticipantDispute = NonNullable<TParticipantDisputeQueryResult>;
type TParticipantEvent = TParticipantDisputeTimelineQueryResult[number];
type TAdminEvent = IAdminDisputeDetail["timeline"][number];
type TSerializedAttachment = TCanonicalAttachment & {
  readonly url: string | null;
  readonly protection: {
    readonly mode: "standard";
    readonly isProtected: false;
    readonly previewAllowed: true;
    readonly downloadAllowed: true;
    readonly watermarkEnabled: false;
    readonly accessLoggingEnabled: false;
    readonly viewerRole: null;
    readonly previewSupported: true;
    readonly downloadRestricted: false;
    readonly protectedReason: null;
    readonly notice: null;
  };
};

type TParentFixture = {
  readonly parentType: "micro_gig" | "milestone";
  readonly parentId: string;
  readonly job: TConvexDoc<"jobs">;
  readonly milestone: TConvexDoc<"milestones"> | null;
  readonly escrow: TConvexDoc<"escrows">;
  readonly openedByWallet: string;
};

type TStore = {
  readonly cases: Map<string, TCanonicalCase>;
  readonly events: Map<string, TCanonicalEvent[]>;
  readonly attachments: Map<string, TCanonicalAttachment>;
  nextCase: number;
  nextEvent: number;
  nextAttachment: number;
};

type THttpRuntime = {
  sessionMode: "authorized" | "unauthorized" | "forbidden";
  statusMode: "accepted" | "forbidden";
  createMode: "accepted" | "rejected" | "pending";
  evidenceMode: "accepted" | "rejected" | "pending";
  resolutionMode: "accepted" | "pending" | "failed" | "rejected" | "malformed";
  pendingCreateResolve: ((value: TConvexId<"disputes">) => void) | null;
  pendingEvidenceResolve: (() => void) | null;
  pendingResolution: {
    readonly disputeId: string;
    readonly operationId: string;
    readonly status: TAdminResolutionSucceededResult["status"];
    readonly freelancerShareBps: number;
    transactionHash: string | null;
  } | null;
  resolutionResult: TAdminResolutionSucceededResult | null;
  resolutionRequests: TAdminResolutionRequest[];
  statusRequests: Array<{ readonly status: TAdminReviewStatus; readonly message?: string }>;
  claimRequests: string[];
};

let store: TStore;
let httpRuntime: THttpRuntime;
let activeFixture: TParentFixture;
const fixturesByParent = new Map<string, TParentFixture>();
let uploadOwnerRole: "client" | "freelancer" = "client";

const BASE_TIME = 1_700_000_000_000;
const ADMIN_WALLET = `G${"A".repeat(55)}`;

function syntheticId<
  TTable extends "disputes" | "disputeEvents" | "attachments" | "jobs" | "milestones" | "escrows",
>(_table: TTable, value: string): TConvexId<TTable> {
  return value as TConvexId<TTable>;
}

function syntheticStorageId(value: string): TConvexStorageId {
  return value as TConvexStorageId;
}

function queryKey(name: string, args: unknown): string {
  return `${name}:${JSON.stringify(args)}`;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createJob(
  id: string,
  title: string,
  jobType: "micro_gig" | "milestone_project",
): TConvexDoc<"jobs"> {
  return {
    _id: syntheticId("jobs", id),
    _creationTime: BASE_TIME,
    title,
    description: `${title} description`,
    budget: jobType === "micro_gig" ? 100 : 500,
    asset: "USDC",
    jobType,
    ...(jobType === "milestone_project" ? { totalBudget: 500, milestoneCount: 1 } : {}),
    clientWallet: runtime.wallets.client.address,
    selectedFreelancerWallet: runtime.wallets.freelancer.address,
    status: "funded",
    jobHash: `${id}-hash`,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  } satisfies TConvexDoc<"jobs">;
}

function createFixture(
  parentType: "micro_gig" | "milestone",
  openedBy: "client" | "freelancer",
  suffix: string,
): TParentFixture {
  const job = createJob(
    `${suffix}-job`,
    `${parentType === "micro_gig" ? "Micro-gig" : "Milestone project"} ${suffix}`,
    parentType === "micro_gig" ? "micro_gig" : "milestone_project",
  );
  const milestone =
    parentType === "milestone"
      ? ({
          _id: syntheticId("milestones", `${suffix}-milestone`),
          _creationTime: BASE_TIME,
          jobId: job._id,
          order: 1,
          title: `Milestone ${suffix}`,
          description: `Milestone ${suffix} description`,
          amount: 500,
          asset: "USDC",
          status: "disputed",
          assignedFreelancerWallet: runtime.wallets.freelancer.address,
          escrowId: `${suffix}-chain-escrow`,
          createdAt: BASE_TIME,
          updatedAt: BASE_TIME,
        } satisfies TConvexDoc<"milestones">)
      : null;
  const escrow = {
    _id: syntheticId("escrows", `${suffix}-escrow`),
    _creationTime: BASE_TIME,
    jobId: job._id,
    ...(milestone ? { milestoneId: milestone._id } : {}),
    escrowId: `${suffix}-chain-escrow`,
    clientWallet: runtime.wallets.client.address,
    freelancerWallet: runtime.wallets.freelancer.address,
    amount: parentType === "micro_gig" ? 100 : 500,
    asset: "USDC",
    status: "funded",
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  } satisfies TConvexDoc<"escrows">;

  return {
    parentType,
    parentId: milestone?._id ?? job._id,
    job,
    milestone,
    escrow,
    openedByWallet: runtime.wallets[openedBy].address,
  };
}

function resetHarness(fixture = createFixture("micro_gig", "client", "primary")): void {
  store = {
    cases: new Map(),
    events: new Map(),
    attachments: new Map(),
    nextCase: 1,
    nextEvent: 1,
    nextAttachment: 1,
  };
  httpRuntime = {
    sessionMode: "authorized",
    statusMode: "accepted",
    createMode: "accepted",
    evidenceMode: "accepted",
    resolutionMode: "accepted",
    pendingCreateResolve: null,
    pendingEvidenceResolve: null,
    pendingResolution: null,
    resolutionResult: null,
    resolutionRequests: [],
    statusRequests: [],
    claimRequests: [],
  };
  activeFixture = fixture;
  fixturesByParent.clear();
  fixturesByParent.set(fixture.parentId, fixture);
  uploadOwnerRole =
    fixture.openedByWallet === runtime.wallets.client.address ? "client" : "freelancer";
  runtime.activeWalletContext = uploadOwnerRole;
  runtime.convex.subscriptions.clear();
  runtime.convex.calls.length = 0;
  runtime.convex.mutationCalls.length = 0;
  runtime.convex.returnedDisputeIds.length = 0;
  runtime.convex.mutations.clear();
  runtime.stellar.markDisputedOnChain.mockReset().mockResolvedValue({ txHash: "a".repeat(64) });
  runtime.stellar.resolveDisputeOnChain.mockReset();
  runtime.upload.fetches = 0;
}

function projectAttachment(attachment: TCanonicalAttachment): TSerializedAttachment {
  return {
    ...attachment,
    url: `https://files.example.test/${attachment.name}`,
    protection: {
      mode: "standard",
      isProtected: false,
      previewAllowed: true,
      downloadAllowed: true,
      watermarkEnabled: false,
      accessLoggingEnabled: false,
      viewerRole: null,
      previewSupported: true,
      downloadRestricted: false,
      protectedReason: null,
      notice: null,
    },
  };
}

function getCase(disputeId: string): TCanonicalCase {
  const dispute = store.cases.get(disputeId);
  if (!dispute) throw new Error(`Missing test case ${disputeId}`);
  return dispute;
}

function appendEvent(disputeId: string, event: TCanonicalEvent): void {
  const events = store.events.get(disputeId) ?? [];
  store.events.set(disputeId, [...events, event]);
}

function createEvent(
  disputeId: string,
  input: Omit<TCanonicalEvent, "_id" | "_creationTime" | "disputeId">,
): TCanonicalEvent {
  const id = syntheticId("disputeEvents", `c19-event-${store.nextEvent++}`);
  return {
    _id: id,
    _creationTime: BASE_TIME + store.nextEvent,
    disputeId: syntheticId("disputes", disputeId),
    ...input,
  };
}

function createAttachment(input: {
  readonly name: string;
  readonly type: "pdf" | "document";
  readonly wallet: string;
  readonly ownerRole: "client" | "freelancer";
}): TCanonicalAttachment {
  const id = syntheticId("attachments", `c19-attachment-${store.nextAttachment++}`);
  const attachment = {
    _id: id,
    _creationTime: BASE_TIME + store.nextAttachment,
    storageId: syntheticStorageId(`c19-storage-${store.nextAttachment}`),
    type: input.type,
    name: input.name,
    size: 1024,
    mimeType: input.type === "pdf" ? "application/pdf" : "application/msword",
    uploadedByWallet: input.wallet,
    uploadedByWalletType: "external_wallet",
    ownerRole: input.ownerRole,
    parentType: "unknown",
    visibility: "private",
    status: "active",
    protectionMode: "standard",
    downloadAllowed: true,
    previewAllowed: true,
    watermarkEnabled: false,
    accessLoggingEnabled: false,
    createdAt: BASE_TIME + store.nextAttachment,
    updatedAt: BASE_TIME + store.nextAttachment,
  } satisfies TCanonicalAttachment;
  store.attachments.set(String(id), attachment);
  return attachment;
}

function createCaseFromArgs(args: TParticipantCreateDisputeArgs): TConvexId<"disputes"> {
  const fixture = activeFixture;
  fixturesByParent.set(fixture.parentId, fixture);
  const disputeId = syntheticId("disputes", `c19-case-${store.nextCase++}`);
  const now = BASE_TIME + store.nextCase * 1000;
  const caseRecord = {
    _id: disputeId,
    _creationTime: now,
    disputeNumber: `DSP-C19-${store.nextCase}`,
    parentType: args.parentType,
    parentId: args.parentId,
    jobId: fixture.job._id,
    ...(args.parentType === "micro_gig" ? { microGigId: fixture.job._id } : {}),
    ...(fixture.milestone ? { milestoneId: fixture.milestone._id } : {}),
    escrowId: fixture.escrow._id,
    onChainEscrowId: fixture.escrow.escrowId,
    escrowContractId: args.escrowContractId,
    clientWallet: runtime.wallets.client.address,
    clientWalletType: "external_wallet",
    freelancerWallet: runtime.wallets.freelancer.address,
    freelancerWalletType: "external_wallet",
    openedByWallet: args.openedByWallet,
    openedByWalletType: args.openedByWalletType,
    openedByRole: args.openedByWallet === runtime.wallets.client.address ? "client" : "freelancer",
    reasonCategory: args.reasonCategory,
    title: args.title,
    description: args.description,
    evidenceAttachmentIds: args.evidenceAttachmentIds ?? [],
    relatedWorkSubmissionIds: args.relatedWorkSubmissionIds ?? [],
    relatedRevisionRequestIds: args.relatedRevisionRequestIds ?? [],
    status: "open",
    onChainStatus: "not_marked",
    openedAt: now,
    createdAt: now,
    updatedAt: now,
  } satisfies TCanonicalCase;
  store.cases.set(String(disputeId), caseRecord);
  for (const attachmentId of caseRecord.evidenceAttachmentIds) {
    const attachment = store.attachments.get(String(attachmentId));
    if (attachment) {
      store.attachments.set(String(attachmentId), {
        ...attachment,
        parentType: "dispute",
        parentId: String(disputeId),
        visibility: "participants",
        updatedAt: now,
      });
    }
  }
  appendEvent(
    String(disputeId),
    createEvent(String(disputeId), {
      type: "dispute_opened",
      actorWallet: args.openedByWallet,
      actorWalletType: args.openedByWalletType,
      actorRole: caseRecord.openedByRole,
      message: `${caseRecord.openedByRole === "client" ? "Client" : "Freelancer"} opened this dispute.`,
      attachmentIds: caseRecord.evidenceAttachmentIds,
      newStatus: "open",
      createdAt: now,
      metadata: { source: "participant-opening", title: args.title },
    }),
  );
  return disputeId;
}

function addEvidenceFromArgs(args: TParticipantAddDisputeEvidenceArgs): void {
  const current = getCase(String(args.disputeId));
  const now = current.updatedAt + 100;
  const attachmentIds = args.attachmentIds;
  store.cases.set(String(current._id), {
    ...current,
    evidenceAttachmentIds: Array.from(
      new Set([...current.evidenceAttachmentIds, ...attachmentIds]),
    ),
    updatedAt: now,
  });
  for (const attachmentId of attachmentIds) {
    const attachment = store.attachments.get(String(attachmentId));
    if (attachment) {
      store.attachments.set(String(attachmentId), {
        ...attachment,
        parentType: "dispute",
        parentId: String(current._id),
        visibility: "participants",
        updatedAt: now,
      });
    }
  }
  appendEvent(
    String(current._id),
    createEvent(String(current._id), {
      type: "evidence_added",
      actorWallet: args.actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole: args.actorWallet === current.clientWallet ? "client" : "freelancer",
      message: args.message ?? "Participant added dispute evidence.",
      attachmentIds,
      createdAt: now,
      metadata: { source: "participant-evidence", attachmentCount: attachmentIds.length },
    }),
  );
}

function handleConvexMutation(name: string, rawArgs: unknown): Promise<unknown> {
  if (name === "attachments.generateUploadUrl")
    return Promise.resolve("https://storage.test/upload");
  if (name === "attachments.saveUploadedAttachment") {
    const args = rawArgs as {
      readonly name: string;
      readonly type: "pdf" | "document";
      readonly uploadedByWallet: string;
      readonly ownerRole: "client" | "freelancer";
    };
    const attachment = createAttachment({
      name: args.name,
      type: args.type,
      wallet: args.uploadedByWallet,
      ownerRole: args.ownerRole,
    });
    return Promise.resolve(attachment._id);
  }
  if (name === "attachments.createExternalAttachment") {
    const args = rawArgs as {
      readonly name: string;
      readonly uploadedByWallet: string;
      readonly ownerRole: "client" | "freelancer";
      readonly type: "link" | "video_link";
    };
    const attachment = createAttachment({
      name: args.name,
      type: "document",
      wallet: args.uploadedByWallet,
      ownerRole: args.ownerRole,
    });
    return Promise.resolve(attachment._id);
  }
  if (name === "attachments.recordDownloadAttempt") return Promise.resolve({ url: null });
  if (name === "attachments.softDelete") return Promise.resolve(true);
  if (name === "disputes.createDispute") {
    if (httpRuntime.createMode === "rejected")
      return Promise.reject(new Error("Opening rejected."));
    if (httpRuntime.createMode === "pending") {
      return new Promise<TConvexId<"disputes">>((resolve) => {
        httpRuntime.pendingCreateResolve = resolve;
      });
    }
    return Promise.resolve(createCaseFromArgs(rawArgs as TParticipantCreateDisputeArgs));
  }
  if (name === "disputes.addDisputeEvidence") {
    if (httpRuntime.evidenceMode === "rejected")
      return Promise.reject(new Error("Evidence rejected."));
    if (httpRuntime.evidenceMode === "pending") {
      return new Promise<void>((resolve) => {
        httpRuntime.pendingEvidenceResolve = () => {
          addEvidenceFromArgs(rawArgs as TParticipantAddDisputeEvidenceArgs);
          resolve();
        };
      });
    }
    addEvidenceFromArgs(rawArgs as TParticipantAddDisputeEvidenceArgs);
    return Promise.resolve(true);
  }
  if (name === "disputes.markDisputeOnChainStarted") {
    const args = rawArgs as { readonly disputeId: TConvexId<"disputes"> };
    const current = getCase(String(args.disputeId));
    store.cases.set(String(args.disputeId), { ...current, onChainStatus: "marking" });
    return Promise.resolve(true);
  }
  if (name === "disputes.markDisputeOnChainSucceeded") {
    const args = rawArgs as {
      readonly disputeId: TConvexId<"disputes">;
      readonly transactionHash: string;
      readonly stellarExpertUrl: string;
    };
    const current = getCase(String(args.disputeId));
    store.cases.set(String(args.disputeId), {
      ...current,
      onChainStatus: "marked",
      transactionHash: args.transactionHash,
      stellarExpertUrl: args.stellarExpertUrl,
      markedDisputedAt: current.updatedAt + 1,
      updatedAt: current.updatedAt + 1,
    });
    return Promise.resolve(true);
  }
  if (name === "disputes.markDisputeOnChainFailed") return Promise.resolve(true);
  return Promise.resolve(true);
}

function serializeParticipantCase(dispute: TCanonicalCase): TParticipantDispute {
  return {
    ...dispute,
    attachments: dispute.evidenceAttachmentIds
      .map((id) => store.attachments.get(String(id)))
      .filter((attachment): attachment is TCanonicalAttachment => attachment !== undefined)
      .map(projectAttachment),
  } satisfies TParticipantDispute;
}

function serializeParticipantEvent(event: TCanonicalEvent): TParticipantEvent {
  return {
    ...event,
    attachments: event.attachmentIds
      .map((id) => store.attachments.get(String(id)))
      .filter((attachment): attachment is TCanonicalAttachment => attachment !== undefined)
      .map(projectAttachment),
  } satisfies TParticipantEvent;
}

function projectAdminEvent(event: TCanonicalEvent): TAdminEvent {
  return {
    ...event,
    attachments: event.attachmentIds
      .map((id) => store.attachments.get(String(id)))
      .filter((attachment): attachment is TCanonicalAttachment => attachment !== undefined)
      .map(projectAttachment),
  } satisfies TAdminEvent;
}

function projectAdminDetail(disputeId: string): IAdminDisputeDetail {
  const dispute = getCase(disputeId);
  const fixture = fixturesByParent.get(dispute.parentId) ?? fixtureForCase(dispute);
  return {
    dispute: {
      ...dispute,
      attachments: dispute.evidenceAttachmentIds
        .map((id) => store.attachments.get(String(id)))
        .filter((attachment): attachment is TCanonicalAttachment => attachment !== undefined)
        .map(projectAttachment),
    },
    timeline: (store.events.get(disputeId) ?? []).map(projectAdminEvent),
    assignmentEvents: [],
    settlementAttempts: [],
    job: fixture.job,
    milestone: fixture.milestone,
    escrow: { ...fixture.escrow, status: "disputed" },
  } satisfies IAdminDisputeDetail;
}

function fixtureForCase(dispute: TCanonicalCase): TParentFixture {
  return createFixture(
    dispute.parentType === "milestone" ? "milestone" : "micro_gig",
    dispute.openedByRole,
    dispute.disputeNumber.toLowerCase(),
  );
}

function projectQueueItem(dispute: TCanonicalCase): IAdminDisputeListItem {
  return {
    disputeId: dispute._id,
    disputeNumber: dispute.disputeNumber,
    title: dispute.title,
    status: dispute.status,
    onChainStatus: dispute.onChainStatus,
    reasonCategory: dispute.reasonCategory,
    clientWallet: dispute.clientWallet,
    freelancerWallet: dispute.freelancerWallet,
    openedAt: dispute.openedAt,
    updatedAt: dispute.updatedAt,
    assignedAdminWallet: dispute.assignedAdminWallet,
    assignedAt: dispute.assignedAt,
  } satisfies IAdminDisputeListItem;
}

function setParticipantSubscription(disputeId: string, viewerWallet: string): void {
  const dispute = getCase(disputeId);
  const role = dispute.clientWallet === viewerWallet ? "client" : "freelancer";
  const args = { disputeId: dispute._id, viewerWallet };
  const responseArgs = { disputeId: dispute._id, walletAddress: viewerWallet };
  runtime.convex.subscriptions.set(queryKey("disputes.canViewDispute", args), {
    allowed: true,
    reason: null,
    role,
  } satisfies TParticipantDisputePermissionQueryResult);
  runtime.convex.subscriptions.set(
    queryKey("disputes.getDispute", args),
    serializeParticipantCase(dispute),
  );
  runtime.convex.subscriptions.set(
    queryKey("work_agreements.getAgreementContextForDispute", args),
    null satisfies TParticipantAgreementContextQueryResult,
  );
  runtime.convex.subscriptions.set(queryKey("disputes.canRespondToDispute", responseArgs), {
    allowed: true,
    reason: null,
    role,
  } satisfies TParticipantDisputeResponsePermissionQueryResult);
  runtime.convex.subscriptions.set(
    queryKey("disputes.getDisputeTimeline", args),
    (store.events.get(disputeId) ?? []).map(serializeParticipantEvent),
  );
}

function publishParticipantSubscriptions(): void {
  for (const disputeId of store.cases.keys()) {
    setParticipantSubscription(disputeId, runtime.wallets.client.address);
    setParticipantSubscription(disputeId, runtime.wallets.freelancer.address);
  }
}

function installHttpMock(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://storage.test/upload") {
      runtime.upload.fetches += 1;
      return Promise.resolve(response({ storageId: `storage-${runtime.upload.fetches}` }));
    }
    if (url === "/api/admin/session") {
      if (httpRuntime.sessionMode === "unauthorized") {
        return Promise.resolve(response({ error: "Admin authentication required." }, 401));
      }
      if (httpRuntime.sessionMode === "forbidden") {
        return Promise.resolve(response({ error: "Admin access forbidden." }, 403));
      }
      return Promise.resolve(
        response({
          adminWallet: ADMIN_WALLET,
          isOwner: false,
          isDisputeAdmin: true,
        } satisfies IAdminSessionResponse),
      );
    }
    if (url === "/api/admin/disputes" || url.startsWith("/api/admin/disputes?")) {
      const payload: IAdminDisputesResponse = {
        disputes: Array.from(store.cases.values()).map(projectQueueItem),
      };
      return Promise.resolve(response(payload));
    }
    const detailMatch = url.match(/^\/api\/admin\/disputes\/([^/]+)$/);
    if (detailMatch) {
      return Promise.resolve(
        response(projectAdminDetail(decodeURIComponent(detailMatch[1] ?? ""))),
      );
    }
    const resolutionMatch = url.match(/^\/api\/admin\/disputes\/([^/]+)\/resolve$/);
    if (resolutionMatch) {
      const disputeId = decodeURIComponent(resolutionMatch[1] ?? "");
      const body = JSON.parse(String(init?.body)) as TAdminResolutionRequest;
      httpRuntime.resolutionRequests.push(body);

      if (body.phase === "started") {
        if (httpRuntime.resolutionMode === "rejected") {
          return Promise.resolve(response({ error: "Settlement start rejected." }, 409));
        }
        httpRuntime.pendingResolution = {
          disputeId,
          operationId: body.operationId,
          status: body.status,
          freelancerShareBps: body.freelancerShareBps,
          transactionHash: null,
        };
        return Promise.resolve(
          response({
            success: true,
            phase: "started",
            result: { operationId: body.operationId, freelancerShareBps: body.freelancerShareBps },
          }),
        );
      }

      if (body.phase === "signed") {
        if (httpRuntime.pendingResolution) {
          httpRuntime.pendingResolution.transactionHash = body.transactionHash;
        }
        return Promise.resolve(
          response({
            success: true,
            phase: "signed",
            result: { operationId: body.operationId, transactionHash: body.transactionHash },
          }),
        );
      }

      if (body.phase === "failed") {
        return Promise.resolve(response({ success: true, phase: "failed", result: true }));
      }

      if (body.phase === "reconcile") {
        return Promise.resolve(
          response({ status: "pending", result: { status: "submission_unknown" } }, 202),
        );
      }

      if (httpRuntime.resolutionMode === "pending") {
        return Promise.resolve(
          response({ status: "pending", result: { status: "submission_unknown" } }, 202),
        );
      }
      if (httpRuntime.resolutionMode === "failed") {
        return Promise.resolve(response({ status: "failed", result: { status: "failed" } }, 409));
      }
      if (httpRuntime.resolutionMode === "malformed") {
        return Promise.resolve(
          response({ status: "succeeded", result: { status: "resolved_client" } }),
        );
      }

      const pending = httpRuntime.pendingResolution;
      if (!pending?.transactionHash) {
        return Promise.resolve(
          response({ status: "pending", result: { status: "submission_unknown" } }, 202),
        );
      }
      const result =
        httpRuntime.resolutionResult ??
        ({
          status: pending.status,
          freelancerShareBps: pending.freelancerShareBps,
          freelancerPayoutAmount: 123,
          clientRefundAmount: 456,
          resolutionTxHash: pending.transactionHash,
          resolutionStellarExpertUrl: `https://stellar.expert/explorer/testnet/tx/${pending.transactionHash}`,
        } satisfies TAdminResolutionSucceededResult);
      const current = getCase(disputeId);
      const now = current.updatedAt + 40;
      store.cases.set(disputeId, {
        ...current,
        status: result.status,
        resolutionTxHash: result.resolutionTxHash,
        resolutionStellarExpertUrl: result.resolutionStellarExpertUrl,
        resolvedByWallet: ADMIN_WALLET,
        freelancerShareBps: result.freelancerShareBps,
        freelancerPayoutAmount: result.freelancerPayoutAmount,
        clientRefundAmount: result.clientRefundAmount,
        resolvedAt: now,
        updatedAt: now,
      });
      appendEvent(
        disputeId,
        createEvent(disputeId, {
          type: result.status,
          actorWallet: ADMIN_WALLET,
          actorWalletType: "external_wallet",
          actorRole: "moderator",
          message: `Administrator recorded ${result.status} settlement.`,
          attachmentIds: [],
          oldStatus: current.status,
          newStatus: result.status,
          transactionHash: result.resolutionTxHash,
          createdAt: now,
          metadata: {
            source: "administrator-settlement",
            moderatorWallet: ADMIN_WALLET,
            freelancerPayoutAmount: result.freelancerPayoutAmount,
            clientRefundAmount: result.clientRefundAmount,
          },
        }),
      );
      return Promise.resolve(response({ status: "succeeded", result }));
    }
    const claimMatch = url.match(/^\/api\/admin\/disputes\/([^/]+)\/claim$/);
    if (claimMatch) {
      const disputeId = decodeURIComponent(claimMatch[1] ?? "");
      httpRuntime.claimRequests.push(disputeId);
      const current = getCase(disputeId);
      store.cases.set(disputeId, {
        ...current,
        assignedAdminWallet: ADMIN_WALLET,
        assignedAt: current.updatedAt + 10,
        assignedByWallet: ADMIN_WALLET,
        updatedAt: current.updatedAt + 10,
      });
      return Promise.resolve(response({ assignedAdminWallet: ADMIN_WALLET }));
    }
    const statusMatch = url.match(/^\/api\/admin\/disputes\/([^/]+)\/status$/);
    if (statusMatch) {
      const disputeId = decodeURIComponent(statusMatch[1] ?? "");
      const body = JSON.parse(String(init?.body)) as {
        readonly status: TAdminReviewStatus;
        readonly message?: string;
      };
      httpRuntime.statusRequests.push(body);
      if (httpRuntime.statusMode === "forbidden") {
        return Promise.resolve(response({ error: "Review permission was revoked." }, 403));
      }
      const current = getCase(disputeId);
      const message =
        body.message ?? `Dispute status changed to ${body.status.replaceAll("_", " ")}.`;
      store.cases.set(disputeId, {
        ...current,
        status: body.status,
        updatedAt: current.updatedAt + 20,
      });
      appendEvent(
        disputeId,
        createEvent(disputeId, {
          type: "status_changed",
          actorWallet: ADMIN_WALLET,
          actorWalletType: "external_wallet",
          actorRole: "moderator",
          message,
          attachmentIds: [],
          oldStatus: current.status,
          newStatus: body.status,
          createdAt: current.updatedAt + 20,
          metadata: { source: "administrator-review", moderatorWallet: ADMIN_WALLET },
        }),
      );
      return Promise.resolve(response({ success: true }));
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
}

function renderOpening(fixture: TParentFixture) {
  activeFixture = fixture;
  runtime.activeWalletContext =
    fixture.openedByWallet === runtime.wallets.client.address ? "client" : "freelancer";
  const viewerWallet = fixture.openedByWallet;
  runtime.convex.subscriptions.set(
    queryKey("disputes.canOpenDispute", {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: viewerWallet,
    }),
    {
      allowed: true,
      reason: null,
      openedByRole: viewerWallet === runtime.wallets.client.address ? "client" : "freelancer",
      escrowId: fixture.escrow._id,
      onChainEscrowId: fixture.escrow.escrowId,
    },
  );
  runtime.convex.subscriptions.set(
    queryKey("work_submissions.getLatestSubmissionForEscrow", {
      onChainEscrowId: fixture.escrow.escrowId,
      viewerWallet,
    }),
    null,
  );
  runtime.convex.subscriptions.set(
    queryKey("revisions.getRevisionRequestsByParent", {
      parentType: fixture.milestone ? "milestone" : "micro_gig",
      parentId: fixture.milestone?._id ?? fixture.job._id,
      viewerWallet,
    }),
    [],
  );
  return render(
    createElement(OpenDisputeButton, {
      job: fixture.job,
      milestone: fixture.milestone ?? undefined,
      escrow: fixture.escrow,
      parentType: fixture.parentType,
      parentId: fixture.parentId,
    }),
  );
}

function renderAdminQueue(queryClient = createQueryClient()) {
  runtime.activeWalletContext = "admin";
  return render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(AdminDisputesPage)),
  );
}

function renderAdminDetail(disputeId: string, queryClient = createQueryClient()) {
  runtime.activeWalletContext = "admin";
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AdminDisputeDetailPage, { disputeId }),
    ),
  );
}

function renderParticipant(viewer: "client" | "freelancer", disputeId: string) {
  runtime.activeWalletContext = viewer;
  publishParticipantSubscriptions();
  return render(createElement(DisputeDetailPanel, { disputeId }));
}

function seedSettlementCase(fixture: TParentFixture, suffix: string): string {
  activeFixture = fixture;
  const disputeId = createCaseFromArgs({
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.openedByWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "work_not_delivered",
    title: `${fixture.parentType} C23 settlement ${suffix}`,
    description: `C23 settlement case for ${fixture.parentType}.`,
    evidenceAttachmentIds: [],
    relatedWorkSubmissionIds: [],
    relatedRevisionRequestIds: [],
    escrowContractId: `C${"A".repeat(55)}`,
  });
  const current = getCase(String(disputeId));
  store.cases.set(String(disputeId), {
    ...current,
    status: "under_review",
    onChainStatus: "marked",
    assignedAdminWallet: ADMIN_WALLET,
    assignedAt: current.updatedAt + 5,
    assignedByWallet: ADMIN_WALLET,
    updatedAt: current.updatedAt + 5,
  });
  publishParticipantSubscriptions();
  return String(disputeId);
}

function setAdminResolution(
  scope: HTMLElement,
  status: TAdminResolutionSucceededResult["status"],
  freelancerShareBps: number,
): void {
  const resolution = within(scope).getByLabelText("Resolution");
  fireEvent.change(resolution, { target: { value: status } });
  if (status === "split_resolution") {
    fireEvent.change(within(scope).getByLabelText("Freelancer share in basis points"), {
      target: { value: String(freelancerShareBps) },
    });
  }
}

function getUploadInput(scope: HTMLElement): HTMLInputElement {
  const dropzone = within(scope).getByRole("button", { name: "Upload attachments" });
  const input = dropzone.querySelector("input[type=file]");
  if (!(input instanceof HTMLInputElement)) throw new Error("Expected a file input.");
  return input;
}

async function uploadFile(scope: HTMLElement, name: string): Promise<void> {
  fireEvent.change(getUploadInput(scope), {
    target: { files: [new File(["C19 evidence"], name, { type: "application/pdf" })] },
  });
  await waitFor(() => expect(runtime.upload.fetches).toBeGreaterThan(0));
  await waitFor(() => {
    const attachment = Array.from(store.attachments.values()).find((item) => item.name === name);
    expect(attachment?.status).toBe("active");
  });
}

async function openAcceptedCase(
  fixture: TParentFixture,
): Promise<{ readonly disputeId: string; readonly view: ReturnType<typeof renderOpening> }> {
  const view = renderOpening(fixture);
  fireEvent.click(within(view.container).getByRole("button", { name: "Open Dispute" }));
  const dialog = await within(view.container).findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Title" }), {
    target: { value: `${fixture.parentType} C19 title` },
  });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Description" }), {
    target: { value: `Evidence for ${fixture.parentType} C19 case.` },
  });
  await uploadFile(dialog, `${fixture.parentType}-opening.pdf`);
  const openingAttachment = Array.from(store.attachments.values()).find(
    (attachment) => attachment.name === `${fixture.parentType}-opening.pdf`,
  );
  if (!openingAttachment) throw new Error("Expected the accepted opening attachment.");
  fireEvent.click(within(dialog).getByRole("button", { name: "Open Dispute" }));
  await waitFor(() => expect(store.cases.size).toBeGreaterThan(0));
  const disputeId = Array.from(store.cases.keys()).at(-1);
  if (!disputeId) throw new Error("Expected the accepted case ID.");
  expect(
    runtime.convex.mutationCalls.filter(({ name }) => name === "disputes.createDispute").at(-1)
      ?.args[0],
  ).toEqual({
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.openedByWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "work_quality_issue",
    title: `${fixture.parentType} C19 title`,
    description: `Evidence for ${fixture.parentType} C19 case.`,
    evidenceAttachmentIds: [openingAttachment._id],
    escrowContractId: `C${"A".repeat(55)}`,
  });
  expect(runtime.convex.returnedDisputeIds.at(-1)).toBe(disputeId);
  await waitFor(() => expect(within(view.container).queryByRole("dialog")).toBeNull());
  publishParticipantSubscriptions();
  return { disputeId, view };
}

async function addParticipantEvidence(
  disputeId: string,
  viewer: "client" | "freelancer",
  name: string,
  message: string,
): Promise<void> {
  const participant = renderParticipant(viewer, disputeId);
  const evidenceForm = within(participant.container)
    .getByRole("textbox", { name: "Note (optional)" })
    .closest("form");
  if (!evidenceForm) throw new Error("Expected the participant evidence form.");
  await uploadFile(evidenceForm, name);
  fireEvent.change(within(evidenceForm).getByRole("textbox", { name: "Note (optional)" }), {
    target: { value: message },
  });
  fireEvent.submit(evidenceForm);
  await waitFor(() =>
    expect(
      runtime.convex.mutationCalls.filter(
        ({ name: callName }) => callName === "disputes.addDisputeEvidence",
      ),
    ).not.toHaveLength(0),
  );
  const evidenceAttachment = Array.from(store.attachments.values()).find(
    (attachment) => attachment.name === name,
  );
  if (!evidenceAttachment) throw new Error("Expected the accepted evidence attachment.");
  expect(runtime.convex.mutationCalls.at(-1)?.args[0]).toEqual({
    disputeId: syntheticId("disputes", disputeId),
    actorWallet: runtime.wallets[viewer].address,
    actorWalletType: "external_wallet",
    attachmentIds: [evidenceAttachment._id],
    message,
  });
  participant.unmount();
  publishParticipantSubscriptions();
}

describe("C19 participant-to-administrator acceptance", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    resetHarness();
    installHttpMock();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    runtime.activeWalletContext = "client";
  });

  it("connects client micro-gig and freelancer milestone openings to isolated administrator evidence", async () => {
    const first = await openAcceptedCase(createFixture("micro_gig", "client", "micro"));
    await addParticipantEvidence(
      first.disputeId,
      "client",
      "micro-follow-up.pdf",
      "Micro-gig follow-up evidence.",
    );
    first.view.unmount();

    const second = await openAcceptedCase(createFixture("milestone", "freelancer", "milestone"));
    second.view.unmount();

    expect(store.cases).toHaveProperty("size", 2);
    const queue = renderAdminQueue();
    expect(await within(queue.container).findByText("micro_gig C19 title")).toBeTruthy();
    expect(within(queue.container).getByText("milestone C19 title")).toBeTruthy();
    const reviewLinks = within(queue.container).getAllByRole("link", { name: "Review" });
    expect(reviewLinks).toHaveLength(2);
    expect(reviewLinks.map((link) => link.getAttribute("href"))).toEqual([
      `/admin/disputes/${first.disputeId}`,
      `/admin/disputes/${second.disputeId}`,
    ]);
    queue.unmount();

    const firstDetail = renderAdminDetail(first.disputeId);
    expect(await within(firstDetail.container).findAllByText("micro_gig-opening.pdf")).toHaveLength(
      2,
    );
    expect(within(firstDetail.container).getAllByText("micro-follow-up.pdf")).toHaveLength(2);
    expect(firstDetail.container.textContent).toContain("Micro-gig · micro-job");
    expect(firstDetail.container.textContent).toContain(runtime.wallets.client.address);
    expect(within(firstDetail.container).getByText("Micro-gig follow-up evidence.")).toBeTruthy();
    expect(
      within(firstDetail.container)
        .getAllByRole("link", { name: "Open micro_gig-opening.pdf" })
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "https://files.example.test/micro_gig-opening.pdf",
      "https://files.example.test/micro_gig-opening.pdf",
    ]);
    expect(
      within(firstDetail.container).getAllByRole("list", { name: "Evidence attachments" }),
    ).toHaveLength(3);
    const firstTimeline = store.events.get(first.disputeId) ?? [];
    expect(firstTimeline.find((event) => event.type === "dispute_opened")?.attachmentIds).toEqual([
      syntheticId("attachments", "c19-attachment-1"),
    ]);
    expect(firstTimeline.find((event) => event.type === "evidence_added")?.attachmentIds).toEqual([
      syntheticId("attachments", "c19-attachment-2"),
    ]);
    firstDetail.unmount();

    const secondDetail = renderAdminDetail(second.disputeId);
    expect(
      await within(secondDetail.container).findAllByText("milestone-opening.pdf"),
    ).toHaveLength(2);
    expect(within(secondDetail.container).queryAllByText("micro-follow-up.pdf")).toHaveLength(0);
    expect(secondDetail.container.textContent).toContain("Milestone · milestone-milestone");
    expect(secondDetail.container.textContent).toContain(runtime.wallets.freelancer.address);
    expect(
      (store.events.get(second.disputeId) ?? []).every((event) =>
        event.attachmentIds.every((id) => String(id) !== "c19-attachment-2"),
      ),
    ).toBe(true);
    secondDetail.unmount();
  });

  it("claims a participant-opened case, accepts under_review, and publishes exact review identity to both participants", async () => {
    const opened = await openAcceptedCase(createFixture("milestone", "freelancer", "review"));
    opened.view.unmount();
    const queue = renderAdminQueue();
    const reviewLink = await within(queue.container).findByRole("link", { name: "Review" });
    expect(reviewLink.getAttribute("href")).toBe(`/admin/disputes/${opened.disputeId}`);
    queue.unmount();

    const admin = renderAdminDetail(opened.disputeId);
    expect(await within(admin.container).findByText("Claim Case")).toBeTruthy();
    fireEvent.click(within(admin.container).getByRole("button", { name: "Claim Case" }));
    expect(await within(admin.container).findByText("Case claimed.")).toBeTruthy();
    expect(httpRuntime.claimRequests).toEqual([opened.disputeId]);
    expect(getCase(opened.disputeId).assignedAdminWallet).toBe(ADMIN_WALLET);

    fireEvent.change(within(admin.container).getByLabelText("Review status"), {
      target: { value: "under_review" },
    });
    fireEvent.change(within(admin.container).getByLabelText("Optional review message"), {
      target: { value: "Moderator verified the milestone evidence." },
    });
    fireEvent.click(within(admin.container).getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(httpRuntime.statusRequests).toHaveLength(1));
    expect(httpRuntime.statusRequests[0]).toEqual({
      status: "under_review",
      message: "Moderator verified the milestone evidence.",
    });
    expect(await within(admin.container).findByText("Dispute review status updated.")).toBeTruthy();
    const saved = getCase(opened.disputeId);
    const events = store.events.get(opened.disputeId) ?? [];
    expect(saved.status).toBe("under_review");
    expect(events[0]?.type).toBe("dispute_opened");
    expect(events.at(-1)).toMatchObject({
      disputeId: syntheticId("disputes", opened.disputeId),
      actorWallet: ADMIN_WALLET,
      actorWalletType: "external_wallet",
      actorRole: "moderator",
      message: "Moderator verified the milestone evidence.",
      oldStatus: "open",
      newStatus: "under_review",
    });
    const markingCallsBeforeReview = runtime.convex.mutationCalls.filter(({ name }) =>
      name.includes("markDisputeOnChain"),
    ).length;
    const stellarCallsBeforeReview = runtime.stellar.markDisputedOnChain.mock.calls.length;

    publishParticipantSubscriptions();
    admin.unmount();
    const client = renderParticipant("client", opened.disputeId);
    expect(await within(client.container).findByText("Under Review", { exact: true })).toBeTruthy();
    expect(
      within(client.container).getByText("Moderator verified the milestone evidence."),
    ).toBeTruthy();
    expect(within(client.container).getByText("Dispute admin · " + ADMIN_WALLET)).toBeTruthy();
    expect(within(client.container).getByText("Status: Open", { exact: true })).toBeTruthy();
    expect(
      within(client.container).getByRole("list", { name: "Dispute evidence timeline" }),
    ).toBeTruthy();
    client.unmount();

    const freelancer = renderParticipant("freelancer", opened.disputeId);
    expect(
      await within(freelancer.container).findByText("Under Review", { exact: true }),
    ).toBeTruthy();
    expect(
      within(freelancer.container).getByText("Moderator verified the milestone evidence."),
    ).toBeTruthy();
    expect(within(freelancer.container).getByText("milestone C19 title")).toBeTruthy();
    freelancer.unmount();
    expect(
      runtime.convex.mutationCalls.filter(({ name }) => name.includes("markDisputeOnChain")),
    ).toHaveLength(markingCallsBeforeReview);
    expect(runtime.stellar.markDisputedOnChain.mock.calls).toHaveLength(stellarCallsBeforeReview);
  });

  it("closes protected access and evicts cached case data after a 403 review write without publishing changes", async () => {
    const opened = await openAcceptedCase(createFixture("micro_gig", "client", "denied"));
    opened.view.unmount();
    const adminQueryClient = createQueryClient();
    const admin = renderAdminDetail(opened.disputeId, adminQueryClient);
    await within(admin.container).findByText("Claim Case");
    fireEvent.click(within(admin.container).getByRole("button", { name: "Claim Case" }));
    await within(admin.container).findByText("Case claimed.");
    const beforeCase = getCase(opened.disputeId);
    const beforeEvents = [...(store.events.get(opened.disputeId) ?? [])];
    const beforeSubscriptions = JSON.stringify(Array.from(runtime.convex.subscriptions.entries()));
    httpRuntime.statusMode = "forbidden";
    fireEvent.change(within(admin.container).getByLabelText("Review status"), {
      target: { value: "under_review" },
    });
    fireEvent.click(within(admin.container).getByRole("button", { name: "Update Status" }));
    expect(
      await within(admin.container).findByRole("heading", { name: "Admin access forbidden" }),
    ).toBeTruthy();
    expect(within(admin.container).queryByText("Moderator workflow")).toBeNull();
    expect(getCase(opened.disputeId)).toEqual(beforeCase);
    expect(store.events.get(opened.disputeId)).toEqual(beforeEvents);
    expect(JSON.stringify(Array.from(runtime.convex.subscriptions.entries()))).toBe(
      beforeSubscriptions,
    );
    await waitFor(() =>
      expect(
        adminQueryClient.getQueryCache().findAll({ queryKey: ["admin", "dispute"] }),
      ).toHaveLength(0),
    );
    admin.unmount();
    const participant = renderParticipant("client", opened.disputeId);
    expect(within(participant.container).getByText("Open", { exact: true })).toBeTruthy();
    expect(within(participant.container).queryByText("Under Review", { exact: true })).toBeNull();
    participant.unmount();
  });

  it.each([
    ["unauthorized", 401, "Authentication required"],
    ["forbidden", 403, "Admin access forbidden"],
  ] as const)("prevents protected queue reads for a %s session", async (mode, status, heading) => {
    httpRuntime.sessionMode = mode;
    const fetchMock = installHttpMock();
    const queue = renderAdminQueue();
    expect(await within(queue.container).findByRole("heading", { name: heading })).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).startsWith("/api/admin/disputes"))
        .length,
    ).toBe(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/session",
      expect.objectContaining({ method: "GET" }),
    );
    expect(status).toBeGreaterThanOrEqual(401);
    queue.unmount();
  });

  it("keeps rejected creation and evidence drafts retryable, and pending duplicate submissions write once", async () => {
    const fixture = createFixture("micro_gig", "client", "rejections");
    httpRuntime.createMode = "rejected";
    const opening = renderOpening(fixture);
    fireEvent.click(within(opening.container).getByRole("button", { name: "Open Dispute" }));
    const dialog = await within(opening.container).findByRole("dialog");
    const title = within(dialog).getByRole("textbox", { name: "Title" });
    const description = within(dialog).getByRole("textbox", { name: "Description" });
    fireEvent.change(title, { target: { value: "Retriable opening" } });
    fireEvent.change(description, { target: { value: "Keep this draft after rejection." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Open Dispute" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("Opening rejected.");
    expect((title as HTMLInputElement).value).toBe("Retriable opening");
    expect((description as HTMLTextAreaElement).value).toBe("Keep this draft after rejection.");
    expect(store.cases).toHaveProperty("size", 0);
    opening.unmount();

    httpRuntime.createMode = "pending";
    const pendingOpening = renderOpening(fixture);
    fireEvent.click(within(pendingOpening.container).getByRole("button", { name: "Open Dispute" }));
    const pendingDialog = await within(pendingOpening.container).findByRole("dialog");
    fireEvent.change(within(pendingDialog).getByRole("textbox", { name: "Title" }), {
      target: { value: "Pending opening" },
    });
    fireEvent.change(within(pendingDialog).getByRole("textbox", { name: "Description" }), {
      target: { value: "Pending duplicate test." },
    });
    const pendingButton = within(pendingDialog).getByRole("button", { name: "Open Dispute" });
    const createCallsBeforePending = runtime.convex.mutationCalls.filter(
      ({ name }) => name === "disputes.createDispute",
    ).length;
    fireEvent.click(pendingButton);
    fireEvent.click(pendingButton);
    await waitFor(() =>
      expect(
        runtime.convex.mutationCalls.filter(({ name }) => name === "disputes.createDispute"),
      ).toHaveLength(createCallsBeforePending + 1),
    );
    expect(store.cases).toHaveProperty("size", 0);
    pendingOpening.unmount();

    resetHarness(fixture);
    installHttpMock();
    const accepted = await openAcceptedCase(fixture);
    const participant = renderParticipant("client", accepted.disputeId);
    const evidenceForm = within(participant.container)
      .getByRole("textbox", { name: "Note (optional)" })
      .closest("form");
    if (!evidenceForm) throw new Error("Expected evidence form.");
    await uploadFile(evidenceForm, "rejected-follow-up.pdf");
    fireEvent.change(within(evidenceForm).getByRole("textbox", { name: "Note (optional)" }), {
      target: { value: "Retry this evidence." },
    });
    httpRuntime.evidenceMode = "rejected";
    fireEvent.submit(evidenceForm);
    expect((await within(evidenceForm).findByRole("alert")).textContent).toContain(
      "Evidence rejected.",
    );
    expect(within(evidenceForm).getByText("rejected-follow-up.pdf")).toBeTruthy();
    expect(
      (store.events.get(accepted.disputeId) ?? []).filter(
        (event) => event.type === "evidence_added",
      ),
    ).toHaveLength(0);
    participant.unmount();
    publishParticipantSubscriptions();

    const pendingParticipant = renderParticipant("client", accepted.disputeId);
    const pendingForm = within(pendingParticipant.container)
      .getByRole("textbox", { name: "Note (optional)" })
      .closest("form");
    if (!pendingForm) throw new Error("Expected pending evidence form.");
    await uploadFile(pendingForm, "pending-follow-up.pdf");
    fireEvent.change(within(pendingForm).getByRole("textbox", { name: "Note (optional)" }), {
      target: { value: "Pending duplicate evidence." },
    });
    httpRuntime.evidenceMode = "pending";
    const evidenceCallsBeforePending = runtime.convex.mutationCalls.filter(
      ({ name }) => name === "disputes.addDisputeEvidence",
    ).length;
    fireEvent.submit(pendingForm);
    fireEvent.submit(pendingForm);
    await waitFor(() =>
      expect(
        runtime.convex.mutationCalls.filter(({ name }) => name === "disputes.addDisputeEvidence"),
      ).toHaveLength(evidenceCallsBeforePending + 1),
    );
    expect(
      (store.events.get(accepted.disputeId) ?? []).filter(
        (event) => event.type === "evidence_added",
      ),
    ).toHaveLength(0);
    await act(async () => {
      httpRuntime.pendingEvidenceResolve?.();
    });
    pendingParticipant.unmount();
    publishParticipantSubscriptions();
    expect(
      (store.events.get(accepted.disputeId) ?? []).filter(
        (event) => event.type === "evidence_added",
      ),
    ).toHaveLength(1);
  });

  it("renders participant evidence and timeline from the same wallet-scoped subscriptions", async () => {
    const opened = await openAcceptedCase(createFixture("micro_gig", "client", "participant"));
    await addParticipantEvidence(
      opened.disputeId,
      "freelancer",
      "freelancer-response.pdf",
      "Freelancer response evidence.",
    );
    opened.view.unmount();
    const participant = renderParticipant("freelancer", opened.disputeId);
    expect(
      await within(participant.container).findAllByText("freelancer-response.pdf"),
    ).toHaveLength(2);
    expect(within(participant.container).getByText("Freelancer response evidence.")).toBeTruthy();
    expect(within(participant.container).getByText("Evidence added")).toBeTruthy();
    expect(
      within(participant.container).getAllByText(
        formatDisputeDate(getCase(opened.disputeId).updatedAt),
      ),
    ).toHaveLength(3);
    expect(
      within(participant.container).getByRole("list", { name: "Dispute evidence timeline" }),
    ).toBeTruthy();
    participant.unmount();
  });
});

describe("C23 administrator resolution-result contract", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    resetHarness();
    installHttpMock();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    runtime.activeWalletContext = "client";
  });

  it.each([
    ["micro_gig", "resolved_client", 0, 12.34, 87.66, "1"],
    ["micro_gig", "resolved_freelancer", 10_000, 98.76, 1.24, "2"],
    ["micro_gig", "split_resolution", 4_321, 43.21, 56.79, "3"],
    ["milestone", "resolved_client", 0, 111.11, 388.89, "4"],
    ["milestone", "resolved_freelancer", 10_000, 499.99, 0.01, "5"],
    ["milestone", "split_resolution", 6_789, 321.09, 178.91, "6"],
  ] as const)(
    "publishes %s %s results to both participants after accepted recording",
    async (
      parentType,
      status,
      freelancerShareBps,
      freelancerPayoutAmount,
      clientRefundAmount,
      digit,
    ) => {
      const fixture = createFixture(parentType, "client", `c23-${parentType}-${digit}`);
      const disputeId = seedSettlementCase(fixture, digit);
      const resolutionTxHash = digit.repeat(64);
      const result = {
        status,
        freelancerShareBps,
        freelancerPayoutAmount,
        clientRefundAmount,
        resolutionTxHash,
        resolutionStellarExpertUrl: `https://stellar.expert/explorer/testnet/tx/${resolutionTxHash}`,
      } satisfies TAdminResolutionSucceededResult;
      httpRuntime.resolutionResult = result;
      runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
        async (args: {
          readonly onSigned: (value: {
            readonly transactionHash: string;
            readonly transactionValidUntil: number;
          }) => Promise<void>;
        }) => {
          await args.onSigned({ transactionHash: resolutionTxHash, transactionValidUntil: 123 });
          return { txHash: resolutionTxHash };
        },
      );

      const admin = renderAdminDetail(disputeId);
      await within(admin.container).findByRole("button", { name: "Resolve On-Chain" });
      setAdminResolution(admin.container, status, freelancerShareBps);
      fireEvent.click(within(admin.container).getByRole("button", { name: "Resolve On-Chain" }));
      expect(
        await within(admin.container).findByText(
          "Dispute settlement was verified on Stellar and recorded.",
        ),
      ).toBeTruthy();

      expect(httpRuntime.resolutionRequests.map((request) => request.phase)).toEqual([
        "started",
        "signed",
        "succeeded",
      ]);
      expect(getCase(disputeId)).toMatchObject({
        status,
        resolutionTxHash,
        resolutionStellarExpertUrl: result.resolutionStellarExpertUrl,
        resolvedByWallet: ADMIN_WALLET,
        freelancerShareBps,
        freelancerPayoutAmount,
        clientRefundAmount,
      });
      expect(projectAdminDetail(disputeId).dispute).toMatchObject(result);

      publishParticipantSubscriptions();
      const client = renderParticipant("client", disputeId);
      const expectedStatus =
        status === "resolved_client"
          ? "Resolved: Client"
          : status === "resolved_freelancer"
            ? "Resolved: Freelancer"
            : "Split Resolution";
      expect(await within(client.container).findByText(expectedStatus)).toBeTruthy();
      expect(within(client.container).getByText("Dispute opened")).toBeTruthy();
      expect(within(client.container).getByText(expectedStatus)).toBeTruthy();
      expect(within(client.container).getByText(new RegExp(ADMIN_WALLET))).toBeTruthy();
      expect(
        within(client.container).getByRole("link", { name: resolutionTxHash }).getAttribute("href"),
      ).toBe(result.resolutionStellarExpertUrl);
      expect(
        within(client.container).getByRole("list", { name: "Dispute evidence timeline" }).children,
      ).toHaveLength(2);
      client.unmount();

      const freelancer = renderParticipant("freelancer", disputeId);
      expect(await within(freelancer.container).findByText(expectedStatus)).toBeTruthy();
      expect(within(freelancer.container).getByText(new RegExp(ADMIN_WALLET))).toBeTruthy();
      expect(
        within(freelancer.container)
          .getByRole("link", { name: resolutionTxHash })
          .getAttribute("href"),
      ).toBe(result.resolutionStellarExpertUrl);
      expect(
        within(freelancer.container).getByRole("list", { name: "Dispute evidence timeline" })
          .children,
      ).toHaveLength(2);
      freelancer.unmount();
      admin.unmount();
    },
  );

  it.each(["pending", "failed", "rejected", "malformed"] as const)(
    "does not fabricate participant terminal state for %s settlement results",
    async (resolutionMode) => {
      const fixture = createFixture("micro_gig", "client", `c23-${resolutionMode}`);
      const disputeId = seedSettlementCase(fixture, resolutionMode);
      httpRuntime.resolutionMode = resolutionMode;
      runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
        async (args: {
          readonly onSigned: (value: {
            readonly transactionHash: string;
            readonly transactionValidUntil: number;
          }) => Promise<void>;
        }) => {
          const transactionHash = "f".repeat(64);
          await args.onSigned({ transactionHash, transactionValidUntil: 123 });
          return { txHash: transactionHash };
        },
      );

      const admin = renderAdminDetail(disputeId);
      await within(admin.container).findByRole("button", { name: "Resolve On-Chain" });
      fireEvent.click(within(admin.container).getByRole("button", { name: "Resolve On-Chain" }));
      await waitFor(() => expect(httpRuntime.resolutionRequests.length).toBeGreaterThan(0));
      await waitFor(() => expect(getCase(disputeId).status).toBe("under_review"));

      expect(getCase(disputeId).resolutionTxHash).toBeUndefined();
      expect(
        (store.events.get(disputeId) ?? []).some((event) =>
          ["resolved_client", "resolved_freelancer", "split_resolution"].includes(event.type),
        ),
      ).toBe(false);
      publishParticipantSubscriptions();
      const client = renderParticipant("client", disputeId);
      const freelancer = renderParticipant("freelancer", disputeId);
      expect(await within(client.container).findByText("Under Review")).toBeTruthy();
      expect(await within(freelancer.container).findByText("Under Review")).toBeTruthy();
      expect(within(client.container).queryByText("Resolved: Client")).toBeNull();
      expect(within(client.container).queryByText("Resolved: Freelancer")).toBeNull();
      expect(within(client.container).queryByText("Split Resolution")).toBeNull();
      expect(within(freelancer.container).queryByText("Resolved: Client")).toBeNull();
      expect(within(freelancer.container).queryByText("Resolved: Freelancer")).toBeNull();
      expect(within(freelancer.container).queryByText("Split Resolution")).toBeNull();
      client.unmount();
      freelancer.unmount();
      admin.unmount();
    },
  );
});
