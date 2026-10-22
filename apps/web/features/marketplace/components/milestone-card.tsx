"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { ModeOnly } from "@/features/mode";
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
    <article className="space-y-4 rounded-lg border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="hr-text-primary font-sans text-base font-semibold">
            <span className="hr-text-muted mr-2 font-normal">{milestone.order}.</span>
            {milestone.title}
          </h3>
          {milestone.description ? (
            <p className="hr-text-secondary font-sans text-sm leading-relaxed">
              {milestone.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <StatusBadge label={milestone.status} />
          {milestone.escrowId ? (
            <Link
              href={`/proof/${encodeURIComponent(milestone.escrowId)}`}
              className="hr-mode-text text-xs hover:underline"
            >
              Payment proof
            </Link>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="hr-text-secondary text-xs">Amount</dt>
          <dd className="hr-text-primary font-sans font-medium">
            {formatAmount(milestone.amount)} {formatAssetLabel(milestone.asset)}
          </dd>
        </div>
        <div>
          <dt className="hr-text-secondary text-xs">Assigned freelancer</dt>
          <dd className="hr-text-primary font-sans font-medium">
            {milestone.assignedFreelancerWallet ? (
              <Link
                href={`/freelancers/${encodeURIComponent(milestone.assignedFreelancerWallet)}`}
                className="font-mono hover:underline"
              >
                {shortenWalletAddress(milestone.assignedFreelancerWallet)}
              </Link>
            ) : (
              shortenWalletAddress(milestone.assignedFreelancerWallet)
            )}
          </dd>
        </div>
        <div>
          <dt className="hr-text-secondary text-xs">Applications</dt>
          <dd className="hr-text-primary font-sans font-medium">{safeApplications.length}</dd>
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

      {!isFunded ? <TrustSafetyNotice type="unfunded" compact /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <MilestoneContinuationPanel
            job={job}
            milestone={milestone}
            applicationGate={applicationGate}
          />
          <ModeOnly mode="freelancer">
            <div className="space-y-3">
              <h4 className="hr-text-primary font-sans text-sm font-semibold">
                Apply for this milestone
              </h4>
              <ApplyToMilestoneForm
                job={job}
                milestone={milestone}
                applicationGate={applicationGate}
                applications={safeApplications}
              />
            </div>
          </ModeOnly>
          <ModeOnly mode="client">
            <div className="space-y-3">
              <h4 className="hr-text-primary font-sans text-sm font-semibold">
                People who applied
              </h4>
              <MilestoneApplicationsList
                job={job}
                milestone={milestone}
                applicationGate={applicationGate}
                applications={applications}
                isLoading={applications === undefined}
              />
            </div>
          </ModeOnly>
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
