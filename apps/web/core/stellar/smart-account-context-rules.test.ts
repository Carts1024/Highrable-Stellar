import { describe, expect, it } from "vitest";

import { contextRuleCanAuthorize, parseContextRule } from "./smart-account-context-rules";

describe("smart-account context rules", () => {
  it("parses the RPC tuple returned for a default External signer", () => {
    const keyData = Buffer.alloc(68);
    keyData.set([1, 2, 3], 65);
    const verifierId = "C" + "A".repeat(55);

    const rule = parseContextRule({
      context_type: ["Default"],
      id: 0,
      name: "Default",
      signers: [["External", verifierId, keyData]],
    });

    expect(rule).toMatchObject({
      context_type: { tag: "Default" },
      id: 0,
      name: "Default",
      signers: [{ tag: "External", values: [verifierId, keyData] }],
    });
  });

  it("allows Default rules to authorize requested contexts", () => {
    expect(
      contextRuleCanAuthorize(
        { tag: "Default", values: undefined },
        { tag: "CallContract", values: ["C" + "A".repeat(55)] },
      ),
    ).toBe(true);
  });
});
