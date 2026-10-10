"use client";

import { AdminRouteLoadingState } from "@/features/admin/admin-route-fallbacks";
import {
  AdminSessionGate,
  ADMIN_QUERY_KEY,
  useAdminSessionAccess,
} from "@/features/admin/admin-session-gate";
import {
  AdminDisputeQueue,
  AdminMetricRail,
  AdminSection,
} from "@/features/admin/components/admin-operations-ui";
import {
  AdminApiError,
  fetchAdminMembershipManagement,
  fetchAdminDisputes,
  getAdminApiErrorMessage,
  isAdminAccessError,
  isAdminNetworkError,
  shouldRetryAdminRead,
  postAdminAssignDispute,
  postAdminClaimDispute,
} from "@/features/admin/lib/admin-api";
import { invalidateAdminDisputeCaches } from "@/features/admin/lib/admin-query-cache";
import { dedupeAdminWallets } from "@/features/admin/lib/assignment-validation";
import { ProductPageHero, RouteCallout, RouteEmptyState } from "@/features/common";
import {
  DISPUTE_ON_CHAIN_STATUS_OPTIONS,
  DISPUTE_STATUS_OPTIONS,
  isDisputeOnChainStatus,
  isDisputeStatus,
  isTerminalDisputeStatus,
} from "@/features/disputes/lib";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import type { TAdminAssignmentFilter } from "@/features/admin/lib/admin-api";
import type { IAdminDisputesResponse } from "@/features/admin/types";
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
  ...DISPUTE_STATUS_OPTIONS,
] satisfies readonly IFilterOption<TStatusFilter>[];

const ON_CHAIN_FILTER_OPTIONS = [
  { value: "", label: "All on-chain states" },
  ...DISPUTE_ON_CHAIN_STATUS_OPTIONS,
] satisfies readonly IFilterOption<TOnChainFilter>[];

function isStatusFilter(value: string): value is TStatusFilter {
  return value === "" || isDisputeStatus(value);
}

function isOnChainFilter(value: string): value is TOnChainFilter {
  return value === "" || isDisputeOnChainStatus(value);
}

