"use client";

import { ClientTrustStatsCards } from "@/features/client-profile/components/client-trust-stats-cards";
import { ClientWorkBreakdown } from "@/features/client-profile/components/client-work-breakdown";
import { RecentClientJobsSection } from "@/features/client-profile/components/recent-client-jobs-section";
import { RecentCompletedPaymentsSection } from "@/features/client-profile/components/recent-completed-payments-section";
import { RecentFundedEscrowsSection } from "@/features/client-profile/components/recent-funded-escrows-section";
import { ReportedJobsSummaryCard } from "@/features/client-profile/components/reported-jobs-summary-card";
import {
  HighrableV2Bullet,
  HighrableV2IconNotice,
  SectionLabel,
} from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";

import type {
  TClientEscrowActivity,
  TClientRecentJob,
  TClientTrustStats,
  TReportedJobsSummary,
} from "@/features/client-profile/types";

interface IClientTrustActivitySectionProps {
  readonly stats: TClientTrustStats;
  readonly recentJobs: readonly TClientRecentJob[];
  readonly recentFundedEscrows: readonly TClientEscrowActivity[];
  readonly recentCompletedPayments: readonly TClientEscrowActivity[];
  readonly reportedJobsSummary?: TReportedJobsSummary;
}

type TClientTrustTabValue = "stats" | "work" | "funded" | "payments" | "jobs" | "reports";
type TClientTrustTab = readonly [value: TClientTrustTabValue, label: string, count: string];

function getClientTrustTabs({
  stats,
  recentJobs,
  recentFundedEscrows,
  recentCompletedPayments,
  reportedJobsSummary,
}: IClientTrustActivitySectionProps): readonly TClientTrustTab[] {
  const tabs: TClientTrustTab[] = [
    ["stats", "Stats", stats.escrowsCreated.toString()],
    ["work", "Work mix", stats.jobsPosted.toString()],
    ["funded", "Funded", recentFundedEscrows.length.toString()],
    ["payments", "Payments", recentCompletedPayments.length.toString()],
    ["jobs", "Posted jobs", recentJobs.length.toString()],
  ];

  if (reportedJobsSummary) {
    tabs.push(["reports", "Reports", reportedJobsSummary.reportedJobsCount.toString()]);
  }

  return tabs;
}

export function ClientTrustActivitySection(props: IClientTrustActivitySectionProps) {
  const { stats, recentJobs, recentFundedEscrows, recentCompletedPayments, reportedJobsSummary } =
    props;
  const clientTrustTabs = getClientTrustTabs(props);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8e8e8] pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SectionLabel>Client Trust Activity</SectionLabel>
            <HighrableV2IconNotice
              label="How client trust activity is grouped"
              tone="neutral"
              message="Escrow stats, work mix, funded history, completed payments, and posted jobs are grouped into tabs so freelancers can inspect the client without scanning a long page."
            />
          </div>
          <h2 className="text-2xl font-semibold text-[#0a0a0a]">Escrow-backed client signal</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-[#5f5f5f]">
            Review this client&apos;s funding behavior, completed payments, and posted work in one
            compact workspace.
          </p>
        </div>
        {stats.disputedEscrows > 0 ? (
          <Badge
            variant="outline"
            className="rounded-none border-amber-200 bg-amber-50 text-amber-800"
          >
            {stats.disputedEscrows} disputed
          </Badge>
        ) : null}
      </div>

      <Tabs defaultValue="stats" className="gap-5">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start overflow-x-auto border-b border-[#e8e8e8] pb-0"
        >
          {clientTrustTabs.map(([value, label, count]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "rounded-none px-0 py-3 pr-6 font-mono text-xs tracking-[0.06em] uppercase",
                "data-[state=active]:text-[#0a0a0a] data-[state=active]:after:bg-[#FF7003]",
              )}
            >
              <HighrableV2Bullet aria-hidden="true" />
              {label}
              <span className="text-[#7f7f7f]">{count}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="stats">
          <ClientTrustStatsCards stats={stats} />
        </TabsContent>
        <TabsContent value="work">
          <ClientWorkBreakdown stats={stats} />
        </TabsContent>
        <TabsContent value="funded">
          <RecentFundedEscrowsSection escrows={recentFundedEscrows} />
        </TabsContent>
        <TabsContent value="payments">
          <RecentCompletedPaymentsSection payments={recentCompletedPayments} />
        </TabsContent>
        <TabsContent value="jobs">
          <RecentClientJobsSection jobs={recentJobs} />
        </TabsContent>
        {reportedJobsSummary ? (
          <TabsContent value="reports">
            <ReportedJobsSummaryCard summary={reportedJobsSummary} />
          </TabsContent>
        ) : null}
      </Tabs>
    </section>
  );
}
