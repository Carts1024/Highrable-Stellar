"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { AdminDashboardEntry } from "@/features/admin";
import { ProductPageHero, RouteCallout, StatCard } from "@/features/common";
import { AppliedJobsSection } from "@/features/dashboard/components/applied-jobs-section";
import { OngoingJobsSection } from "@/features/dashboard/components/ongoing-jobs-section";
import { PostedJobsSection } from "@/features/dashboard/components/posted-jobs-section";
import { RecentPayoutsList } from "@/features/dashboard/components/recent-payouts-list";
import { RegistryRegistrationCard } from "@/features/dashboard/components/registry-registration-card";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { useFreelancerDashboard } from "@/features/dashboard/hooks/use-freelancer-dashboard";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { DeadlineNotificationsPanel } from "@/features/deadlines";
import { useAppMode } from "@/features/mode";
import { useRequireOnboarding } from "@/features/onboarding";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { TAssetAmount, TDashboardMode } from "@/features/dashboard/types";

const WORK_TABS = [
  ["applied", "Applications"],
  ["progress", "In progress"],
  ["payments", "Payments received"],
] as const;

const DASHBOARD_COPY: Record<
  TDashboardMode,
  { title: string; description: string; action: { href: string; label: string } }
> = {
  client: {
    title: "My jobs",
    description: "Jobs you posted, who applied, and where each payment stands.",
    action: { href: "/post-job", label: "Post a job" },
  },
  freelancer: {
    title: "My work",
    description: "Your earnings, money on hold, and the jobs you are working on.",
    action: { href: "/marketplace", label: "Find work" },
  },
};

function formatAssetAmountList(rows: TAssetAmount[]): string {
  if (rows.length === 0) return "0";
  return rows.map((r) => `${formatAmount(r.amount)} ${formatAsset(r.asset)}`).join(" + ");
}

function SummarySkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-5"
      aria-hidden="true"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2 bg-card p-4">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/** Summarizes wallet-specific escrow activity for the connected freelancer using Convex data. */
export function DashboardPage() {
  const { summary, isLoading, isConnected, isTestnet, isFunded } = useFreelancerDashboard();
  const onboardingGuard = useRequireOnboarding();
  const { role, isLoading: isRoleLoading } = useDashboardRole();
  const { mode: selectedMode, isReady: isModeReady } = useAppMode();

  const showFreelancerSections = !isRoleLoading && isModeReady && selectedMode === "freelancer";
  const showClientSections = !isRoleLoading && isModeReady && selectedMode === "client";
  const copy = DASHBOARD_COPY[selectedMode];

  if (!isConnected) {
    return (
      <WalletRequiredNotice
        title="Your Dashboard"
        description="Connect your wallet to see your jobs and payments."
      />
    );
  }

  if (onboardingGuard.isCheckingOnboarding) {
    return <p className="font-sans text-sm text-muted-foreground">Checking onboarding…</p>;
  }

  if (!isRoleLoading && role === "admin") {
    return <AdminDashboardEntry />;
  }

  return (
    <div className="space-y-6">
      <ProductPageHero
        title={copy.title}
        description={copy.description}
        actions={
          <AppButton asChild className="hr-v2-button-primary h-9 rounded-md px-4">
            <Link href={copy.action.href}>{copy.action.label}</Link>
          </AppButton>
        }
      />

      {!isRoleLoading && role !== "admin" && onboardingGuard.isOnboardingComplete ? (
        <RegistryRegistrationCard />
      ) : null}

      {isTestnet && isFunded === false ? (
        <RouteCallout tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          Your practice account has no test money yet. You can look around, but you need free test
          XLM before you can make or receive payments.
        </RouteCallout>
      ) : null}

      <DeadlineNotificationsPanel />

      {showFreelancerSections && isLoading ? <SummarySkeleton /> : null}

      {showFreelancerSections && !isLoading && summary ? (
        <section
          aria-label="Earnings summary"
          className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-5"
        >
          <StatCard
            className="col-span-2 bg-card p-4 lg:col-span-1"
            label="Total earned"
            value={formatAssetAmountList(summary.totalEarnedByAsset)}
            description="Paid for finished jobs"
          />
          <StatCard
            className="col-span-2 bg-card p-4 lg:col-span-1"
            label="On hold for you"
            value={formatAssetAmountList(summary.pendingEscrowByAsset)}
            description="Set aside by clients"
          />
          <StatCard
            className="bg-card p-4"
            label="In progress"
            value={summary.activeJobs.toString()}
            description="Funded or handed in"
          />
          <StatCard
            className="bg-card p-4"
            label="Awaiting funding"
            value={summary.awaitingFunding.toString()}
            description="Picked, not yet funded"
          />
          <StatCard
            className="col-span-2 bg-card p-4 lg:col-span-1"
            label="Finished"
            value={summary.completedJobs.toString()}
            description="Jobs you were paid for"
          />
        </section>
      ) : null}

      {showFreelancerSections ? (
        <Tabs defaultValue="applied" className="gap-4">
          <TabsList variant="line" className="h-auto w-full justify-start gap-6 border-b pb-0">
            {WORK_TABS.map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-none rounded-none px-0 py-2.5 text-sm data-[state=active]:font-medium data-[state=active]:after:bg-(--mode-solid)"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="applied">
            <AppliedJobsSection />
          </TabsContent>
          <TabsContent value="progress">
            <OngoingJobsSection />
          </TabsContent>
          <TabsContent value="payments">
            <RecentPayoutsList payouts={summary?.recentPayouts ?? []} />
          </TabsContent>
        </Tabs>
      ) : null}

      {showClientSections ? <PostedJobsSection /> : null}
    </div>
  );
}
