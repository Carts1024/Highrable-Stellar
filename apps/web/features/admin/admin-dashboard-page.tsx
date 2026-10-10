"use client";

import { AdminSessionGate, useAdminSessionAccess } from "@/features/admin/admin-session-gate";
import {
  AdminBreakdownMatrix,
  AdminDisputeQueue,
  AdminMetricRail,
  AdminSection,
  type IAdminBreakdownGroup,
  type IAdminMetricItem,
} from "@/features/admin/components/admin-operations-ui";
import { fetchAdminMetrics } from "@/features/admin/lib/admin-api";
import { ProductPageHero, RouteCallout, RouteEmptyState } from "@/features/common";
import {
  getDisputeOnChainStatusLabel,
  getDisputeStatusLabel,
  isDisputeOnChainStatus,
  isDisputeStatus,
} from "@/features/disputes/lib";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { IAdminDashboardMetrics } from "@/features/admin/types";

export function AdminDashboardContent() {
  const { isOwner } = useAdminSessionAccess();
  const [metrics, setMetrics] = useState<IAdminDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchAdminMetrics();
      setMetrics(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load admin metrics.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOwner) {
      return;
    }

    void loadMetrics();
  }, [isOwner, loadMetrics]);

  const platformMetrics = useMemo<readonly IAdminMetricItem[]>(() => {
    if (!metrics) {
      return [];
    }

    return [
      {
        label: "Users",
        value: metrics.users.total,
        description: "Wallet identities known to the platform.",
      },
      {
        label: "Jobs",
        value: metrics.jobs.total,
        description: "Posted work across active and terminal states.",
      },
      {
        label: "Escrows",
        value: metrics.escrows.total,
        description: "Payment protection records mirrored from workflow activity.",
      },
      {
        label: "Disputes",
        value: metrics.disputes.total,
        description: "Manual review cases in the admin pipeline.",
      },
    ];
  }, [metrics]);

  const lifecycleGroups = useMemo<readonly IAdminBreakdownGroup[]>(() => {
    if (!metrics) {
      return [];
    }

    return [
      {
        title: "Users By Role",
        description: "Access segmentation for client, freelancer, and admin wallets.",
        values: metrics.users.byRole,
      },
      {
        title: "Jobs By Status",
        description: "Marketplace demand grouped by current work state.",
        values: metrics.jobs.byStatus,
      },
      {
        title: "Escrows By Status",
        description: "Escrow-backed stats for funding, release, and dispute readiness.",
        values: metrics.escrows.byStatus,
      },
      {
        title: "Disputes By Status",
        description: "Review queue state for open, waiting, and resolved cases.",
        values: metrics.disputes.byStatus,
        formatLabel: (label) =>
          isDisputeStatus(label) ? getDisputeStatusLabel(label) : formatBreakdownLabel(label),
      },
      {
        title: "Disputes By On-Chain",
        description: "On-chain marking state for dispute settlement integrity.",
        values: metrics.disputes.byOnChainStatus,
        formatLabel: (label) =>
          isDisputeOnChainStatus(label)
            ? getDisputeOnChainStatusLabel(label)
            : formatBreakdownLabel(label),
      },
    ];
  }, [metrics]);

  const workHistoryGroups = useMemo<readonly IAdminBreakdownGroup[]>(() => {
    if (!metrics) {
      return [];
    }

    return [
      {
        title: "Work Submissions",
        description: "Verified review inputs grouped by submission status.",
        values: metrics.workSubmissions.byStatus,
      },
      {
        title: "Work On-Chain",
        description: "Proof and work history sync health for on-chain records.",
        values: metrics.workSubmissions.byOnChainStatus,
      },
      {
        title: "Revisions By Status",
        description: "Revision loop pressure across active work agreements.",
        values: metrics.revisions.byStatus,
      },
      {
        title: "Reminders By Status",
        description: "Deadline reminder delivery state for overdue work prevention.",
        values: metrics.deadlineReminders.byStatus,
      },
    ];
  }, [metrics]);

  return (
    <div className="space-y-6">
      <ProductPageHero
        label="Platform Operations"
        title={
          <>
            Highrable <span className="hr-v2-gradient-text">Admin Console</span>
          </>
        }
        description="Monitor platform operations, review dispute pipeline health, and inspect lifecycle counts in one place."
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <AppButton asChild variant="secondary" size="sm">
          <Link href="/admin/disputes">Open Dispute Console</Link>
        </AppButton>
        <AppButton asChild variant="secondary" size="sm">
          <Link href="/admin/admins">Manage Dispute Admins</Link>
        </AppButton>
        <AppButton size="sm" onClick={() => void loadMetrics()} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh Metrics"}
        </AppButton>
      </div>

      {error ? <RouteCallout tone="danger">{error}</RouteCallout> : null}

      {!metrics ? (
        <RouteCallout>
          {isLoading ? "Loading admin metrics..." : "No metrics available yet."}
        </RouteCallout>
      ) : (
        <div className="space-y-6">
          <AdminSection
            label="Operations Snapshot"
            title="Platform totals"
            description="A compact read on the core platform objects before drilling into lifecycle health."
          >
            <AdminMetricRail items={platformMetrics} />
          </AdminSection>

          {metrics.isTruncated ? (
            <RouteCallout tone="warning">
              Metrics were computed from a capped dataset. Consider pagination-based admin analytics
              if data volume grows.
            </RouteCallout>
          ) : null}

          <AdminSection
            label="Escrow-backed Stats"
            title="Lifecycle breakdown"
            description="Grouped counts are organized by operational theme so unusual states are easier to scan."
          >
            <AdminBreakdownMatrix groups={lifecycleGroups} />
          </AdminSection>

          <AdminSection
            label="Verified Reviews"
            title="Work history health"
            description="Submission, revision, and reminder activity that feeds escrow-backed reputation."
          >
            <div className="space-y-5">
              <AdminMetricRail
                items={[
                  {
                    label: "Work submissions",
                    value: metrics.workSubmissions.total,
                    description: "Submitted deliverables available for review.",
                  },
                  {
                    label: "Revisions",
                    value: metrics.revisions.total,
                    description: "Revision requests attached to active work.",
                  },
                  {
                    label: "Reminders",
                    value: metrics.deadlineReminders.total,
                    description: "Deadline notices queued or delivered.",
                  },
                  {
                    label: "Overdue",
                    value: metrics.deadlineReminders.overdueCount,
                    description: "Deadline overdue count requiring attention.",
                  },
                ]}
              />
              <AdminBreakdownMatrix groups={workHistoryGroups} />
            </div>
          </AdminSection>

          <AdminSection
            label="Work History"
            title="Recent disputes"
            description="Newest review cases that may affect escrow settlement and portable reputation."
            action={
              <AppButton asChild variant="secondary" size="sm">
                <Link href="/admin/disputes">View All</Link>
              </AppButton>
            }
          >
            <AdminDisputeQueue
              disputes={metrics.recentDisputes}
              actionLabel="Open Detail"
              compact
              emptyState={<RouteEmptyState description="No disputes found." />}
            />
          </AdminSection>
        </div>
      )}
    </div>
  );
}

export function AdminDashboardPage() {
  return (
    <AdminSessionGate requiredCapability="owner">
      <AdminDashboardContent />
    </AdminSessionGate>
  );
}

function formatBreakdownLabel(label: string): string {
  return label.replaceAll("_", " ");
}