function AdminDisputesContent() {
  const { verifiedWallet, isOwner, handleProtectedApiError } = useAdminSessionAccess();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TStatusFilter>("");
  const [onChainFilter, setOnChainFilter] = useState<TOnChainFilter>("");
  const [assignmentFilter, setAssignmentFilter] = useState<TAdminAssignmentFilter>("all");
  const [busyDisputeId, setBusyDisputeId] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [assignmentRefreshFailed, setAssignmentRefreshFailed] = useState(false);

  const adminsQuery = useQuery({
    queryKey: [...ADMIN_QUERY_KEY, "admins", verifiedWallet],
    queryFn: ({ signal }) => fetchAdminMembershipManagement({ signal }),
    enabled: isOwner,
    retry: shouldRetryAdminRead,
  });

  const disputeQuery = useQuery<IAdminDisputesResponse, AdminApiError>({
    queryKey: [
      ...ADMIN_QUERY_KEY,
      "disputes",
      verifiedWallet,
      statusFilter,
      onChainFilter,
      assignmentFilter,
    ],
    queryFn: ({ signal }) =>
      fetchAdminDisputes(
        {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(onChainFilter ? { onChainStatus: onChainFilter } : {}),
          assignmentFilter,
          limit: ADMIN_DISPUTE_LIMIT,
        },
        { signal },
      ),
    retry: shouldRetryAdminRead,
  });

  useEffect(() => {
    if (disputeQuery.error) {
      handleProtectedApiError(disputeQuery.error);
    }
  }, [disputeQuery.error, handleProtectedApiError]);

  useEffect(() => {
    if (adminsQuery.error) {
      handleProtectedApiError(adminsQuery.error);
    }
  }, [adminsQuery.error, handleProtectedApiError]);

  const disputes = disputeQuery.data?.disputes ?? [];
  const activeAdminWallets = adminsQuery.isSuccess
    ? dedupeAdminWallets([
        verifiedWallet,
        ...adminsQuery.data.admins
          .filter((admin) => admin.accessState === "active")
          .map((admin) => admin.wallet),
      ])
    : [];
  const assignmentReady = !isOwner || adminsQuery.isSuccess;
  const runAssignmentAction = async (
    disputeId: string,
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<void> => {
    if (busyDisputeId !== null) {
      return;
    }

    setBusyDisputeId(disputeId);
    setAssignmentError(null);
    setAssignmentSuccess(null);
    setAssignmentRefreshFailed(false);
    let assignmentWriteSucceeded = false;
    try {
      await action();
      assignmentWriteSucceeded = true;
      await invalidateAdminDisputeCaches(queryClient, verifiedWallet, disputeId);
      const refreshed = await disputeQuery.refetch();
      if (refreshed.error) {
        throw refreshed.error;
      }
      setAssignmentSuccess(successMessage);
    } catch (error) {
      handleProtectedApiError(error);
      if (isAdminAccessError(error)) {
        return;
      }

      if (assignmentWriteSucceeded) {
        setAssignmentRefreshFailed(true);
        setAssignmentError(
          "The case assignment was saved, but the queue could not be refreshed. Retry the read; the assignment will not be repeated.",
        );
      } else {
        setAssignmentError(error instanceof Error ? error.message : "Case assignment failed.");
      }
    } finally {
      setBusyDisputeId(null);
    }
  };
  const handleQueueReadRetry = async (): Promise<void> => {
    if (disputeQuery.isFetching) {
      return;
    }

    const refreshed = await disputeQuery.refetch();
    if (refreshed.error) {
      return;
    }

    setAssignmentRefreshFailed(false);
    setAssignmentError(null);
  };
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
        value: disputes.filter((dispute) => isTerminalDisputeStatus(dispute.status)).length,
        description: "Cases already moved into a terminal resolution state.",
      },
    ],
    [disputes],
  );

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
        <AppButton
          size="sm"
          onClick={() => void handleQueueReadRetry()}
          disabled={disputeQuery.isFetching}
        >
          {disputeQuery.isFetching ? "Refreshing..." : "Refresh"}
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

          <label htmlFor="assignment-filter" className="grid gap-1.5 text-sm text-[#5f5f5f]">
            <span className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
              Assignment
            </span>
            <NativeSelect
              id="assignment-filter"
              value={assignmentFilter}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === "unassigned" || nextValue === "mine" || nextValue === "all") {
                  setAssignmentFilter(nextValue);
                }
              }}
              className="h-11 w-[260px] max-w-full rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            >
              <NativeSelectOption value="unassigned">Unassigned</NativeSelectOption>
              <NativeSelectOption value="mine">My cases</NativeSelectOption>
              <NativeSelectOption value="all">All cases</NativeSelectOption>
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

      {isOwner && adminsQuery.isPending ? (
        <RouteCallout tone="warning" role="status">
          Loading eligible dispute admins. Assignment controls remain disabled until membership is
          verified.
        </RouteCallout>
      ) : null}

      {isOwner && adminsQuery.isError && !isAdminAccessError(adminsQuery.error) ? (
        <RouteCallout tone="danger">
          Could not load eligible dispute admins. Assignment controls remain disabled until the
          membership read succeeds.{" "}
          {adminsQuery.error instanceof AdminApiError
            ? getAdminApiErrorMessage(adminsQuery.error)
            : "Retry the membership read."}
          <AppButton
            type="button"
            variant="secondary"
            size="sm"
            className="ml-3"
            onClick={() => void adminsQuery.refetch()}
            disabled={adminsQuery.isFetching}
          >
            {adminsQuery.isFetching ? "Retrying..." : "Retry membership"}
          </AppButton>
        </RouteCallout>
      ) : null}

      {assignmentError ? (
        <RouteCallout tone="danger">
          {assignmentError}
          {assignmentRefreshFailed ? (
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              className="ml-3"
              onClick={() => void handleQueueReadRetry()}
              disabled={disputeQuery.isFetching}
            >
              {disputeQuery.isFetching ? "Retrying..." : "Retry read"}
            </AppButton>
          ) : null}
        </RouteCallout>
      ) : null}
      {assignmentSuccess ? <RouteCallout tone="success">{assignmentSuccess}</RouteCallout> : null}

      {disputeQuery.isError && !assignmentRefreshFailed ? (
        <RouteCallout tone="danger">
          {disputeQuery.error.status === 400
            ? "The dispute queue request was invalid. Check the selected filters and retry."
            : disputeQuery.error.status === 401
              ? "Admin authentication is required before the dispute queue can be read."
              : disputeQuery.error.status === 403
                ? "Admin access is forbidden for this wallet."
                : isAdminNetworkError(disputeQuery.error)
                  ? "The dispute queue could not be reached. Check your connection and retry."
                  : getAdminApiErrorMessage(disputeQuery.error)}
          <AppButton
            type="button"
            variant="secondary"
            size="sm"
            className="ml-3"
            onClick={() => void handleQueueReadRetry()}
            disabled={disputeQuery.isFetching}
          >
            Retry
          </AppButton>
        </RouteCallout>
      ) : null}

      {!disputeQuery.isError ? (
        <>
          {disputeQuery.data ? (
            <AdminSection
              label="Queue Health"
              title="Visible workload"
              description="Counts are computed from the currently loaded dispute set."
            >
              <AdminMetricRail items={queueMetrics} />
            </AdminSection>
          ) : null}

          <AdminSection
            label="Dispute Queue"
            title="Review cases"
            description="Open a case to inspect evidence, update review status, or record settlement."
          >
            {disputeQuery.isPending ? (
              <AdminRouteLoadingState label="disputes" />
            ) : (
              <AdminDisputeQueue
                disputes={disputes}
                actionLabel="Review"
                verifiedWallet={verifiedWallet}
                isOwner={isOwner}
                activeAdminWallets={activeAdminWallets}
                assignmentReady={assignmentReady}
                busyDisputeId={busyDisputeId}
                onClaim={(disputeId) =>
                  void runAssignmentAction(
                    disputeId,
                    () => postAdminClaimDispute(disputeId),
                    "Case claimed.",
                  )
                }
                onAssign={(disputeId, assignedWallet) =>
                  void runAssignmentAction(
                    disputeId,
                    () => postAdminAssignDispute(disputeId, assignedWallet),
                    assignedWallet ? "Case assignment updated." : "Case unassigned.",
                  )
                }
                emptyState={
                  <RouteEmptyState description="No disputes match the selected filters." />
                }
              />
            )}
          </AdminSection>
        </>
      ) : null}
    </div>
  );
}

export function AdminDisputesPage() {
  return (
    <AdminSessionGate>
      <AdminDisputesContent />
    </AdminSessionGate>
  );
}
