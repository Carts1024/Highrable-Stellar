import { describe, expect, it } from "vitest";

import {
  DISPUTE_ON_CHAIN_STATUS_LABELS,
  DISPUTE_STATUS_LABELS,
  getDisputeOnChainStatusLabel,
  getDisputeStatusLabel,
  isTerminalDisputeStatus,
} from "./lib";

describe("dispute status contract", () => {
  it("labels every supported dispute status and classifies terminal states", () => {
    const statuses = Object.keys(DISPUTE_STATUS_LABELS) as Array<
      keyof typeof DISPUTE_STATUS_LABELS
    >;

    expect(statuses).toHaveLength(8);
    for (const status of statuses) {
      expect(getDisputeStatusLabel(status)).toBe(DISPUTE_STATUS_LABELS[status]);
    }

    expect(isTerminalDisputeStatus("open")).toBe(false);
    expect(isTerminalDisputeStatus("under_review")).toBe(false);
    expect(isTerminalDisputeStatus("awaiting_client_response")).toBe(false);
    expect(isTerminalDisputeStatus("awaiting_freelancer_response")).toBe(false);
    expect(isTerminalDisputeStatus("resolved_client")).toBe(true);
    expect(isTerminalDisputeStatus("resolved_freelancer")).toBe(true);
    expect(isTerminalDisputeStatus("split_resolution")).toBe(true);
    expect(isTerminalDisputeStatus("cancelled")).toBe(true);
  });

  it("labels every supported on-chain marking phase", () => {
    const phases = Object.keys(DISPUTE_ON_CHAIN_STATUS_LABELS) as Array<
      keyof typeof DISPUTE_ON_CHAIN_STATUS_LABELS
    >;

    expect(phases).toHaveLength(4);
    for (const phase of phases) {
      expect(getDisputeOnChainStatusLabel(phase)).toBe(DISPUTE_ON_CHAIN_STATUS_LABELS[phase]);
    }
  });
});
