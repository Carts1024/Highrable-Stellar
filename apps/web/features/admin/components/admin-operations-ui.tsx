"use client";

import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "@/features/disputes";
import { formatDisputeDate, getDisputeReasonLabel } from "@/features/disputes/lib";
import { HighrableV2Metric, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

import type { IAdminDisputeListItem } from "@/features/admin/types";
import type { ReactNode } from "react";

export interface IAdminMetricItem {
  readonly label: string;
  readonly value: number | string;
  readonly description?: ReactNode;
}

export interface IAdminBreakdownGroup {
  readonly title: string;
  readonly description: string;
  readonly values: Record<string, number>;
}

interface IAdminSectionProps {
  readonly label: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

interface IAdminMetricRailProps {
  readonly items: readonly IAdminMetricItem[];
}

interface IAdminBreakdownMatrixProps {
  readonly groups: readonly IAdminBreakdownGroup[];
}

interface IAdminDisputeQueueProps {
  readonly disputes: readonly IAdminDisputeListItem[];
  readonly emptyState: ReactNode;
  readonly actionLabel: string;
  readonly compact?: boolean;
}

function formatBreakdownLabel(label: string): string {
  return label.replaceAll("_", " ");
}

function getSortedBreakdownRows(values: Record<string, number>): Array<readonly [string, number]> {
  return Object.entries(values).sort(([left], [right]) => left.localeCompare(right));
}

export function AdminSection({
  label,
  title,
  description,
  action,
  children,
  className,
}: IAdminSectionProps) {
  return (
    <section className={cn("border border-[#e8e8e8] bg-white", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8e8e8] p-5 sm:p-6">
        <div className="max-w-3xl space-y-2">
          <SectionLabel>{label}</SectionLabel>
          <h2 className="text-xl font-semibold text-[#0a0a0a]">{title}</h2>
          {description ? (
            <p className="text-sm leading-relaxed text-[#5f5f5f]">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function AdminMetricRail({ items }: IAdminMetricRailProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <HighrableV2Metric
          key={item.label}
          label={item.label}
          value={item.value}
          description={item.description}
        />
      ))}
    </div>
  );
}

export function AdminBreakdownMatrix({ groups }: IAdminBreakdownMatrixProps) {
  return (
    <div className="divide-y divide-[#e8e8e8] border border-[#e8e8e8]">
      {groups.map((group) => {
        const rows = getSortedBreakdownRows(group.values);

        return (
          <div
            key={group.title}
            className="grid gap-4 p-4 lg:grid-cols-[minmax(180px,0.45fr)_minmax(0,1fr)] lg:items-start"
          >
            <div>
              <h3 className="font-mono text-xs tracking-[0.06em] text-[#0a0a0a] uppercase">
                {group.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#7f7f7f]">{group.description}</p>
            </div>
            <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-h-10 items-center justify-between gap-3 border-l border-[#e8e8e8] pl-3"
                >
                  <dt className="text-sm text-[#5f5f5f] capitalize">
                    {formatBreakdownLabel(label)}
                  </dt>
                  <dd className="font-mono text-sm font-medium text-[#0a0a0a]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

export function AdminDisputeQueue({
  disputes,
  emptyState,
  actionLabel,
  compact = false,
}: IAdminDisputeQueueProps) {
  if (disputes.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-hidden border border-[#e8e8e8]">
      <div className="hidden grid-cols-[minmax(220px,1fr)_180px_220px_130px] gap-4 border-b border-[#e8e8e8] bg-[#fafafa] px-4 py-3 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase lg:grid">
        <span>Dispute</span>
        <span>Reason</span>
        <span>Status</span>
        <span className="text-right">Action</span>
      </div>

      <div className="divide-y divide-[#e8e8e8]">
        {disputes.map((dispute) => (
          <article
            key={dispute.disputeId}
            className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(220px,1fr)_180px_220px_130px] lg:items-center"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
                {dispute.disputeNumber}
              </p>
              <h3 className="mt-1 font-semibold text-[#0a0a0a]">{dispute.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#5f5f5f]">
                {compact ? "Updated" : "Opened"}{" "}
                {formatDisputeDate(compact ? dispute.updatedAt : dispute.openedAt)}
                {!compact ? ` | Updated ${formatDisputeDate(dispute.updatedAt)}` : null}
              </p>
            </div>

            <p className="text-sm text-[#5f5f5f]">
              {getDisputeReasonLabel(dispute.reasonCategory)}
            </p>

            <div className="flex flex-wrap gap-2">
              <DisputeStatusBadge status={dispute.status} />
              <DisputeOnChainStatusBadge status={dispute.onChainStatus} />
            </div>

            <div className="flex justify-start lg:justify-end">
              <AppButton asChild variant="secondary" size="sm">
                <Link href={`/admin/disputes/${encodeURIComponent(dispute.disputeId)}`}>
                  {actionLabel}
                </Link>
              </AppButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
