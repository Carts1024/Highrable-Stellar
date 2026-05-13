"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
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
    <article className="space-y-5 rounded-xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-[#7f7f7f] uppercase">
            Milestone {milestone.order}
          </p>
          <h3 className="text-lg font-semibold text-[#0a0a0a]">{milestone.title}</h3>
          {milestone.description ? (
            <p className="text-sm leading-relaxed text-[#5f5f5f]">{milestone.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StatusBadge label={milestone.status} />
        </div>
      </div>

      <dl className="grid gap-3 text-sm text-[#5f5f5f] sm:grid-cols-3">
        <div>
          <dt className="text-[#7f7f7f]">Amount</dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {formatAmount(milestone.amount)} {formatAssetLabel(milestone.asset)}
          </dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Assigned freelancer</dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {milestone.assignedFreelancerWallet ? (
              <Link
                href={`/freelancers/${encodeURIComponent(milestone.assignedFreelancerWallet)}`}
                className="hover:text-[#FF7003]"
              >
                {shortenWalletAddress(milestone.assignedFreelancerWallet)}
              </Link>
            ) : (
              shortenWalletAddress(milestone.assignedFreelancerWallet)
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Applications</dt>
          <dd className="font-semibold text-[#0a0a0a]">{safeApplications.length}</dd>
        </div>
      </dl>

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
            <h4 className="text-sm font-semibold text-[#0a0a0a]">Apply</h4>
            <ApplyToMilestoneForm
              job={job}
              milestone={milestone}
              applicationGate={applicationGate}
              applications={safeApplications}
            />
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-[#0a0a0a]">Applications</h4>
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
