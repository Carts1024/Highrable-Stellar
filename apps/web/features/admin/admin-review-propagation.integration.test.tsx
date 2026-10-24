// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { cloneElement, createElement, isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  IAdminDisputeDetail,
  IAdminSessionResponse,
  TAdminReviewStatus,
} from "@/features/admin/types";
import type {
  TParticipantAgreementContextQueryResult,
  TParticipantDisputePermissionQueryResult,
  TParticipantDisputeQueryResult,
  TParticipantDisputeResponsePermissionQueryResult,
  TParticipantDisputeTimelineQueryResult,
} from "@/features/disputes/types";
import type { TDisputeStatus } from "@/features/disputes/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const runtime = vi.hoisted(() => ({
  activeWalletContext: "admin" as "admin" | "client" | "freelancer",
  wallets: {
    admin: {
      address: `G${"A".repeat(55)}`,
      walletType: "external_wallet" as const,
    },
    client: {
      address: `G${"C".repeat(55)}`,
      walletType: "external_wallet" as const,
    },
    freelancer: {
      address: `G${"F".repeat(55)}`,
      walletType: "external_wallet" as const,
    },
  },
  protectedApiError: vi.fn(),
  logoutWallet: vi.fn(),
  authenticateWallet: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  convex: {
    subscriptions: new Map<string, unknown>(),
    calls: [] as Array<{ readonly name: string; readonly args: unknown }>,
    mutationCalls: [] as Array<{ readonly name: string; readonly args: unknown[] }>,
    mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  },
  stellar: {
    markDisputedOnChain: vi.fn(),
    resolveDisputeOnChain: vi.fn(),
  },
}));

vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => {
    const current = runtime.wallets[runtime.activeWalletContext];
    return {
      address: current.address,
      authSession: null,
      authenticateWallet: runtime.authenticateWallet,
      logoutWallet: runtime.logoutWallet,
      signTransaction: vi.fn(),
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
      recordDisputeResolutionStarted: "admin.recordDisputeResolutionStarted",
      recordDisputeResolutionSigned: "admin.recordDisputeResolutionSigned",
      recordDisputeResolutionFailed: "admin.recordDisputeResolutionFailed",
      recordDisputeResolutionSubmissionUnknown: "admin.recordDisputeResolutionSubmissionUnknown",
      recordDisputeResolutionSucceeded: "admin.recordDisputeResolutionSucceeded",
      listDisputeAdmins: "admin.listDisputeAdmins",
      getAdminDashboardMetrics: "admin.getAdminDashboardMetrics",
    },
    disputes: {
      canViewDispute: "disputes.canViewDispute",
      getDispute: "disputes.getDispute",
      getDisputeTimeline: "disputes.getDisputeTimeline",
      canRespondToDispute: "disputes.canRespondToDispute",
      markDisputeOnChainStarted: "disputes.markDisputeOnChainStarted",
      markDisputeOnChainSucceeded: "disputes.markDisputeOnChainSucceeded",
      markDisputeOnChainFailed: "disputes.markDisputeOnChainFailed",
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
      return Promise.resolve(true);
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

vi.mock("@/features/admin/components/admin-operations-ui", () => ({
  AdminSection: ({ title, children }: { readonly title: string; readonly children?: ReactNode }) =>
    createElement("section", undefined, createElement("h2", undefined, title), children),
}));

vi.mock("@/features/admin/admin-evidence-list", () => ({
  AdminEvidenceList: () => null,
}));

vi.mock("@/features/disputes/components/dispute-participant-actions", () => ({
  DisputeParticipantActions: () => null,
}));

vi.mock("@/features/attachments/components", () => ({
  AttachmentList: () => null,
}));
vi.mock("@/features/work-agreements/components", () => ({
  AgreementReferenceCard: () => null,
}));

vi.mock("@repo/ui/components/highrable/v2-marketing", () => ({
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
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly asChild?: boolean;
  }) =>
    asChild && isValidElement(children)
      ? cloneElement(children, props)
      : createElement("button", props, children),
}));
vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => createElement("input", props),
}));
vi.mock("@repo/ui/components/ui/native-select", () => ({
  NativeSelect: (props: Record<string, unknown>) => createElement("select", props),
  NativeSelectOption: ({ children, ...props }: { readonly children?: ReactNode }) =>
    createElement("option", props, children),
}));
vi.mock("@repo/ui/components/ui/textarea", () => ({
  Textarea: (props: Record<string, unknown>) => createElement("textarea", props),
}));
vi.mock("lucide-react", () => ({
  Activity: () => createElement("span"),
  AlertTriangle: () => createElement("span"),
  CheckCircle2: () => createElement("span"),
  Clock: () => createElement("span"),
  FileText: () => createElement("span"),
  Users: () => createElement("span"),
  History: () => createElement("span"),
  Paperclip: () => createElement("span"),
  Scale: () => createElement("span"),
  Wallet: () => createElement("span"),
  Copy: () => createElement("span"),
  Check: () => createElement("span"),
  ArrowLeft: () => createElement("span"),
  ExternalLink: () => createElement("span"),
  RotateCcw: () => createElement("span"),
  RefreshCw: () => createElement("span"),
}));
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
import { formatDisputeDate } from "@/features/disputes/lib";

