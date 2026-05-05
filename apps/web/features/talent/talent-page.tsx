import { ArrowRight, BadgeCheck, BriefcaseBusiness, Search, ShieldCheck, Star } from "lucide-react";
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
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium text-gray-700">
            <Search className="h-4 w-4 text-[#FF7003]" />
            Talent discovery placeholder
          </div>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-bold tracking-normal text-gray-950 sm:text-5xl">
              Find Talent
            </h1>
            <p className="text-base leading-7 text-gray-600 sm:text-lg">
              A dedicated freelancer directory is planned after the MVP job, application, escrow,
              and reputation flows are stable. For now, clients can post a job and review
              applicants from the marketplace flow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/post-job"
              className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:from-[#E85D00] hover:to-[#E87A00]"
            >
              Post a Job
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/jobs"
              className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
            >
              Browse Jobs
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#B94A00]">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-950">Planned trust signals</h2>
              <p className="text-sm text-gray-500">Backed by completed escrow releases</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {plannedSignals.map((signal) => (
              <div key={signal} className="flex gap-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{signal}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-950">Directory Preview</h2>
          <p className="mt-1 text-sm text-gray-500">
            These cards show the intended shape of the talent page without implying live talent
            search is available yet.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {previewProfiles.map((profile) => (
            <article
              key={profile.name}
              className="rounded-2xl border border-dashed border-gray-200 bg-white p-5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-950">{profile.name}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{profile.specialty}</p>
              <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-[#B94A00]">
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
