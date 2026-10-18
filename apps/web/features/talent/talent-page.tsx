import { ProductPageHero } from "@/features/common";
import { ModeGate } from "@/features/mode";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { BadgeCheck, BriefcaseBusiness, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";

const plannedSignals = [
  "A public history of jobs they finished",
  "Clear stats about their past work",
  "Shortlists and invitations to apply",
] as const;

const previewProfiles = [
  {
    name: "Stellar Frontend Engineer",
    specialty: "Wallet UX, Next.js, escrow flows",
    stats: "12 completions",
  },
  {
    name: "Soroban Contract Developer",
    specialty: "Rust contracts, testnet deployment, audits",
    stats: "9 completions",
  },
  {
    name: "Product Designer",
    specialty: "Marketplace dashboards, trust signals",
    stats: "7 completions",
  },
] as const;

/** Placeholder for the future talent discovery surface. */
export function TalentPage() {
  return (
    <ModeGate allow="client" purpose="look for freelancers to hire">
      <div className="space-y-8">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <ProductPageHero
            label="Client · Find freelancers"
            title={
              <>
                Find freelancers <span className="hr-mode-text">you can trust</span>
              </>
            }
            description="A searchable list of freelancers is coming soon. For now, the best way to hire is to post a job and review the people who apply."
            actions={
              <>
                <AppButton asChild className="hr-v2-button-primary gap-2 rounded-lg px-6 font-mono">
                  <Link href="/post-job">Post a Job</Link>
                </AppButton>
              </>
            }
          />

          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-border/60 pb-4">
              <div className="hr-mode-soft hr-mode-text flex h-11 w-11 items-center justify-center rounded-xl">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-mono font-semibold text-foreground">What you will see</h2>
                <p className="font-sans text-sm text-muted-foreground">
                  Based on real, finished jobs
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {plannedSignals.map((signal) => (
                <div
                  key={signal}
                  className="flex gap-3 rounded-xl bg-muted/40 p-3 font-sans text-sm text-foreground"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{signal}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="hr-text-primary font-sans text-lg font-semibold">Preview</h2>
            <p className="mt-1 font-sans text-sm text-muted-foreground">
              These examples show how freelancer cards will look. Search is not live yet.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {previewProfiles.map((profile) => (
              <article
                key={profile.name}
                className="rounded-xl border border-dashed border-border bg-card p-5 transition-all duration-200 hover:border-highrable-orange-3/30 hover:shadow-sm"
              >
                <div className="flex items-center justify-start gap-4">
                  <BriefcaseBusiness className="h-12 w-12 rounded-xl bg-muted p-3 text-muted-foreground" />
                  <h3 className="font-sans font-semibold text-foreground">{profile.name}</h3>
                </div>

                <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground">
                  {profile.specialty}
                </p>
                <div className="hr-mode-soft hr-mode-text mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 font-sans text-xs font-medium">
                  <Star className="h-3.5 w-3.5" />
                  {profile.stats}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </ModeGate>
  );
}
