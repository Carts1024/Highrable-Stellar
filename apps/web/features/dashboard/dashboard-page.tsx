"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { AdminDashboardEntry } from "@/features/admin";
import { ProductPageHero, RouteCallout, SectionHeading } from "@/features/common";
import { AppliedJobsSection } from "@/features/dashboard/components/applied-jobs-section";
import { IncomeMetricCard } from "@/features/dashboard/components/income-metric-card";
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
import { HighrableV2Bullet } from "@repo/ui/components/highrable/v2-marketing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle,
  Clock,
  DollarSign,
  Hourglass,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

import type { TAssetAmount, TDashboardMode } from "@/features/dashboard/types";

interface IQuickAction {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: typeof Briefcase;
}

const QUICK_ACTIONS: Record<TDashboardMode, readonly IQuickAction[]> = {
  freelancer: [
    {
      href: "/marketplace",
      title: "Find Work",
      description: "Browse open jobs and send an application",
      icon: Briefcase,
    },
    {
      href: "/disputes",
      title: "Disputes",
      description: "See problems you have raised or received",
      icon: AlertTriangle,
    },
  ],
  client: [
    {
      href: "/post-job",
      title: "Post a Job",
      description: "Describe the work and set your budget",
      icon: Users,
    },
    {
      href: "/talent",
      title: "Find Freelancers",
      description: "Look for people to hire",
      icon: Briefcase,
    },
    {
      href: "/disputes",
      title: "Disputes",
      description: "See problems you have raised or received",
      icon: AlertTriangle,
    },
  ],
};

const WORK_TABS = [
  ["applied", "Applied Jobs"],
  ["progress", "Jobs in Progress"],
  ["payments", "Payments Received"],
] as const;

function formatAssetAmountList(rows: TAssetAmount[]): string {
  if (rows.length === 0) return "0";
  return rows.map((r) => `${formatAmount(r.amount)} ${formatAsset(r.asset)}`).join(" + ");
}

function resolveDashboardHeroCopy(mode: TDashboardMode) {
  if (mode === "client") {
    return {
      label: "Client · My Jobs",
      title: (
        <>
          Your <span className="hr-mode-text">Hiring Dashboard</span>
        </>
      ),
      description:
        "See the jobs you posted, who applied, and where each payment stands. Everything you need to hire is on this page.",
    };
  }

  return {
    label: "Freelancer · My Work",
    title: (
      <>
        Your <span className="hr-mode-text">Work and Earnings</span>
      </>
    ),
    description:
      "See how much you have earned, what is waiting to be paid, and which jobs you are working on right now.",
  };
}

function UnfundedWarningBanner() {
  return (
    <RouteCallout
      tone="warning"
      icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
      className="rounded-lg"
    >
      <span>
        Your practice account has no test money yet. You can look around, but you need free test XLM
        before you can make or receive payments.
      </span>
    </RouteCallout>
  );
}

function DashboardSkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl border border-border/60 bg-muted/30"
        />
      ))}
    </div>
  );
}

function QuickActions({ mode }: { readonly mode: TDashboardMode }) {
  const actions = QUICK_ACTIONS[mode];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="space-y-5"
    >
      <SectionHeading
        icon={Zap}
        title="What would you like to do?"
        description="Shortcuts for the most common things."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-none transition-all duration-200 hover:border-highrable-orange-3/30 hover:shadow-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-highrable-orange-2/10 text-highrable-orange-2">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="hr-text-primary text-sm font-semibold transition-colors group-hover:text-highrable-orange-3">
                    {action.title}
                  </p>
                  <p className="hr-text-secondary text-sm">{action.description}</p>
                </div>
              </div>
              <span className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
                Go
              </span>
            </Link>
          );
        })}
      </div>
    </motion.section>
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
  const heroCopy = resolveDashboardHeroCopy(selectedMode);

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
    <div className="space-y-8">
      {/* Hero */}
      <section className="border-b border-[var(--mode-border)] pb-8">
        <ProductPageHero
          label={heroCopy.label}
          title={heroCopy.title}
          description={heroCopy.description}
        />
      </section>

      {!isRoleLoading && role !== "admin" && onboardingGuard.isOnboardingComplete ? (
        <RegistryRegistrationCard />
      ) : null}

      {isTestnet && isFunded === false && <UnfundedWarningBanner />}

      <DeadlineNotificationsPanel />

      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="hr-text-secondary mb-4 text-sm">Loading your dashboard…</p>
          <DashboardSkeletonCards />
        </motion.div>
      )}

      {showFreelancerSections && !isLoading && summary && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <IncomeMetricCard
              title="Total Earned"
              tone="green"
              value={formatAssetAmountList(summary.totalEarnedByAsset)}
              subtitle="Money you have been paid for finished jobs"
              icon={DollarSign}
              animationDelay={0.3}
            />

            <IncomeMetricCard
              title="Payments on Hold"
              tone="yellow"
              value={formatAssetAmountList(summary.pendingEscrowByAsset)}
              subtitle="Clients have set this money aside for your work"
              icon={Clock}
              animationDelay={0.35}
            />

            <IncomeMetricCard
              title="Finished Jobs"
              tone="sky"
              value={summary.completedJobs.toString()}
              subtitle="Jobs where you have been paid"
              icon={CheckCircle}
              animationDelay={0.4}
            />

            <IncomeMetricCard
              title="Jobs in Progress"
              tone="orange"
              value={summary.activeJobs.toString()}
              subtitle="Paid for upfront or handed in, waiting for approval"
              icon={Briefcase}
              animationDelay={0.45}
            />

            <IncomeMetricCard
              title="Waiting for Payment"
              tone="violet"
              value={summary.awaitingFunding.toString()}
              subtitle="Client has picked you but has not set the money aside yet"
              icon={Hourglass}
              animationDelay={0.5}
            />
          </motion.div>
        </>
      )}

      {showFreelancerSections ? (
        <Tabs defaultValue="applied" className="gap-5">
          <TabsList
            variant="line"
            className="h-auto w-full flex-wrap justify-start border-b border-[var(--mode-border)] pb-0"
          >
            {WORK_TABS.map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "rounded-none px-0 py-3 pr-6 font-mono text-xs tracking-[0.06em] uppercase",
                  "data-[state=active]:text-[#0a0a0a] data-[state=active]:after:bg-highrable-orange-2",
                )}
              >
                <HighrableV2Bullet aria-hidden="true" />
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

      {showClientSections && <PostedJobsSection />}

      <QuickActions mode={selectedMode} />
    </div>
  );
}