import { AdminDisputeDetailPage } from "./admin-dispute-detail-page";

type TCanonicalCase = TConvexDoc<"disputes">;
type TCanonicalEvent = TConvexDoc<"disputeEvents">;
type TParticipantDispute = NonNullable<TParticipantDisputeQueryResult>;
type TParticipantTimelineEvent = TParticipantDisputeTimelineQueryResult[number];
type TAdminTimelineEvent = IAdminDisputeDetail["timeline"][number];

type TScenario = {
  readonly parentType: "micro_gig" | "milestone";
  readonly initialStatus: TDisputeStatus;
  readonly nextStatus: TAdminReviewStatus;
  readonly message?: string;
};

type THttpMode = "normal" | "pending" | "rejected" | "unauthorized" | "forbidden";

type THttpRuntime = {
  mode: THttpMode;
  refreshAvailable: boolean;
  pendingResolve: ((response: Response) => void) | null;
  statusRequests: Array<{ readonly status: TAdminReviewStatus; readonly message?: string }>;
  adminDetails: IAdminDisputeDetail[];
  detailReads: number;
};

let currentCase: TCanonicalCase;
let currentTimeline: TCanonicalEvent[];
let httpRuntime: THttpRuntime;

function syntheticId<
  TTable extends "disputes" | "disputeEvents" | "jobs" | "milestones" | "escrows",
