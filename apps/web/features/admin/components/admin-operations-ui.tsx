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
  /** `card` draws a bordered container with a header strip; use it for forms and grouped facts. */
  readonly variant?: "plain" | "card";
  readonly bodyClassName?: string;
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

const QUEUE_GRID_COLUMNS = "lg:grid-cols-[minmax(0,1fr)_170px_190px_minmax(150px,auto)]";

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
  variant = "plain",
  bodyClassName,
}: IAdminSectionProps) {
  if (variant === "card") {
    return (
      <section className={cn("overflow-hidden rounded-lg border bg-card", className)}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="hr-text-primary text-sm font-semibold">{title}</h2>
            {description ? (
              <p className="hr-text-secondary mt-0.5 text-xs leading-relaxed">{description}</p>
            ) : null}
          </div>
          {action ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
          ) : null}
        </header>
        <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
      </section>
    );
  }

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
    <div className="overflow-hidden rounded-lg border bg-card">
      <div
        className={cn(
          "hr-text-secondary hidden gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium lg:grid",
          QUEUE_GRID_COLUMNS,
        )}
      >
        <span>Dispute</span>
        <span>Reason</span>
        <span>Status</span>
        <span className="text-right">Action</span>
      </div>

      <div className="divide-y">
        {disputes.map((dispute) => (
          <article
            key={dispute.disputeId}
            className={cn(
              "hr-clickable-card grid gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 lg:items-center lg:gap-4",
              QUEUE_GRID_COLUMNS,
            )}
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
                    <p className="hr-text-muted font-mono text-xs">{dispute.disputeNumber}</p>
                    <h3 className="mt-0.5 text-sm leading-snug font-medium">
                      <Link
                        href={`/admin/disputes/${encodeURIComponent(dispute.disputeId)}`}
                        className="hr-card-link hr-text-primary"
                      >
                        {dispute.title}
                      </Link>
                    </h3>
                    <p className="hr-text-secondary mt-1 text-xs leading-relaxed">
                      {compact ? "Updated" : "Opened"}{" "}
                      {formatDisputeDate(compact ? dispute.updatedAt : dispute.openedAt)}
                      {!compact ? ` · Updated ${formatDisputeDate(dispute.updatedAt)}` : null}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-xs",
                        dispute.assignedAdminWallet ? "hr-text-muted font-mono" : "text-amber-700",
                      )}
                      title={dispute.assignedAdminWallet ?? undefined}
                    >
                      Assigned: {dispute.assignedAdminWallet ?? "Unassigned"}
                    </p>
                  </div>

                  <p className="hr-text-secondary text-sm">
                    <span className="hr-text-muted text-xs lg:hidden">Reason: </span>
                    {getDisputeReasonLabel(dispute.reasonCategory)}
                  </p>

                  <div className="flex flex-col items-start gap-1">
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
                        title="Assign this case to a dispute admin"
                        className="h-8 w-40 truncate rounded-md border bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
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
