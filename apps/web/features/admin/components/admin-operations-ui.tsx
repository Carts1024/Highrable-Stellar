"use client";

import {
  canClaimAdminDispute,
  getEligibleAdminWallets,
  isDisputeParticipant,
  normalizeAdminWallet,
} from "@/features/admin/lib/assignment-validation";
import { StatCard } from "@/features/common";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "@/features/disputes";
import { formatDisputeDate, getDisputeReasonLabel } from "@/features/disputes/lib";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import React, { type ReactNode } from "react";

import type { IAdminDisputeListItem } from "@/features/admin/types";

export interface IAdminMetricItem {
  readonly label: string;
  readonly value: number | string;
  readonly description?: ReactNode;
}

export interface IAdminBreakdownGroup {
  readonly title: string;
  readonly description: string;
  readonly values: Record<string, number>;
  readonly formatLabel?: (label: string) => string;
}

interface IAdminSectionProps {
  readonly title: ReactNode;
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
  readonly verifiedWallet?: string;
  readonly isOwner?: boolean;
  readonly activeAdminWallets?: readonly string[];
  readonly assignmentReady?: boolean;
  readonly busyDisputeId?: string | null;
  readonly onClaim?: (disputeId: string) => void;
  readonly onAssign?: (disputeId: string, assignedAdminWallet: string | null) => void;
}

function formatBreakdownLabel(label: string): string {
  return label.replaceAll("_", " ");
}

function getSortedBreakdownRows(values: Record<string, number>): Array<readonly [string, number]> {
  return Object.entries(values).sort(([left], [right]) => left.localeCompare(right));
}

export function AdminSection({
  title,
  description,
  action,
  children,
  className,
}: IAdminSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="hr-text-primary text-base font-semibold">{title}</h2>
          {description ? (
            <p className="hr-text-secondary mt-0.5 text-sm leading-relaxed">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminMetricRail({ items }: IAdminMetricRailProps) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-card p-4">
          <StatCard label={item.label} value={item.value} description={item.description} />
        </div>
      ))}
    </div>
  );
}

export function AdminBreakdownMatrix({ groups }: IAdminBreakdownMatrixProps) {
  return (
    <div className="divide-y overflow-hidden rounded-lg border">
      {groups.map((group) => {
        const rows = getSortedBreakdownRows(group.values);

        return (
          <div
            key={group.title}
            className="grid gap-4 p-4 lg:grid-cols-[minmax(180px,0.45fr)_minmax(0,1fr)] lg:items-start"
          >
            <div>
              <h3 className="hr-text-primary text-sm font-medium">{group.title}</h3>
              <p className="hr-text-muted mt-0.5 text-xs leading-relaxed">{group.description}</p>
            </div>
            <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="hr-text-secondary text-sm capitalize">
                    {group.formatLabel?.(label) ?? formatBreakdownLabel(label)}
                  </dt>
                  <dd className="hr-text-primary hr-num text-sm font-medium">{value}</dd>
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
  verifiedWallet,
  isOwner = false,
  activeAdminWallets = [],
  assignmentReady = true,
  busyDisputeId,
  onClaim,
  onAssign,
}: IAdminDisputeQueueProps) {
  if (disputes.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="hr-text-secondary hidden grid-cols-[minmax(220px,1fr)_180px_220px_130px] gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium lg:grid">
        <span>Dispute</span>
        <span>Reason</span>
        <span>Status</span>
        <span className="text-right">Action</span>
      </div>

      <div className="divide-y">
        {disputes.map((dispute) => (
          <article
            key={dispute.disputeId}
            className="grid gap-3 px-4 py-3 hover:bg-muted/30 lg:grid-cols-[minmax(220px,1fr)_180px_220px_130px] lg:items-center lg:gap-4"
          >
            {(() => {
              const normalizedAssignedWallet = normalizeAdminWallet(dispute.assignedAdminWallet);
              const eligibleAdminWallets = getEligibleAdminWallets(dispute, activeAdminWallets);
              const isParticipant = isDisputeParticipant(dispute, verifiedWallet);
              const canAssign = isOwner && Boolean(onAssign) && assignmentReady && !isParticipant;
              const assignedWalletIsUnavailable =
                Boolean(normalizedAssignedWallet) &&
                !eligibleAdminWallets.includes(normalizedAssignedWallet);
              const canClaim =
                Boolean(onClaim) && canClaimAdminDispute(dispute, verifiedWallet ?? "");

              return (
                <>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-[#7f7f7f]">{dispute.disputeNumber}</p>
                    <h3 className="hr-text-primary mt-0.5 text-sm font-medium">{dispute.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#5f5f5f]">
                      {compact ? "Updated" : "Opened"}{" "}
                      {formatDisputeDate(compact ? dispute.updatedAt : dispute.openedAt)}
                      {!compact ? ` | Updated ${formatDisputeDate(dispute.updatedAt)}` : null}
                    </p>
                    <p className="mt-0.5 text-xs break-all text-[#7f7f7f]">
                      Assigned: {dispute.assignedAdminWallet ?? "Unassigned"}
                    </p>
                  </div>

                  <p className="text-sm text-[#5f5f5f]">
                    {getDisputeReasonLabel(dispute.reasonCategory)}
                  </p>

                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <DisputeStatusBadge status={dispute.status} />
                    <DisputeOnChainStatusBadge status={dispute.onChainStatus} />
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                    {canClaim ? (
                      <AppButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busyDisputeId === dispute.disputeId}
                        onClick={() => onClaim?.(dispute.disputeId)}
                      >
                        {busyDisputeId === dispute.disputeId ? "Claiming..." : "Claim"}
                      </AppButton>
                    ) : null}
                    {isOwner && onAssign ? (
                      <select
                        aria-label={`Assign ${dispute.disputeNumber}`}
                        className="h-8 max-w-44 rounded-md border bg-white px-2 text-xs"
                        value={normalizedAssignedWallet}
                        disabled={busyDisputeId === dispute.disputeId || !canAssign}
                        onChange={(event) =>
                          onAssign(dispute.disputeId, event.target.value || null)
                        }
                      >
                        <option value="">Unassigned</option>
                        {assignedWalletIsUnavailable ? (
                          <option value={normalizedAssignedWallet} disabled>
                            Unavailable: {normalizedAssignedWallet}
                          </option>
                        ) : null}
                        {eligibleAdminWallets.map((wallet) => (
                          <option key={wallet} value={wallet}>
                            {wallet === normalizeAdminWallet(verifiedWallet)
                              ? "Owner (you)"
                              : wallet}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <AppButton asChild variant="secondary" size="sm">
                      <Link href={`/admin/disputes/${encodeURIComponent(dispute.disputeId)}`}>
                        {actionLabel}
                      </Link>
                    </AppButton>
                  </div>
                </>
              );
            })()}
          </article>
        ))}
      </div>
    </div>
  );
}
