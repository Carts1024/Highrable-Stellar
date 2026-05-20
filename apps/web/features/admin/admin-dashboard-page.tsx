"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AdminSessionGate } from "@/features/admin/admin-session-gate";
import { ProductPageHero } from "@/features/common";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { formatDisputeDate } from "@/features/disputes/lib";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "@/features/disputes";
import { fetchAdminMetrics } from "@/features/admin/lib/admin-api";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { IAdminDashboardMetrics } from "@/features/admin/types";

function CountTable({
  title,
  values,
}: {
  readonly title: string;
  readonly values: Record<string, number>;
}) {
  const rows = useMemo(() => Object.entries(values).sort(([a], [b]) => a.localeCompare(b)), [values]);

  return (
    <article className="rounded-xl border border-[#e8e8e8] bg-white p-4">
      <h2 className="text-sm font-semibold tracking-wide text-[#0a0a0a] uppercase">{title}</h2>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-[#5f5f5f]">{label.replaceAll("_", " ")}</span>
            <span className="font-medium text-[#0a0a0a]">{value}</span>
          </div>
        ))}
      </div>
    </article>
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
    return <p className="text-sm text-[#5f5f5f]">Loading wallet access...</p>;
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
            Highrable <span className="text-[#FF7003]">Admin Console</span>
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

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : null}

      {!metrics ? (
        <p className="rounded-xl border border-[#e8e8e8] bg-white p-4 text-sm text-[#5f5f5f]">
          {isLoading ? "Loading admin metrics..." : "No metrics available yet."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-[#e8e8e8] bg-white p-4">
              <p className="text-xs tracking-wide text-[#5f5f5f] uppercase">Users</p>
              <p className="mt-2 text-2xl font-semibold text-[#0a0a0a]">{metrics.users.total}</p>
            </article>
            <article className="rounded-xl border border-[#e8e8e8] bg-white p-4">
              <p className="text-xs tracking-wide text-[#5f5f5f] uppercase">Jobs</p>
              <p className="mt-2 text-2xl font-semibold text-[#0a0a0a]">{metrics.jobs.total}</p>
            </article>
            <article className="rounded-xl border border-[#e8e8e8] bg-white p-4">
              <p className="text-xs tracking-wide text-[#5f5f5f] uppercase">Escrows</p>
              <p className="mt-2 text-2xl font-semibold text-[#0a0a0a]">{metrics.escrows.total}</p>
            </article>
            <article className="rounded-xl border border-[#e8e8e8] bg-white p-4">
              <p className="text-xs tracking-wide text-[#5f5f5f] uppercase">Disputes</p>
              <p className="mt-2 text-2xl font-semibold text-[#0a0a0a]">{metrics.disputes.total}</p>
            </article>
          </div>

          {metrics.isTruncated ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Metrics were computed from a capped dataset. Consider pagination-based admin analytics if data volume grows.
            </p>
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
            <article className="rounded-xl border border-[#e8e8e8] bg-white p-4">
              <h2 className="text-sm font-semibold tracking-wide text-[#0a0a0a] uppercase">
                Deadline Overdue Count
              </h2>
              <p className="mt-2 text-2xl font-semibold text-[#0a0a0a]">
                {metrics.deadlineReminders.overdueCount}
              </p>
            </article>
          </div>

          <section className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[#0a0a0a]">Recent Disputes</h2>
              <AppButton asChild variant="secondary" size="sm">
                <Link href="/admin/disputes">View All</Link>
              </AppButton>
            </div>

            {metrics.recentDisputes.length === 0 ? (
              <p className="mt-3 text-sm text-[#5f5f5f]">No disputes found.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {metrics.recentDisputes.map((dispute) => (
                  <article key={dispute.disputeId} className="rounded-lg border border-[#ececec] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-[#5f5f5f] uppercase">{dispute.disputeNumber}</p>
                        <h3 className="mt-1 text-sm font-semibold text-[#0a0a0a]">{dispute.title}</h3>
                        <p className="mt-1 text-xs text-[#5f5f5f]">
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
          </section>
        </>
      )}
    </div>
  );
}
