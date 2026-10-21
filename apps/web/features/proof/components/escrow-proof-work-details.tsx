import { DeadlineBadge } from "@/features/deadlines";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import Link from "next/link";

import type { TEscrowProof, TProofProfile } from "../types";

function getJobTypeLabel(jobType: string): string {
  return jobType === "milestone_project" ? "Milestone Project" : "Micro Gig";
}

function getDisplayName(profile: TProofProfile | undefined, fallback: string): string {
  return profile?.companyName ?? profile?.name ?? fallback;
}

function ParticipantRow({
  label,
  walletAddress,
  profile,
  href,
}: {
  readonly label: string;
  readonly walletAddress: string | undefined;
  readonly profile?: TProofProfile;
  readonly href?: string;
}) {
  if (!walletAddress) {
    return (
      <div className="hr-text-secondary flex justify-between gap-4 py-2 text-sm">
        <span>{label}</span>
        <span>Not assigned yet</span>
      </div>
    );
  }

  const shortenedWallet = shortenWalletAddress(walletAddress);

  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="hr-text-secondary">{label}</span>
      <div className="min-w-0 text-right">
        <p className="hr-text-primary font-medium">{getDisplayName(profile, shortenedWallet)}</p>
        {href ? (
          <Link href={href} className="hr-mode-text font-mono text-xs break-all hover:underline">
            {shortenedWallet}
          </Link>
        ) : (
          <p className="hr-text-secondary font-mono text-xs break-all">{shortenedWallet}</p>
        )}
        {profile?.walletType ? (
          <p className="hr-text-muted text-xs">
            {profile.walletType === "passkey_smart_account"
              ? "Secured with Highrable passkey"
              : "Connected wallet"}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function EscrowProofWorkDetails({ proof }: { readonly proof: TEscrowProof }) {
  return (
    <section aria-labelledby="proof-work-title" className="space-y-4">
      <h2 id="proof-work-title" className="hr-text-primary text-base font-semibold">
        The work
      </h2>

      {proof.milestone ? (
        <div className="space-y-1">
          <p className="hr-text-secondary text-xs">Milestone {proof.milestone.order}</p>
          <p className="hr-text-primary text-sm font-medium">{proof.milestone.title}</p>
          {proof.milestone.description ? (
            <p className="hr-text-secondary text-sm leading-relaxed">
              {proof.milestone.description}
            </p>
          ) : null}
        </div>
      ) : null}

      {proof.job.description ? (
        <p className="hr-text-secondary text-sm leading-relaxed whitespace-pre-line">
          {proof.job.description}
        </p>
      ) : null}

      <dl className="divide-y border-y text-sm">
        <div className="flex justify-between gap-4 py-2">
          <dt className="hr-text-secondary">Job type</dt>
          <dd className="hr-text-primary">{getJobTypeLabel(proof.job.jobType)}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-2">
          <dt className="hr-text-secondary">Deadline</dt>
          <dd className="text-right">
            <DeadlineBadge
              deadlineAt={proof.milestone?.deadlineAt ?? proof.job.deadlineAt}
              submittedAt={proof.milestone?.submittedAt ?? proof.job.submittedAt}
              completedAt={proof.milestone?.completedAt ?? proof.job.completedAt}
              approvedAt={proof.milestone?.approvedAt ?? proof.job.approvedAt}
              escrowStatus={proof.escrow.status}
              workStatus={proof.milestone?.status ?? proof.job.status}
              compact
            />
          </dd>
        </div>
        <ParticipantRow
          label="Client"
          walletAddress={proof.escrow.clientWallet}
          profile={proof.clientProfile}
          href={`/clients/${encodeURIComponent(proof.escrow.clientWallet)}`}
        />
        <ParticipantRow
          label="Freelancer"
          walletAddress={proof.escrow.freelancerWallet}
          profile={proof.freelancerProfile}
          href={
            proof.escrow.freelancerWallet
              ? `/freelancers/${encodeURIComponent(proof.escrow.freelancerWallet)}`
              : undefined
          }
        />
      </dl>
    </section>
  );
}
