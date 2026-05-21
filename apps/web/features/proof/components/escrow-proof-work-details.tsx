import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { HighrableV2Bullet, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { UserRound } from "lucide-react";
import Link from "next/link";

import type { TEscrowProof, TProofProfile } from "../types";

import { formatProofDate } from "../lib/format";

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
      <div className="border-t border-[#e8e8e8] py-3 text-sm text-[#5f5f5f]">
        No freelancer assigned yet.
      </div>
    );
  }

  const shortenedWallet = shortenWalletAddress(walletAddress);

  return (
    <div className="flex items-start gap-3 border-t border-[#e8e8e8] py-3">
      <div className="mt-0.5 border border-[#e8e8e8] bg-white p-2 text-[#FF7003]">
        <UserRound className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">{label}</p>
        <p className="mt-1 font-semibold text-[#0a0a0a]">
          {getDisplayName(profile, shortenedWallet)}
        </p>
        {href ? (
          <Link
            href={href}
            className="mt-1 inline-block text-sm font-medium break-all text-[#FF7003] hover:text-[#E85D00]"
          >
            {shortenedWallet}
          </Link>
        ) : (
          <p className="mt-1 text-sm break-all text-[#5f5f5f]">{shortenedWallet}</p>
        )}
        {profile?.walletType ? (
          <p className="mt-1 text-xs text-[#7f7f7f]">
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
  const amount = proof.milestone?.amount ?? proof.escrow.amount;
  const asset = proof.milestone?.asset ?? proof.escrow.asset;

  return (
    <section className="border border-[#e8e8e8] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <SectionLabel>Work Details</SectionLabel>
          <h2 className="text-xl font-semibold text-[#0a0a0a]">Work and people</h2>
        </div>
        <DeadlineBadge
          deadlineAt={proof.milestone?.deadlineAt ?? proof.job.deadlineAt}
          submittedAt={proof.milestone?.submittedAt ?? proof.job.submittedAt}
          completedAt={proof.milestone?.completedAt ?? proof.job.completedAt}
          approvedAt={proof.milestone?.approvedAt ?? proof.job.approvedAt}
          escrowStatus={proof.escrow.status}
          workStatus={proof.milestone?.status ?? proof.job.status}
        />
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-[#7f7f7f] uppercase">
            {proof.proofType === "milestone" ? "Project" : "Micro Gig"}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#0a0a0a]">{proof.job.title}</h3>
        </div>

        {proof.milestone ? (
          <div className="border border-[#e8e8e8] bg-[#fafafa] p-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-[#7f7f7f] uppercase">
              Milestone {proof.milestone.order}
            </p>
            <p className="mt-1 font-semibold text-[#0a0a0a]">{proof.milestone.title}</p>
            {proof.milestone.description ? (
              <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">{proof.milestone.description}</p>
            ) : null}
          </div>
        ) : null}

        {proof.job.description ? (
          <p className="text-sm leading-6 text-[#5f5f5f]">{proof.job.description}</p>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[#e8e8e8] pt-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            <HighrableV2Bullet tone="muted" />
            Job type
          </dt>
          <dd className="font-semibold text-[#0a0a0a]">{getJobTypeLabel(proof.job.jobType)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            <HighrableV2Bullet tone="muted" />
            Amount
          </dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {formatAmount(amount)} {formatAssetLabel(asset)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            <HighrableV2Bullet tone="muted" />
            Asset
          </dt>
          <dd className="font-semibold text-[#0a0a0a]">{formatAssetLabel(asset)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            <HighrableV2Bullet tone="muted" />
            Created
          </dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {formatProofDate(proof.escrow.createdAt)}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">People</p>
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
      </div>
    </section>
  );
}
