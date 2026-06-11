"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import Link from "next/link";

import type { TMilestoneApplicationGate } from "../types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";

import { ApplyToMilestoneForm } from "./apply-to-milestone-form";
import { MilestoneActionPanel } from "./milestone-action-panel";
import { MilestoneApplicationsList } from "./milestone-applications-list";
import { MilestoneContinuationPanel } from "./milestone-continuation-panel";
import { StatusBadge } from "./status-badge";
import { TrustSafetyNotice } from "./trust-safety-notice";

export function MilestoneCard({
  job,
  milestone,
  applicationGate,
}: {
  job: TConvexDoc<"jobs">;
  milestone: TConvexDoc<"milestones">;
  applicationGate: TMilestoneApplicationGate;
}) {
  const applications = useQuery(api.applications.listApplicationsByMilestone, {
    milestoneId: milestone._id as TConvexId<"milestones">,
  });
  const escrow = useQuery(api.escrows.getEscrowByMilestoneId, {
    milestoneId: milestone._id as TConvexId<"milestones">,
  });
  const safeApplications = applications ?? [];
  const isFunded =
    milestone.status === "funded" ||
    milestone.status === "submitted" ||
    milestone.status === "released";

  return (
    <article className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
            Milestone {milestone.order}
          </p>
          <h3 className="hr-text-primary font-sans text-lg font-semibold">{milestone.title}</h3>
          {milestone.description ? (
            <p className="hr-text-secondary font-sans text-sm leading-relaxed">
              {milestone.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StatusBadge label={milestone.status} />
          {milestone.escrowId ? (
            <Link
              href={`/proof/${encodeURIComponent(milestone.escrowId)}`}
              className="inline-flex items-center rounded-lg border border-highrable-orange-2/30 px-2.5 py-1 text-xs font-medium text-highrable-orange-3 hover:bg-highrable-orange-2/5"
            >
              View proof
            </Link>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <div>
          <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
            Amount
          </dt>
          <dd className="hr-text-primary font-sans font-semibold">
            {formatAmount(milestone.amount)} {formatAssetLabel(milestone.asset)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
            Assigned freelancer
          </dt>
          <dd className="hr-text-primary font-sans font-semibold">
            {milestone.assignedFreelancerWallet ? (
              <Link
                href={`/freelancers/${encodeURIComponent(milestone.assignedFreelancerWallet)}`}
                className="transition-colors hover:text-highrable-orange-3"
              >
                {shortenWalletAddress(milestone.assignedFreelancerWallet)}
              </Link>
            ) : (
              shortenWalletAddress(milestone.assignedFreelancerWallet)
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
            Applications
          </dt>
          <dd className="hr-text-primary font-sans font-semibold">{safeApplications.length}</dd>
        </div>
      </dl>

      <DeadlineBadge
        deadlineAt={milestone.deadlineAt}
        submittedAt={milestone.submittedAt}
        completedAt={milestone.completedAt}
        approvedAt={milestone.approvedAt}
        escrowStatus={escrow?.status}
        workStatus={milestone.status}
      />

      <TrustSafetyNotice type={isFunded ? "verified_funded" : "unfunded"} compact />
      {!isFunded ? (
        <p className="text-sm text-amber-800">
          Milestone {milestone.order} is not funded yet. Verified Funded applies only to each
          specific milestone.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <MilestoneContinuationPanel
            job={job}
            milestone={milestone}
            applicationGate={applicationGate}
          />
          <div className="space-y-3">
            <h4 className="hr-text-primary font-sans text-sm font-semibold">Apply</h4>
            <ApplyToMilestoneForm
              job={job}
              milestone={milestone}
              applicationGate={applicationGate}
              applications={safeApplications}
            />
          </div>
          <div className="space-y-3">
            <h4 className="hr-text-primary font-sans text-sm font-semibold">Applications</h4>
            <MilestoneApplicationsList
              job={job}
              milestone={milestone}
              applicationGate={applicationGate}
              applications={applications}
              isLoading={applications === undefined}
            />
          </div>
        </div>

        <MilestoneActionPanel
          job={job}
          milestone={milestone}
          applicationGate={applicationGate}
          escrow={escrow}
          applications={safeApplications}
        />
      </div>
    </article>
  );
}
