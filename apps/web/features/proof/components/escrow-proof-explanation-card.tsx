import { HighrableV2IconNotice, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";

import type { TProofStatus } from "../types";

export function EscrowProofExplanationCard({
  proofStatus,
}: {
  readonly proofStatus: TProofStatus;
}) {
  const isCompleted = proofStatus === "paid";

  return (
    <section className="h-full border border-[#e8e8e8] bg-[#fafafa] p-4">
      <div className="flex items-center gap-2">
        <SectionLabel>Context</SectionLabel>
        <HighrableV2IconNotice
          label="Privacy controls status"
          message="Avoid sharing sensitive proof links outside the people who need this receipt."
          tone="neutral"
        />
      </div>
      <h2 className="mt-2 text-base font-semibold text-[#0a0a0a]">Why this proof matters</h2>
      <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">
        {isCompleted
          ? "A completed proof means the client set money aside, the freelancer finished the work, and payment was released. This makes the review harder to fake than a normal marketplace rating."
          : "This receipt shows where the work payment currently stands. A verified trust badge appears after payment is released."}
      </p>
    </section>
  );
}
