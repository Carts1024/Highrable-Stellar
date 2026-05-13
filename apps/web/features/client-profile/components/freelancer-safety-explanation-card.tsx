import { AlertTriangle } from "lucide-react";

export function FreelancerSafetyExplanationCard() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Before working with this client</h2>
          <p className="text-sm leading-6">
            Freelancers should start work only when a specific gig or milestone is marked Verified
            Funded. A client profile may show funded history, but each new job still needs its own
            escrow.
          </p>
        </div>
      </div>
    </section>
  );
}
