"use client";

export function AdminDisputesPlaceholder() {
  return (
    <section className="rounded-lg border border-[#e8e8e8] bg-white p-6">
      <p className="font-mono text-xs text-[#5f5f5f] uppercase">Manual Review</p>
      <h1 className="mt-2 text-2xl font-semibold text-[#0a0a0a]">Admin Disputes Placeholder</h1>
      <p className="mt-3 text-sm text-[#5f5f5f]">
        Manual review tools will be added in a future phase.
      </p>
      <ul className="mt-4 grid gap-2 text-sm text-[#3f3f3f] sm:grid-cols-2">
        <li className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">Review evidence</li>
        <li className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          Request more information
        </li>
        <li className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">Propose resolution</li>
        <li className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          Resolve in favor of client
        </li>
        <li className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          Resolve in favor of freelancer
        </li>
        <li className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">Split resolution</li>
      </ul>
      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Resolution recorded in Highrable review workflow. Escrow settlement action is not automated
        in this phase.
      </p>
    </section>
  );
}
