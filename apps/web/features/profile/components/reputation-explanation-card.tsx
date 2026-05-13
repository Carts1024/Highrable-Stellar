import { ShieldCheck } from "lucide-react";

export function ReputationExplanationCard() {
  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[#0a0a0a]">Why this reputation is verified</h2>
          <p className="text-sm leading-relaxed text-emerald-900">
            Highrable only creates verified reviews after escrow payment is released. This makes
            completed work harder to fake than normal marketplace reviews.
          </p>
        </div>
      </div>
    </section>
  );
}
