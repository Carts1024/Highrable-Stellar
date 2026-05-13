import type { TProofStatus } from "../types";

export function EscrowProofExplanationCard({
  proofStatus,
}: {
  readonly proofStatus: TProofStatus;
}) {
  const isCompleted = proofStatus === "paid";

  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-6">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Why this proof matters</h2>
      <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">
        {isCompleted
          ? "Highrable creates escrow-backed work records. A completed proof page means the client funded escrow, the freelancer completed work, and payment was released through Stellar. This makes reviews harder to fake than normal marketplace ratings."
          : "This page shows the current escrow state. A completed reputation proof appears only after payment release."}
      </p>
      <p className="mt-3 text-xs text-[#7f7f7f]">TODO: Add privacy controls before production.</p>
    </section>
  );
}
