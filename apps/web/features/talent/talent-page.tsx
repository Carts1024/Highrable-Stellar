import { ProductPageHero } from "@/features/common";
import { ModeGate } from "@/features/mode";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import Link from "next/link";
import React from "react";

const plannedSignals = [
  "A public history of jobs they finished",
  "Clear stats about their past work",
  "Shortlists and invitations to apply",
] as const;

/** Placeholder for the future talent discovery surface. */
export function TalentPage() {
  return (
    <ModeGate allow="client" purpose="look for freelancers to hire">
      <div className="max-w-2xl space-y-6">
        <ProductPageHero
          title="Find freelancers"
          description="A searchable list of freelancers is not available yet. For now, the best way to hire is to post a job and review the people who apply."
          actions={
            <AppButton asChild className="hr-v2-button-primary h-9 rounded-md px-4">
              <Link href="/post-job">Post a job</Link>
            </AppButton>
          }
        />

        <section className="space-y-2 border-t pt-5">
          <h2 className="hr-text-primary text-sm font-semibold">Coming to this page</h2>
          <p className="hr-text-secondary text-sm">
            Freelancer listings will be based on real jobs finished and paid on Highrable:
          </p>
          <ul className="hr-text-secondary list-disc space-y-1 pl-5 text-sm">
            {plannedSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </section>
      </div>
    </ModeGate>
  );
}
