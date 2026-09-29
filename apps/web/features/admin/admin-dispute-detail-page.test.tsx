// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { cloneElement, createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  OptionHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const runtime = vi.hoisted(() => ({
  wallet: {
    address: `G${"A".repeat(55)}`,
    walletState: {
      isConnected: true,
      isTestnet: true,
      canWriteContracts: true,
    },
    signTransaction: vi.fn(),
  },
  queryClient: null as QueryClient | null,
}));

vi.mock("@/features/admin/admin-session-gate", () => ({
  ADMIN_QUERY_KEY: ["admin"],
  AdminSessionGate: ({ children }: { readonly children: ReactNode }) => children,
  useAdminSessionAccess: () => ({
    verifiedWallet: `G${"A".repeat(55)}`,
    isOwner: false,
    isDisputeAdmin: true,
    handleProtectedApiError: vi.fn(),
  }),
}));

vi.mock("@/features/admin/components/admin-operations-ui", () => ({
  AdminSection: ({ title, children }: { readonly title: string; readonly children?: ReactNode }) =>
    createElement("section", null, createElement("h2", null, title), children),
}));

vi.mock("@/features/common", () => ({
  ProductPageHero: ({ title }: { readonly title: ReactNode }) => createElement("h1", null, title),
  RouteCallout: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", { role: "alert" }, children),
  RouteEmptyState: ({ description }: { readonly description: ReactNode }) =>
    createElement("p", null, description),
  sanitizeMultilineInput: (value: string) => value,
  showWarningToast: vi.fn(),
}));

vi.mock("@/features/disputes", () => ({
  DisputeOnChainStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", null, `Chain: ${status}`),
  DisputeStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", null, status),
}));

vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => ({
    walletAddress: runtime.wallet.address,
    walletType: "external_wallet" as const,
  }),
}));

vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => runtime.wallet,
}));

vi.mock("@/core/config/stellar-contracts", () => ({
  getRequiredEscrowActionConfig: () => ({
    rpcUrl: "http://localhost",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowContractId: `C${"A".repeat(55)}`,
  }),
}));

vi.mock("@/core/stellar/escrow-contract", () => ({
  getPlatformAdminOnChain: vi.fn(),
  markDisputedOnChain: vi.fn(),
  resolveDisputeOnChain: vi.fn(),
}));

vi.mock("@/core/stellar/explorer", () => ({ getTxExplorerUrl: vi.fn() }));
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
    disputes: {
      markDisputeOnChainStarted: "markDisputeOnChainStarted",
      markDisputeOnChainSucceeded: "markDisputeOnChainSucceeded",
      markDisputeOnChainFailed: "markDisputeOnChainFailed",
    },
    escrows: { updateEscrowStatus: "updateEscrowStatus" },
    milestones: { updateMilestoneEscrowStatus: "updateMilestoneEscrowStatus" },
    transactions: {
      createTransaction: "createTransaction",
      updateTransactionStatus: "updateTransactionStatus",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn().mockResolvedValue(true),
}));

vi.mock("@repo/ui/components/highrable/v2-marketing", () => ({
  HighrableV2Metric: ({ label, value }: { readonly label: string; readonly value: ReactNode }) =>
    createElement("div", null, `${label}: ${value}`),
  SectionLabel: ({ children }: { readonly children?: ReactNode }) =>
    createElement("span", null, children),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    variant: _variant,
    size: _size,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly asChild?: boolean;
    readonly variant?: string;
    readonly size?: string;
  }) =>
    asChild && isValidElement(children)
      ? cloneElement(children, props)
      : createElement("button", props, children),
}));
vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => createElement("input", props),
}));
vi.mock("@repo/ui/components/ui/native-select", () => ({
  NativeSelect: (props: SelectHTMLAttributes<HTMLSelectElement>) => createElement("select", props),
  NativeSelectOption: ({ children, ...props }: OptionHTMLAttributes<HTMLOptionElement>) =>
    createElement("option", props, children),
}));
vi.mock("@repo/ui/components/ui/textarea", () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) =>
    createElement("textarea", props),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => createElement("span"),
  ExternalLink: () => createElement("span"),
  RotateCcw: () => createElement("span"),
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

import { AdminDisputeDetailPage } from "./admin-dispute-detail-page";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  runtime.queryClient = queryClient;

  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AdminDisputeDetailPage, { disputeId: "dispute-1" }),
    ),
  );
}

const resolvedDetail = {
  dispute: {
    _id: "dispute-1",
    disputeNumber: "DSP-001",
    parentType: "job",
    parentId: "job-1",
    clientWallet: "GCLIENT",
    freelancerWallet: "GFREELANCER",
    openedByWallet: "GCLIENT",
    openedByWalletType: "external_wallet",
    openedByRole: "client",
    reasonCategory: "work_not_delivered",
    title: "Missing deliverable",
    description: "The deliverable was not provided.",
    evidenceAttachmentIds: [],
    relatedWorkSubmissionIds: [],
    relatedRevisionRequestIds: [],
    status: "resolved_client",
    onChainStatus: "marked",
    openedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    resolutionNote: "Client refunded after review.",
    attachments: [],
  },
  timeline: [],
  assignmentEvents: [],
  settlementAttempts: [],
  job: null,
  milestone: null,
  escrow: null,
};

describe("AdminDisputeDetailPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the detail loading state before the HTTP read resolves", () => {
    let resolveResponse!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
      ),
    );

    renderDetail();

    expect(screen.getByRole("alert").textContent).toContain("Loading dispute detail");
    resolveResponse(response(resolvedDetail));
  });

  it.each([
    [400, "This dispute request is invalid."],
    [404, "Dispute not found."],
  ])("distinguishes HTTP %s detail failures", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: message }, status)));

    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(message);
    });
  });

  it("preserves an empty timeline and makes resolved disputes read-only", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(resolvedDetail)));

    renderDetail();

    expect(await screen.findByText("No timeline events yet.")).toBeTruthy();
    expect(screen.queryByText("Moderator workflow")).toBeNull();
    expect(screen.queryByRole("button", { name: "Resolve On-Chain" })).toBeNull();
    expect(screen.getByText(/Status: Resolved: Client/)).toBeTruthy();
  });
});