>(value: string): TConvexId<TTable> {
  return value as TConvexId<TTable>;
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

function createCanonicalCase(scenario: TScenario): TCanonicalCase {
  const caseSuffix = scenario.parentType === "micro_gig" ? "micro" : "milestone";
  const parentId =
    scenario.parentType === "micro_gig" ? `micro-gig-${caseSuffix}` : `milestone-${caseSuffix}`;

  return {
    _id: syntheticId("case-review-propagation"),
    _creationTime: 1_700_000_000_000,
    disputeNumber: `DSP-C15-${caseSuffix.toUpperCase()}`,
    parentType: scenario.parentType,
    parentId,
    clientWallet: runtime.wallets.client.address,
    clientWalletType: "external_wallet",
    freelancerWallet: runtime.wallets.freelancer.address,
    freelancerWalletType: "external_wallet",
    openedByWallet:
      scenario.parentType === "micro_gig"
        ? runtime.wallets.client.address
        : runtime.wallets.freelancer.address,
    openedByWalletType: "external_wallet",
    openedByRole: scenario.parentType === "micro_gig" ? "client" : "freelancer",
    reasonCategory: "work_not_delivered",
    title: `${caseSuffix} review propagation case`,
    description: `Canonical ${caseSuffix} dispute fixture.`,
    evidenceAttachmentIds: [],
    relatedWorkSubmissionIds: [],
    relatedRevisionRequestIds: [],
    status: scenario.initialStatus,
    onChainStatus: "marked",
    onChainEscrowId: `on-chain-${caseSuffix}`,
    assignedAdminWallet: runtime.wallets.admin.address,
    assignedAt: 1_700_000_000_100,
    assignedByWallet: runtime.wallets.admin.address,
    openedAt: 1_700_000_000_200,
    createdAt: 1_700_000_000_200,
    updatedAt: 1_700_000_000_200,
  } satisfies TCanonicalCase;
}

function createOpeningEvent(scenario: TScenario): TCanonicalEvent {
  return {
    _id: syntheticId("opening-event-c15"),
    _creationTime: 1_700_000_000_300,
    disputeId: currentCase._id,
    type: "dispute_opened",
    actorWallet:
      scenario.parentType === "micro_gig"
        ? runtime.wallets.client.address
        : runtime.wallets.freelancer.address,
    actorWalletType: "external_wallet",
    actorRole: scenario.parentType === "micro_gig" ? "client" : "freelancer",
    message: "The participant opened this dispute.",
    attachmentIds: [],
    createdAt: 1_700_000_000_300,
  } satisfies TCanonicalEvent;
}

function createStatusEvent(
  oldStatus: TDisputeStatus,
  nextStatus: TAdminReviewStatus,
  message: string,
): TCanonicalEvent {
  return {
    _id: syntheticId("status-event-c15"),
    _creationTime: 1_700_000_000_400,
    disputeId: currentCase._id,
    type: "status_changed",
    actorWallet: runtime.wallets.admin.address,
    actorWalletType: "external_wallet",
    actorRole: "moderator",
    message,
    attachmentIds: [],
    oldStatus,
    newStatus: nextStatus,
    createdAt: 1_700_000_000_400,
  } satisfies TCanonicalEvent;
}

function projectParticipantDetail(): TParticipantDispute {
  return { ...currentCase, attachments: [] } satisfies TParticipantDispute;
}

function projectParticipantEvent(event: TCanonicalEvent): TParticipantTimelineEvent {
  return { ...event, attachments: [] } satisfies TParticipantTimelineEvent;
}

function projectAdminEvent(event: TCanonicalEvent): TAdminTimelineEvent {
  return { ...event, attachments: [] } satisfies TAdminTimelineEvent;
}

function projectAdminDetail(): IAdminDisputeDetail {
  return {
    dispute: { ...currentCase, attachments: [] },
    timeline: currentTimeline.map(projectAdminEvent),
    assignmentEvents: [],
    settlementAttempts: [],
    job: null,
    milestone: null,
    escrow: null,
  } satisfies IAdminDisputeDetail;
}

function setParticipantSubscription(viewerWallet: string): void {
  const role = viewerWallet === runtime.wallets.client.address ? "client" : "freelancer";
  const args = { disputeId: currentCase._id, viewerWallet };
  const responsePermissionArgs = { disputeId: currentCase._id, walletAddress: viewerWallet };
  runtime.convex.subscriptions.set(queryKey("disputes.canViewDispute", args), {
    allowed: true,
    reason: null,
    role,
  } satisfies TParticipantDisputePermissionQueryResult);
  runtime.convex.subscriptions.set(
    queryKey("disputes.getDispute", args),
    projectParticipantDetail(),
  );
  runtime.convex.subscriptions.set(
    queryKey("work_agreements.getAgreementContextForDispute", args),
    null satisfies TParticipantAgreementContextQueryResult,
  );
  runtime.convex.subscriptions.set(
    queryKey("disputes.canRespondToDispute", responsePermissionArgs),
    {
      allowed: true,
      reason: null,
      role,
    } satisfies TParticipantDisputeResponsePermissionQueryResult,
  );
  runtime.convex.subscriptions.set(
    queryKey("disputes.getDisputeTimeline", args),
    currentTimeline.map(projectParticipantEvent),
  );
}

function publishParticipantSubscriptions(): void {
  setParticipantSubscription(runtime.wallets.client.address);
  setParticipantSubscription(runtime.wallets.freelancer.address);
}

function setupScenario(scenario: TScenario): void {
  currentCase = createCanonicalCase(scenario);
  currentTimeline = [createOpeningEvent(scenario)];
  httpRuntime = {
    mode: "normal",
    refreshAvailable: true,
    pendingResolve: null,
    statusRequests: [],
    adminDetails: [],
    detailReads: 0,
  };
  runtime.activeWalletContext = "admin";
  runtime.convex.subscriptions.clear();
  runtime.convex.calls.length = 0;
  runtime.convex.mutationCalls.length = 0;
  runtime.convex.mutations.clear();
  runtime.protectedApiError.mockReset();
  runtime.logoutWallet.mockReset();
  runtime.stellar.markDisputedOnChain.mockReset();
  runtime.stellar.resolveDisputeOnChain.mockReset();
  publishParticipantSubscriptions();
}

function defaultStatusMessage(status: TAdminReviewStatus): string {
  return `Dispute status changed to ${status.replaceAll("_", " ")}.`;
}

function installHttpMock(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === "/api/admin/session") {
      return Promise.resolve(
        response({
          adminWallet: runtime.wallets.admin.address,
          isOwner: false,
          isDisputeAdmin: true,
        } satisfies IAdminSessionResponse),
      );
    }

    if (url === `/api/admin/disputes/${currentCase._id}`) {
      httpRuntime.detailReads += 1;
      if (httpRuntime.detailReads > 1 && !httpRuntime.refreshAvailable) {
        return Promise.resolve(response({ error: "Refresh failed." }, 500));
      }

      const detail = projectAdminDetail();
      httpRuntime.adminDetails.push(detail);
      return Promise.resolve(response(detail));
    }

    if (url === `/api/admin/disputes/${currentCase._id}/status`) {
      const body = JSON.parse(String(init?.body)) as {
        readonly status: TAdminReviewStatus;
        readonly message?: string;
      };
      httpRuntime.statusRequests.push(body);

      if (httpRuntime.mode === "pending") {
        return new Promise<Response>((resolve) => {
          httpRuntime.pendingResolve = resolve;
        });
      }
      if (httpRuntime.mode === "rejected") {
        return Promise.resolve(response({ error: "Write rejected." }, 409));
      }
      if (httpRuntime.mode === "unauthorized") {
        return Promise.resolve(response({ error: "Admin session expired." }, 401));
      }
      if (httpRuntime.mode === "forbidden") {
        return Promise.resolve(response({ error: "Review permission was revoked." }, 403));
      }

      const oldStatus = currentCase.status;
      const message = body.message ?? defaultStatusMessage(body.status);
      currentCase = {
        ...currentCase,
        status: body.status,
        updatedAt: 1_700_000_000_500,
      } satisfies TCanonicalCase;
      currentTimeline = [...currentTimeline, createStatusEvent(oldStatus, body.status, message)];
      return Promise.resolve(response({ success: true }));
    }

    throw new Error(`Unexpected admin request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
}

function renderAdmin(queryClient = createQueryClient()) {
  runtime.activeWalletContext = "admin";
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AdminDisputeDetailPage, { disputeId: currentCase._id }),
    ),
  );
}

function renderParticipant(viewer: "client" | "freelancer") {
  runtime.activeWalletContext = viewer;
  return render(createElement(DisputeDetailPanel, { disputeId: currentCase._id }));
}

function getReviewStatusControl(container: HTMLElement): HTMLSelectElement {
  const control = within(container).getByLabelText("Review status");
  if (!(control instanceof HTMLSelectElement)) {
    throw new Error("Expected review status select.");
  }
  return control;
}

function getReviewMessageControl(container: HTMLElement): HTMLTextAreaElement {
  const control = within(container).getByLabelText("Optional review message");
  if (!(control instanceof HTMLTextAreaElement)) {
    throw new Error("Expected review message textarea.");
  }
  return control;
}

async function assertParticipantView(
  viewer: "client" | "freelancer",
  expectedOldStatus: TDisputeStatus,
  expectedStatus: TAdminReviewStatus,
  expectedMessage: string,
): Promise<void> {
  const view = renderParticipant(viewer);
  const label =
    expectedStatus === "under_review"
      ? "Under Review"
      : expectedStatus === "awaiting_client_response"
        ? "Awaiting Client"
        : "Awaiting Freelancer";
  expect(await within(view.container).findByText(label, { exact: true })).toBeTruthy();
  expect(within(view.container).getByText(expectedMessage, { exact: true })).toBeTruthy();
  expect(within(view.container).getByText(/Dispute admin/)).toBeTruthy();
  expect(
    within(view.container).getAllByText(formatDisputeDate(1_700_000_000_400), { exact: true })
      .length,
  ).toBeGreaterThan(0);

  const detailArgs = { disputeId: currentCase._id, viewerWallet: runtime.wallets[viewer].address };
  const detail = runtime.convex.subscriptions.get(queryKey("disputes.getDispute", detailArgs)) as
    | TParticipantDispute
    | undefined;
  const timeline = runtime.convex.subscriptions.get(
    queryKey("disputes.getDisputeTimeline", detailArgs),
  ) as TParticipantDisputeTimelineQueryResult | undefined;
  const statusEvent = timeline?.find((event) => event.type === "status_changed");

  expect(detail?.status).toBe(expectedStatus);
  expect(statusEvent).toMatchObject({
    _id: syntheticId("status-event-c15"),
    disputeId: currentCase._id,
    actorWallet: runtime.wallets.admin.address,
    actorRole: "moderator",
    actorWalletType: "external_wallet",
    message: expectedMessage,
    createdAt: 1_700_000_000_400,
    oldStatus: expectedOldStatus,
    newStatus: expectedStatus,
  });
  expect(timeline).toHaveLength(2);

  const queryCallNames = runtime.convex.calls
    .filter(({ args }) => args !== "skip")
    .map(({ name }) => name);
  expect(queryCallNames).toContain("disputes.canViewDispute");
  expect(queryCallNames).toContain("disputes.getDispute");
  expect(queryCallNames).toContain("disputes.getDisputeTimeline");
  expect(
    runtime.convex.calls.some(
      ({ name, args }) =>
        name === "disputes.getDispute" && JSON.stringify(args) === JSON.stringify(detailArgs),
    ),
  ).toBe(true);

  view.unmount();
}

describe("administrator review-state propagation", () => {
  beforeEach(() => {
    setupScenario({
      parentType: "micro_gig",
      initialStatus: "under_review",
      nextStatus: "awaiting_client_response",
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    runtime.activeWalletContext = "admin";
  });

  it.each([
    {
      name: "micro-gig to under review with a custom message",
      parentType: "micro_gig",
      initialStatus: "open",
      nextStatus: "under_review",
      message: "Moderator reviewed the micro-gig evidence.",
    },
    {
      name: "micro-gig to client response with the backend default message",
      parentType: "micro_gig",
      initialStatus: "under_review",
      nextStatus: "awaiting_client_response",
    },
    {
      name: "micro-gig to freelancer response with a custom message",
      parentType: "micro_gig",
      initialStatus: "under_review",
      nextStatus: "awaiting_freelancer_response",
      message: "Freelancer response is required.",
    },
    {
      name: "milestone to under review with the backend default message",
      parentType: "milestone",
      initialStatus: "open",
      nextStatus: "under_review",
    },
    {
      name: "milestone to client response with a custom message",
      parentType: "milestone",
      initialStatus: "under_review",
      nextStatus: "awaiting_client_response",
      message: "Milestone acceptance details are required.",
    },
    {
      name: "milestone to freelancer response with the backend default message",
      parentType: "milestone",
      initialStatus: "under_review",
      nextStatus: "awaiting_freelancer_response",
    },
  ] satisfies ReadonlyArray<TScenario & { readonly name: string }>)("$name", async (scenario) => {
    setupScenario(scenario);
    installHttpMock();
    const adminView = renderAdmin();
    const admin = adminView.container;

    await within(admin).findByText("Moderator Workflow");
    expect(getReviewStatusControl(admin).value).toBe(
      scenario.initialStatus === "open" ? "under_review" : scenario.initialStatus,
    );
    fireEvent.change(getReviewStatusControl(admin), {
      target: { value: scenario.nextStatus },
    });
    if (scenario.message) {
      fireEvent.change(getReviewMessageControl(admin), { target: { value: scenario.message } });
    }
    fireEvent.click(within(admin).getByRole("button", { name: "Update Status" }));

    await waitFor(() => expect(httpRuntime.statusRequests).toHaveLength(1));
    expect(httpRuntime.statusRequests[0]).toEqual(
      scenario.message
        ? { status: scenario.nextStatus, message: scenario.message }
        : { status: scenario.nextStatus },
    );
    await within(admin).findByText("Dispute review status updated.");

    const expectedMessage = scenario.message ?? defaultStatusMessage(scenario.nextStatus);
    const updatedDetail = httpRuntime.adminDetails.at(-1);
    expect(updatedDetail?.dispute.status).toBe(scenario.nextStatus);
    expect(updatedDetail?.timeline).toHaveLength(2);
    expect(updatedDetail?.timeline[0]?.message).toBe("The participant opened this dispute.");
    expect(updatedDetail?.timeline[1]).toMatchObject({
      _id: syntheticId("status-event-c15"),
      disputeId: currentCase._id,
      actorWallet: runtime.wallets.admin.address,
      actorRole: "moderator",
      actorWalletType: "external_wallet",
      message: expectedMessage,
      createdAt: 1_700_000_000_400,
      oldStatus: scenario.initialStatus,
      newStatus: scenario.nextStatus,
    });
    expect(getReviewStatusControl(admin).value).toBe(scenario.nextStatus);
    expect(within(admin).getByText(expectedMessage, { exact: true })).toBeTruthy();
    expect(
      within(admin).getByText("The participant opened this dispute.", { exact: true }),
    ).toBeTruthy();

    publishParticipantSubscriptions();
    expect(currentCase.parentType).toBe(scenario.parentType);
    await assertParticipantView(
      "client",
      scenario.initialStatus,
      scenario.nextStatus,
      expectedMessage,
    );
    await assertParticipantView(
      "freelancer",
      scenario.initialStatus,
      scenario.nextStatus,
      expectedMessage,
    );

    expect(runtime.stellar.markDisputedOnChain).not.toHaveBeenCalled();
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
    expect(runtime.convex.mutationCalls).toHaveLength(0);
    adminView.unmount();
  });

  it("keeps participant subscriptions unchanged while a duplicate-click write is pending", async () => {
    setupScenario({
      parentType: "micro_gig",
      initialStatus: "under_review",
      nextStatus: "awaiting_client_response",
    });
    httpRuntime.mode = "pending";
    installHttpMock();
    const adminView = renderAdmin();
    const admin = adminView.container;
    await within(admin).findByText("Moderator Workflow");
    fireEvent.change(getReviewStatusControl(admin), {
      target: { value: "awaiting_client_response" },
    });
    fireEvent.click(within(admin).getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(httpRuntime.statusRequests).toHaveLength(1));
    await waitFor(() => {
      const button = within(admin).getByRole("button", { name: "Update Status" });
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
    fireEvent.click(within(admin).getByRole("button", { name: "Update Status" }));
    expect(httpRuntime.statusRequests).toHaveLength(1);

    adminView.unmount();
    const participant = renderParticipant("client");
    expect(within(participant.container).getByText("Under Review", { exact: true })).toBeTruthy();
    expect(
      within(participant.container).queryByText("Awaiting Client", { exact: true }),
    ).toBeNull();
    expect(
      within(participant.container).queryByText("Dispute status changed", { exact: false }),
    ).toBeNull();
    expect(currentTimeline).toHaveLength(1);
    participant.unmount();

    await act(async () => {
      httpRuntime.pendingResolve?.(response({ success: true }));
    });
    expect(currentCase.status).toBe("under_review");
    expect(currentTimeline).toHaveLength(1);
    expect(runtime.stellar.markDisputedOnChain).not.toHaveBeenCalled();
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
  });

  it("keeps a rejected administrator draft and does not publish participant state", async () => {
    setupScenario({
      parentType: "milestone",
      initialStatus: "under_review",
      nextStatus: "awaiting_freelancer_response",
    });
    httpRuntime.mode = "rejected";
    installHttpMock();
    const adminView = renderAdmin();
    const admin = adminView.container;
    await within(admin).findByText("Moderator Workflow");
    fireEvent.change(getReviewStatusControl(admin), {
      target: { value: "awaiting_freelancer_response" },
    });
    fireEvent.change(getReviewMessageControl(admin), {
      target: { value: "Keep this rejected draft." },
    });
    fireEvent.click(within(admin).getByRole("button", { name: "Update Status" }));

    expect((await within(admin).findByRole("alert")).textContent).toContain("Write rejected.");
    expect(getReviewStatusControl(admin).value).toBe("awaiting_freelancer_response");
    expect(getReviewMessageControl(admin).value).toBe("Keep this rejected draft.");
    expect(currentCase.status).toBe("under_review");
    expect(currentTimeline).toHaveLength(1);

    const participant = renderParticipant("freelancer");
    expect(within(participant.container).getByText("Under Review", { exact: true })).toBeTruthy();
    expect(
      within(participant.container).queryByText("Awaiting Freelancer", { exact: true }),
    ).toBeNull();
    expect(
      within(participant.container).getByText("The participant opened this dispute.", {
        exact: true,
      }),
    ).toBeTruthy();
    participant.unmount();
    adminView.unmount();
  });

  it.each([
    { mode: "unauthorized" as const, heading: "Authentication Required" },
    { mode: "forbidden" as const, heading: "Admin Access Forbidden" },
  ])(
    "closes protected administrator content after a %s status mutation",
    async ({ mode, heading }) => {
      setupScenario({
        parentType: "micro_gig",
        initialStatus: "under_review",
        nextStatus: "awaiting_client_response",
      });
      httpRuntime.mode = mode;
      installHttpMock();
      const adminView = renderAdmin();
      const admin = adminView.container;
      await within(admin).findByText("Moderator Workflow");
      fireEvent.change(getReviewStatusControl(admin), {
        target: { value: "awaiting_client_response" },
      });
      fireEvent.click(within(admin).getByRole("button", { name: "Update Status" }));

      expect(await within(admin).findByRole("heading", { name: heading })).toBeTruthy();
      expect(within(admin).queryByText("Moderator Workflow")).toBeNull();
      expect(currentCase.status).toBe("under_review");
      expect(currentTimeline).toHaveLength(1);

      const participant = renderParticipant("client");
      expect(within(participant.container).getByText("Under Review", { exact: true })).toBeTruthy();
      expect(
        within(participant.container).queryByText("Awaiting Client", { exact: true }),
      ).toBeNull();
      expect(
        runtime.convex.subscriptions.get(
          queryKey("disputes.getDisputeTimeline", {
            disputeId: currentCase._id,
            viewerWallet: runtime.wallets.client.address,
          }),
        ),
      ).toHaveLength(1);
      participant.unmount();
      adminView.unmount();
    },
  );

  it("publishes a saved participant update when the administrator refresh fails, then retries reads without repeating the write", async () => {
    setupScenario({
      parentType: "milestone",
      initialStatus: "under_review",
      nextStatus: "awaiting_freelancer_response",
      message: "Please provide the milestone response.",
    });
    installHttpMock();
    httpRuntime.refreshAvailable = false;
    const queryClient = createQueryClient();
    const adminView = renderAdmin(queryClient);
    const admin = adminView.container;
    await within(admin).findByText("Moderator Workflow");
    fireEvent.change(getReviewStatusControl(admin), {
      target: { value: "awaiting_freelancer_response" },
    });
    fireEvent.change(getReviewMessageControl(admin), {
      target: { value: "Please provide the milestone response." },
    });
    fireEvent.click(within(admin).getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(httpRuntime.statusRequests).toHaveLength(1));

    publishParticipantSubscriptions();
    expect(currentCase.status).toBe("awaiting_freelancer_response");
    expect(currentTimeline).toHaveLength(2);
    expect((await within(admin).findByRole("alert")).textContent).toContain("status was saved");

    const participant = renderParticipant("client");
    expect(
      within(participant.container).getByText("Awaiting Freelancer", { exact: true }),
    ).toBeTruthy();
    expect(
      within(participant.container).getByText("Please provide the milestone response.", {
        exact: true,
      }),
    ).toBeTruthy();
    participant.unmount();

    httpRuntime.refreshAvailable = true;
    fireEvent.click(within(admin).getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(
        within(admin).getAllByText("Awaiting Freelancer", { exact: true }).length,
      ).toBeGreaterThan(0);
    });
    expect(httpRuntime.statusRequests).toHaveLength(1);
    expect(httpRuntime.adminDetails.at(-1)?.dispute.status).toBe("awaiting_freelancer_response");
    expect(runtime.stellar.markDisputedOnChain).not.toHaveBeenCalled();
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
    adminView.unmount();
  });
});
