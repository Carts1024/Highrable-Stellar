import { ProductPageHero } from "@/features/common";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { BadgeCheck, BriefcaseBusiness, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";

const plannedSignals = [
  "Verified completion history from reputation contract records",
  "Wallet-based identity and client-visible work stats",
  "Shortlists, invitations, and proposal routing",
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
    <div className="space-y-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <ProductPageHero
          label="Talent Discovery"
          title={
            <>
              Find Talent <span className="text-[#FF7003]">with Verified Reputation Signals</span>
            </>
          }
          description="A dedicated freelancer directory is planned after MVP job, application, escrow, and reputation flows stabilize. Today, clients can post roles and review wallet-based applicants through the marketplace."
          actions={
            <>
              <AppButton asChild className="hr-v2-button-primary gap-2 rounded-lg px-6 font-mono">
                <Link href="/post-job">Post a Job</Link>
              </AppButton>
              <AppButton asChild className="rounded-lg px-6 font-mono">
                <Link href="/jobs">Browse Jobs</Link>
              </AppButton>
            </>
          }
        />

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-highrable-orange-2/10 text-highrable-orange-2">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-mono font-semibold text-foreground">Planned trust signals</h2>
              <p className="font-sans text-sm text-gray-500">Backed by completed escrow releases</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {plannedSignals.map((signal) => (
              <div
                key={signal}
                className="flex gap-3 rounded-xl bg-gray-50 p-3 font-sans text-sm text-gray-700"
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
          <h2 className="hr-text-primary font-sans text-lg font-semibold">Directory Preview</h2>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            These cards show the intended shape of the talent page without implying live talent
            search is available yet.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {previewProfiles.map((profile) => (
            <article
              key={profile.name}
              className="rounded-xl border border-dashed border-border bg-white p-5"
            >
              <div className="flex items-center justify-start gap-4">
                <BriefcaseBusiness className="h-12 w-12 rounded-xl bg-gray-100 p-3 text-muted-foreground" />
                <h3 className="font-sans font-semibold text-foreground">{profile.name}</h3>
              </div>

              <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground">
                {profile.specialty}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-highrable-orange-2/10 px-3 py-1 font-sans text-xs font-medium text-highrable-orange-2">
                <Star className="h-3.5 w-3.5" />
                {profile.stats}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
