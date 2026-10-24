import { describe, expect, it } from "vitest";

import type {
  ISettlementEligibilityDetail,
  ISettlementEligibilityInput,
} from "./settlement-validation";

import {
  deriveSettlementEligibility,
  getResolutionShareDisplayValue,
  resolveShareBps,
  resolveSettlementTerms,
  validateResolutionShare,
  validateSettlementTerms,
} from "./settlement-validation";

const adminWallet = `G${"A".repeat(55)}`;

const baseDetail: ISettlementEligibilityDetail = {
  dispute: {
    status: "open",
    clientWallet: "GCLIENT",
    freelancerWallet: "GFREELANCER",
    assignedAdminWallet: adminWallet,
    onChainStatus: "marked",
    onChainEscrowId: "escrow-on-chain-1",
  },
  escrow: { status: "disputed" },
  settlementAttempts: [],
};

const baseInput: ISettlementEligibilityInput = {
  detail: baseDetail,
  verifiedWallet: adminWallet,
  activeWalletAddress: adminWallet,
  activeWalletType: "external_wallet",
  connectedWalletAddress: adminWallet,
  isConnected: true,
  canWriteContracts: true,
  isTestnet: true,
  configuredNetwork: "testnet",
  isActionRunning: false,
};

describe("resolution share validation", () => {
  it.each([
    ["resolved_client", "", 0],
    ["resolved_client", "not-used", 0],
    ["resolved_freelancer", "", 10_000],
    ["resolved_freelancer", "not-used", 10_000],
  ] as const)("maps %s to %s bps", (status, input, expectedBps) => {
    expect(resolveShareBps(status, input)).toBe(expectedBps);
    expect(validateResolutionShare(status, input)).toMatchObject({
      isValid: true,
      freelancerShareBps: expectedBps,
    });
  });

  it.each([
    ["1", 1],
    ["5000", 5000],
    ["9999", 9999],
  ])("accepts split boundary/value %s", (input, expectedBps) => {
    expect(validateResolutionShare("split_resolution", input)).toMatchObject({
      isValid: true,
      freelancerShareBps: expectedBps,
      error: null,
    });
  });

  it.each(["", "0", "10000", "-1", "1.5", "1e3", "5000bps", " 5000 "])(
    "rejects invalid split input %s without rewriting it",
    (input) => {
      const validation = validateResolutionShare("split_resolution", input);

      expect(validation.isValid).toBe(false);
      expect(() => resolveShareBps("split_resolution", input)).toThrow();
    },
  );

  it("keeps the selected split text and locks fixed outcome display values", () => {
    expect(getResolutionShareDisplayValue("split_resolution", "1e3")).toBe("1e3");
    expect(getResolutionShareDisplayValue("resolved_client", "5000")).toBe("0");
    expect(getResolutionShareDisplayValue("resolved_freelancer", "5000")).toBe("10000");
  });

  it.each([
    ["resolved_client", 0],
    ["resolved_freelancer", 10_000],
    ["split_resolution", 1],
    ["split_resolution", 9_999],
  ] as const)("accepts execution terms %s/%s", (status, freelancerShareBps) => {
    expect(validateSettlementTerms(status, freelancerShareBps)).toEqual({
      isValid: true,
      freelancerShareBps,
      error: null,
    });
    expect(resolveSettlementTerms(status, freelancerShareBps)).toBe(freelancerShareBps);
  });

  it.each([
    ["resolved_client", 1, "0 bps"],
    ["resolved_freelancer", 9_999, "10000 bps"],
    ["split_resolution", 0, "1 to 9999 bps"],
    ["split_resolution", 10_000, "1 to 9999 bps"],
    ["split_resolution", 1.5, "whole-number"],
    ["split_resolution", Number.NaN, "finite"],
    ["split_resolution", Number.POSITIVE_INFINITY, "finite"],
    ["unknown_outcome", 5000, "recognized"],
  ] as const)("rejects invalid execution terms %s/%s", (status, freelancerShareBps, message) => {
    const validation = validateSettlementTerms(status, freelancerShareBps);

    expect(validation.isValid).toBe(false);
    expect(validation.freelancerShareBps).toBeNull();
    expect(validation.error).toContain(message);
    expect(() => resolveSettlementTerms(status, freelancerShareBps)).toThrow(message);
  });
});

