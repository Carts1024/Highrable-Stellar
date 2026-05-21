"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AdminSessionGate } from "@/features/admin/admin-session-gate";
import { fetchAdminMetrics } from "@/features/admin/lib/admin-api";
import { ProductPageHero, RouteCallout, RouteEmptyState, RoutePanel } from "@/features/common";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "@/features/disputes";
import { formatDisputeDate } from "@/features/disputes/lib";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { IAdminDashboardMetrics } from "@/features/admin/types";

interface ISummaryMetricCardProps {
  readonly label: string;
  readonly value: number;
  readonly className?: string;
}

function CountTable({
  title,
  values,
}: {
  readonly title: string;
  readonly values: Record<string, number>;
}) {
  const rows = useMemo(
    () => Object.entries(values).sort(([a], [b]) => a.localeCompare(b)),
    [values],
  );

  return (
    <RoutePanel className="p-4">
      <h2 className="hr-text-primary text-sm font-semibold tracking-wide uppercase">{title}</h2>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="hr-text-secondary">{label.replaceAll("_", " ")}</span>
            <span className="hr-text-primary font-medium">{value}</span>
          </div>
        ))}
      </div>
    </RoutePanel>
  );
}

function SummaryMetricCard({ label, value, className }: ISummaryMetricCardProps) {
  return (
    <RoutePanel className={cn("p-4", className)}>
      <p className="hr-label-caps hr-text-muted">{label}</p>
      <p className="hr-text-primary mt-2 text-2xl font-semibold">{value}</p>
    </RoutePanel>
  );
}

export function AdminDashboardPage() {
  const { role, isLoading: isRoleLoading } = useDashboardRole();
  const { authSession } = useWallet();
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
    if (role !== "admin" || !authSession) {
      return;
    }

    void loadMetrics();
  }, [authSession, loadMetrics, role]);

  if (isRoleLoading) {
    return <p className="hr-text-secondary text-sm">Loading wallet access...</p>;
  }

  if (role === null) {
    return (
      <WalletRequiredNotice
        title="Admin Dashboard"
        description="Connect the configured admin wallet to access platform operations."
      />
    );
  }

  if (role !== "admin") {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        This route is restricted to the configured admin wallet.
      </section>
    );
  }

  if (!authSession) {
    return <AdminSessionGate>{null}</AdminSessionGate>;
  }

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
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryMetricCard label="Users" value={metrics.users.total} />
            <SummaryMetricCard label="Jobs" value={metrics.jobs.total} />
            <SummaryMetricCard label="Escrows" value={metrics.escrows.total} />
            <SummaryMetricCard label="Disputes" value={metrics.disputes.total} />
          </div>

          {metrics.isTruncated ? (
            <RouteCallout tone="warning">
              Metrics were computed from a capped dataset. Consider pagination-based admin analytics
              if data volume grows.
            </RouteCallout>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CountTable title="Users By Role" values={metrics.users.byRole} />
            <CountTable title="Jobs By Status" values={metrics.jobs.byStatus} />
            <CountTable title="Escrows By Status" values={metrics.escrows.byStatus} />
            <CountTable title="Disputes By Status" values={metrics.disputes.byStatus} />
            <CountTable title="Disputes By On-Chain" values={metrics.disputes.byOnChainStatus} />
            <CountTable title="Work Submissions" values={metrics.workSubmissions.byStatus} />
            <CountTable title="Work On-Chain" values={metrics.workSubmissions.byOnChainStatus} />
            <CountTable title="Revisions By Status" values={metrics.revisions.byStatus} />
            <CountTable title="Reminders By Status" values={metrics.deadlineReminders.byStatus} />
            <RoutePanel className="p-4">
              <h2 className="hr-text-primary text-sm font-semibold tracking-wide uppercase">
                Deadline Overdue Count
              </h2>
              <p className="hr-text-primary mt-2 text-2xl font-semibold">
                {metrics.deadlineReminders.overdueCount}
              </p>
            </RoutePanel>
          </div>

          <RoutePanel className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="hr-text-primary text-lg font-semibold">Recent Disputes</h2>
              <AppButton asChild variant="secondary" size="sm">
                <Link href="/admin/disputes">View All</Link>
              </AppButton>
            </div>

            {metrics.recentDisputes.length === 0 ? (
              <div className="mt-3">
                <RouteEmptyState description="No disputes found." />
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {metrics.recentDisputes.map((dispute) => (
                  <article key={dispute.disputeId} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="hr-text-muted font-mono text-xs uppercase">
                          {dispute.disputeNumber}
                        </p>
                        <h3 className="hr-text-primary mt-1 text-sm font-semibold">
                          {dispute.title}
                        </h3>
                        <p className="hr-text-secondary mt-1 text-xs">
                          Updated {formatDisputeDate(dispute.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <DisputeStatusBadge status={dispute.status} />
                        <DisputeOnChainStatusBadge status={dispute.onChainStatus} />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <AppButton asChild variant="secondary" size="sm">
                        <Link href={`/admin/disputes/${encodeURIComponent(dispute.disputeId)}`}>
                          Open Detail
                        </Link>
                      </AppButton>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </RoutePanel>
        </>
      )}
    </div>
  );
}
