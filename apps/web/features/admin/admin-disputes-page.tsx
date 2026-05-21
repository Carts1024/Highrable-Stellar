"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AdminSessionGate } from "@/features/admin/admin-session-gate";
import { fetchAdminDisputes } from "@/features/admin/lib/admin-api";
import { RouteCallout, RouteEmptyState, RoutePanel, RoutePanelHeader } from "@/features/common";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "@/features/disputes";
import { formatDisputeDate } from "@/features/disputes/lib";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { IAdminDisputeListItem } from "@/features/admin/types";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under review" },
  { value: "awaiting_client_response", label: "Awaiting client" },
  { value: "awaiting_freelancer_response", label: "Awaiting freelancer" },
  { value: "resolved_client", label: "Resolved client" },
  { value: "resolved_freelancer", label: "Resolved freelancer" },
  { value: "split_resolution", label: "Split resolution" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const ON_CHAIN_FILTER_OPTIONS = [
  { value: "", label: "All on-chain states" },
  { value: "not_marked", label: "Not marked" },
  { value: "marking", label: "Marking" },
  { value: "marked", label: "Marked" },
  { value: "mark_failed", label: "Mark failed" },
] as const;

export function AdminDisputesPage() {
  const { role, isLoading: isRoleLoading } = useDashboardRole();
  const { authSession } = useWallet();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [onChainFilter, setOnChainFilter] = useState<string>("");
  const [disputes, setDisputes] = useState<IAdminDisputeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDisputes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchAdminDisputes({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(onChainFilter ? { onChainStatus: onChainFilter } : {}),
        limit: 120,
      });
      setDisputes(response.disputes);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load disputes.");
      setDisputes([]);
    } finally {
      setIsLoading(false);
    }
  }, [onChainFilter, statusFilter]);

  useEffect(() => {
    if (role !== "admin" || !authSession) {
      return;
    }

    void loadDisputes();
  }, [authSession, loadDisputes, role]);

  if (isRoleLoading) {
    return <p className="hr-text-secondary text-sm">Loading wallet access...</p>;
  }

  if (role === null) {
    return (
      <WalletRequiredNotice
        title="Admin Dispute Console"
        description="Connect the configured admin wallet to manage disputes."
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
    <RoutePanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoutePanelHeader
          className="w-full border-b-0 px-0 pb-0"
          eyebrow="Manual Review"
          title="Admin Dispute Console"
          description="Filter disputes, inspect dispute state, and open the detailed review view."
          action={
            <>
              <AppButton asChild variant="secondary" size="sm">
                <Link href="/admin">Back to Admin</Link>
              </AppButton>
              <AppButton size="sm" onClick={() => void loadDisputes()} disabled={isLoading}>
                {isLoading ? "Refreshing..." : "Refresh"}
              </AppButton>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="hr-text-secondary grid gap-1 text-sm">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="hr-text-secondary grid gap-1 text-sm">
          <span>On-chain status</span>
          <select
            value={onChainFilter}
            onChange={(event) => setOnChainFilter(event.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            {ON_CHAIN_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <RouteCallout tone="danger">{error}</RouteCallout> : null}

      {isLoading ? (
        <RouteCallout>Loading disputes...</RouteCallout>
      ) : disputes.length === 0 ? (
        <RouteEmptyState description="No disputes match the selected filters." />
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <article key={dispute.disputeId} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="hr-text-muted font-mono text-xs uppercase">
                    {dispute.disputeNumber}
                  </p>
                  <h2 className="hr-text-primary mt-1 text-base font-semibold">{dispute.title}</h2>
                  <p className="hr-text-secondary mt-1 text-xs">
                    Opened {formatDisputeDate(dispute.openedAt)} | Updated{" "}
                    {formatDisputeDate(dispute.updatedAt)}
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
                    Review Dispute
                  </Link>
                </AppButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </RoutePanel>
  );
}