describe("settlement eligibility", () => {
  it.each([
    "open",
    "under_review",
    "awaiting_client_response",
    "awaiting_freelancer_response",
  ] as const)("permits review status %s", (status) => {
    const result = deriveSettlementEligibility({
      ...baseInput,
      detail: { ...baseDetail, dispute: { ...baseDetail.dispute, status } },
    });

    expect(result).toEqual({ canSettle: true, blockingReason: null });
  });

  it.each([
    ["disconnected wallet", { isConnected: false }, "Connect a signing-capable external"],
    ["passkey wallet", { activeWalletType: "passkey_smart_account" }, "external Stellar wallet"],
    ["non-signing wallet", { canWriteContracts: false }, "cannot sign"],
    ["wrong network", { isTestnet: false }, "Switch wallet network"],
    ["different connected address", { connectedWalletAddress: `G${"B".repeat(55)}` }, "Reconnect"],
    ["different verified session", { verifiedWallet: `G${"B".repeat(55)}` }, "Authenticate"],
  ] as const)("blocks %s", (_caseName, overrides, expectedReason) => {
    const result = deriveSettlementEligibility({ ...baseInput, ...overrides });

    expect(result.canSettle).toBe(false);
    expect(result.blockingReason).toContain(expectedReason);
  });

  it.each([
    ["different assignment", { assignedAdminWallet: `G${"B".repeat(55)}` }, "assignment"],
    ["client participant", { clientWallet: adminWallet }, "participant"],
    ["freelancer participant", { freelancerWallet: adminWallet }, "participant"],
  ] as const)("blocks %s", (_caseName, overrides, expectedReason) => {
    const result = deriveSettlementEligibility({
      ...baseInput,
      detail: { ...baseDetail, dispute: { ...baseDetail.dispute, ...overrides } },
    });

    expect(result.canSettle).toBe(false);
    expect(result.blockingReason?.toLowerCase()).toContain(expectedReason);
  });

  it.each(["not_marked", "marking", "mark_failed"] as const)(
    "requires marked on-chain status, not %s",
    (onChainStatus) => {
      const result = deriveSettlementEligibility({
        ...baseInput,
        detail: { ...baseDetail, dispute: { ...baseDetail.dispute, onChainStatus } },
      });

      expect(result.canSettle).toBe(false);
      expect(result.blockingReason).toContain("marked on-chain");
    },
  );

  it("requires an on-chain escrow identifier and disputed escrow mirror", () => {
    expect(
      deriveSettlementEligibility({
        ...baseInput,
        detail: { ...baseDetail, dispute: { ...baseDetail.dispute, onChainEscrowId: undefined } },
      }).blockingReason,
    ).toContain("identifier");

    expect(
      deriveSettlementEligibility({
        ...baseInput,
        detail: { ...baseDetail, escrow: null },
      }).blockingReason,
    ).toContain("mirror is missing");

    expect(
      deriveSettlementEligibility({
        ...baseInput,
        detail: { ...baseDetail, escrow: { status: "funded" } },
      }).blockingReason,
    ).toContain("mirror is disputed");
  });

  it.each(["started", "signed", "submission_unknown", "submitted"] as const)(
    "blocks active settlement attempt %s",
    (status) => {
      const result = deriveSettlementEligibility({
        ...baseInput,
        detail: { ...baseDetail, settlementAttempts: [{ status }] },
      });

      expect(result.canSettle).toBe(false);
      expect(result.blockingReason).toContain("pending reconciliation");
    },
  );

  it("blocks while another action is running", () => {
    expect(deriveSettlementEligibility({ ...baseInput, isActionRunning: true })).toEqual({
      canSettle: false,
      blockingReason: "Settlement is already in progress.",
    });
  });
});
