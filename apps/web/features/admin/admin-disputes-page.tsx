"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AdminSessionGate } from "@/features/admin/admin-session-gate";
import {
  AdminDisputeQueue,
  AdminMetricRail,
  AdminSection,
} from "@/features/admin/components/admin-operations-ui";
import { fetchAdminDisputes } from "@/features/admin/lib/admin-api";
import { ProductPageHero, RouteCallout, RouteEmptyState } from "@/features/common";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { IAdminDisputeListItem } from "@/features/admin/types";
import type { TDisputeOnChainStatus, TDisputeStatus } from "@/features/disputes/types";

const ADMIN_DISPUTE_LIMIT = 120;

type TStatusFilter = "" | TDisputeStatus;
type TOnChainFilter = "" | TDisputeOnChainStatus;

interface IFilterOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
}

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
] satisfies readonly IFilterOption<TStatusFilter>[];

const ON_CHAIN_FILTER_OPTIONS = [
  { value: "", label: "All on-chain states" },
  { value: "not_marked", label: "Not marked" },
  { value: "marking", label: "Marking" },
  { value: "marked", label: "Marked" },
  { value: "mark_failed", label: "Mark failed" },
] satisfies readonly IFilterOption<TOnChainFilter>[];

function isStatusFilter(value: string): value is TStatusFilter {
  return STATUS_FILTER_OPTIONS.some((option) => option.value === value);
}

function isOnChainFilter(value: string): value is TOnChainFilter {
  return ON_CHAIN_FILTER_OPTIONS.some((option) => option.value === value);
}

export function AdminDisputesPage() {
  const { role, isLoading: isRoleLoading } = useDashboardRole();
  const { authSession } = useWallet();
  const [statusFilter, setStatusFilter] = useState<TStatusFilter>("");
  const [onChainFilter, setOnChainFilter] = useState<TOnChainFilter>("");
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
        limit: ADMIN_DISPUTE_LIMIT,
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

  const queueMetrics = useMemo(
    () => [
      {
        label: "Visible disputes",
        value: disputes.length,
        description: `Showing up to ${ADMIN_DISPUTE_LIMIT} cases for the selected filters.`,
      },
      {
        label: "Open",
        value: disputes.filter((dispute) => dispute.status === "open").length,
        description: "New cases waiting for admin triage.",
      },
      {
        label: "Mark failed",
        value: disputes.filter((dispute) => dispute.onChainStatus === "mark_failed").length,
        description: "Cases requiring on-chain retry attention.",
      },
      {
        label: "Resolved",
        value: disputes.filter(
          (dispute) =>
            dispute.status === "resolved_client" ||
            dispute.status === "resolved_freelancer" ||
            dispute.status === "split_resolution",
        ).length,
        description: "Cases already moved into a terminal resolution state.",
      },
    ],
    [disputes],
  );

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
    <div className="space-y-6">
      <ProductPageHero
        label="Manual Review"
        title={
          <>
            Admin <span className="hr-v2-gradient-text">Dispute Console</span>
          </>
        }
        description="Filter disputes, inspect review state, and move cases into the detailed settlement workflow."
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <AppButton asChild variant="secondary" size="sm">
          <Link href="/admin">Back to Admin</Link>
        </AppButton>
        <AppButton size="sm" onClick={() => void loadDisputes()} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </AppButton>
      </div>

      <AdminSection
        label="Queue Controls"
        title="Review filters"
        description="Filters are constrained to known dispute states before they are sent to the admin API."
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,260px)_1fr] md:items-end">
          <label className="grid gap-1.5 text-sm text-[#5f5f5f]">
            <span className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
              Status
            </span>
            <NativeSelect
              value={statusFilter}
              onChange={(event) => {
                const nextValue = event.target.value;
                setStatusFilter(isStatusFilter(nextValue) ? nextValue : "");
              }}
              className="h-11 w-[260px] max-w-full rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>

          <label className="grid gap-1.5 text-sm text-[#5f5f5f]">
            <span className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
              On-chain status
            </span>
            <NativeSelect
              value={onChainFilter}
              onChange={(event) => {
                const nextValue = event.target.value;
                setOnChainFilter(isOnChainFilter(nextValue) ? nextValue : "");
              }}
              className="h-11 w-[260px] max-w-full rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            >
              {ON_CHAIN_FILTER_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>

          <p className="text-sm leading-relaxed text-[#5f5f5f]">
            Use the filters to isolate active review states, failed on-chain marks, or completed
            settlement outcomes.
          </p>
        </div>
      </AdminSection>

      <AdminSection
        label="Queue Health"
        title="Visible workload"
        description="Counts are computed from the currently loaded dispute set."
      >
        <AdminMetricRail items={queueMetrics} />
      </AdminSection>

      {error ? <RouteCallout tone="danger">{error}</RouteCallout> : null}

      <AdminSection
        label="Dispute Queue"
        title="Review cases"
        description="Open a case to inspect evidence, update review status, or record settlement."
      >
        {isLoading ? (
          <RouteCallout>Loading disputes...</RouteCallout>
        ) : (
          <AdminDisputeQueue
            disputes={disputes}
            actionLabel="Review"
            emptyState={<RouteEmptyState description="No disputes match the selected filters." />}
          />
        )}
      </AdminSection>
    </div>
  );
}
