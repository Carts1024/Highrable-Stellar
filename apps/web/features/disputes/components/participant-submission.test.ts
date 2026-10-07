import { describe, expect, it } from "vitest";

import type { TDraftAttachment } from "@/features/attachments/types";

import { validateParticipantSubmission } from "./participant-submission";

function attachment(id: string, status: TDraftAttachment["status"] = "ready"): TDraftAttachment {
  return { id, name: `${id}.pdf`, type: "pdf", status };
}

describe("participant submission validation", () => {
  it("accepts a 4,000-character message and rejects longer messages", () => {
    expect(validateParticipantSubmission("response", "x".repeat(4_000), [])).toBeNull();
    expect(validateParticipantSubmission("response", "x".repeat(4_001), [])).toBe(
      "Keep the message within 4,000 characters.",
    );
  });

  it("requires evidence attachments and enforces the 25-item limit", () => {
    expect(validateParticipantSubmission("evidence", "", [])).toBe(
      "Add at least one evidence file or link.",
    );
    expect(
      validateParticipantSubmission(
        "evidence",
        "",
        Array.from({ length: 26 }, (_, index) => attachment(`file-${index}`)),
      ),
    ).toBe("Attach 25 files or links or fewer.");
  });

  it("rejects duplicate and unfinished attachments before a write", () => {
    expect(
      validateParticipantSubmission("response", "A response", [
        attachment("same"),
        attachment("same"),
      ]),
    ).toBe("Remove duplicate attachments before submitting.");
    expect(
      validateParticipantSubmission("response", "A response", [attachment("pending", "uploading")]),
    ).toBe("Finish uploads or remove failed attachments before submitting.");
  });
});
