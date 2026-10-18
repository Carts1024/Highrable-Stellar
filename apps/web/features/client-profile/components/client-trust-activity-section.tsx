"use client";

import { ClientTrustStatsCards } from "@/features/client-profile/components/client-trust-stats-cards";
import { ClientWorkBreakdown } from "@/features/client-profile/components/client-work-breakdown";
import { RecentClientJobsSection } from "@/features/client-profile/components/recent-client-jobs-section";
import { RecentCompletedPaymentsSection } from "@/features/client-profile/components/recent-completed-payments-section";
import { RecentFundedEscrowsSection } from "@/features/client-profile/components/recent-funded-escrows-section";
import { ReportedJobsSummaryCard } from "@/features/client-profile/components/reported-jobs-summary-card";
import { HighrableV2IconNotice } from "@repo/ui/components/highrable/v2-marketing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";

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

type TClientTrustTabValue = "jobs" | "funded" | "payments";

export function ClientTrustActivitySection(props: IClientTrustActivitySectionProps) {
  const { stats, recentJobs, recentFundedEscrows, recentCompletedPayments, reportedJobsSummary } =
    props;
  const activityTabs: readonly (readonly [TClientTrustTabValue, string, number])[] = [
    ["jobs", "Posted jobs", recentJobs.length],
    ["funded", "Funded", recentFundedEscrows.length],
    ["payments", "Payments released", recentCompletedPayments.length],
  ];

  return (
    <div className="space-y-8">
      <section aria-labelledby="client-history-title" className="space-y-3">
        <div className="flex items-center gap-1.5">
          <h2 id="client-history-title" className="hr-text-primary text-base font-semibold">
            Payment history
          </h2>
          <HighrableV2IconNotice
            label="Where these numbers come from"
            tone="neutral"
            message="Counted from this client's Highrable payment holds on Stellar. Each new job still needs its own payment hold before work starts."
          />
        </div>
        {reportedJobsSummary ? <ReportedJobsSummaryCard summary={reportedJobsSummary} /> : null}
        <ClientTrustStatsCards stats={stats} />
        <ClientWorkBreakdown stats={stats} />
      </section>

      <section aria-labelledby="client-activity-title" className="space-y-3">
        <h2 id="client-activity-title" className="hr-text-primary text-base font-semibold">
          Recent activity
        </h2>
        <Tabs defaultValue="jobs" className="gap-4">
          <TabsList variant="line" className="h-auto w-full justify-start gap-6 border-b pb-0">
            {activityTabs.map(([value, label, count]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-none rounded-none px-0 py-2.5 text-sm data-[state=active]:font-medium data-[state=active]:after:bg-(--mode-solid)"
              >
                {label}
                <span className="hr-text-muted ml-1.5 font-normal">{count}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="jobs">
            <RecentClientJobsSection jobs={recentJobs} />
          </TabsContent>
          <TabsContent value="funded">
            <RecentFundedEscrowsSection escrows={recentFundedEscrows} />
          </TabsContent>
          <TabsContent value="payments">
            <RecentCompletedPaymentsSection payments={recentCompletedPayments} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
