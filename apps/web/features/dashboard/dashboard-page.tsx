"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { AdminDashboardPage } from "@/features/admin";
import { ProductPageHero, RouteCallout, RoutePanel, RoutePanelHeader } from "@/features/common";
import { AppliedJobsSection } from "@/features/dashboard/components/applied-jobs-section";
import { DashboardModeLabel } from "@/features/dashboard/components/dashboard-mode-label";
import { DashboardModeSwitch } from "@/features/dashboard/components/dashboard-mode-switch";
import { IncomeMetricCard } from "@/features/dashboard/components/income-metric-card";
import { OngoingJobsSection } from "@/features/dashboard/components/ongoing-jobs-section";
import { PostedJobsSection } from "@/features/dashboard/components/posted-jobs-section";
import { RecentPayoutsList } from "@/features/dashboard/components/recent-payouts-list";
import { useDashboardMode } from "@/features/dashboard/hooks/use-dashboard-mode";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { useFreelancerDashboard } from "@/features/dashboard/hooks/use-freelancer-dashboard";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { DeadlineNotificationsPanel } from "@/features/deadlines";
import { useRequireOnboarding } from "@/features/onboarding";
import { Button as AppButton } from "@repo/ui/components/ui/button";
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
} from "lucide-react";
import Link from "next/link";

import type { TAssetAmount, TDashboardMode } from "@/features/dashboard/types";

interface IQuickAction {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: typeof Briefcase;
  readonly iconContainerClassName?: string;
}

const QUICK_ACTIONS: readonly IQuickAction[] = [
  {
    href: "/marketplace",
    title: "Browse Jobs",
    description: "Find new opportunities",
    icon: Briefcase,
    iconContainerClassName: "hr-gradient-primary border-transparent text-white",
  },
  {
    href: "/post-job",
    title: "Post a Job",
    description: "Hire talented freelancers",
    icon: Users,
    iconContainerClassName: "bg-primary text-primary-foreground border-transparent",
  },
  {
    href: "/disputes",
    title: "Disputes",
    description: "Review active cases",
    icon: AlertTriangle,
    iconContainerClassName: "hr-v2-badge-accent text-current",
  },
] as const;

function formatAssetAmountList(rows: TAssetAmount[]): string {
  if (rows.length === 0) return "0";
  return rows.map((r) => `${formatAmount(r.amount)} ${formatAsset(r.asset)}`).join(" + ");
}

function resolveDashboardHeroCopy(mode: TDashboardMode) {
  if (mode === "client") {
    return {
      label: "Client Operations",
      title: (
        <>
          Client <span className="hr-v2-gradient-text">Jobs Dashboard</span>
        </>
      ),
      description:
        "Manage posted jobs, monitor application volume, and track escrow progress from a single control plane.",
    };
  }

  return {
    label: "Freelancer Performance",
    title: (
      <>
        Freelancer <span className="hr-v2-gradient-text">Income Dashboard</span>
      </>
    ),
    description:
      "Track Stellar escrow earnings, pending balances, and payout momentum across your active engagements.",
  };
}

function UnfundedWarningBanner() {
  return (
    <RouteCallout tone="warning" icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
      <span>
        Your testnet wallet is not funded. You can view your dashboard, but Stellar transactions
        require test XLM.
      </span>
    </RouteCallout>
  );
}

function DashboardSkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="hr-panel hr-surface-muted h-28 animate-pulse" />
      ))}
    </div>
  );
}

function QuickActions() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className=""
    >
      <RoutePanel>
        <RoutePanelHeader
          title="Quick Actions"
          description="Jump into the most common workflow surfaces."
        />
        <div className="grid grid-cols-1 gap-4 px-6 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                href={action.href}
                className="group hr-panel hover:hr-hard-shadow flex items-center gap-3 p-4 transition-shadow"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border",
                    action.iconContainerClassName,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="hr-text-primary font-medium group-hover:opacity-80">
                    {action.title}
                  </p>
                  <p className="hr-text-secondary text-sm">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex justify-end px-6 pb-6">
          <AppButton asChild variant="secondary">
            <Link href="/marketplace">Open Marketplace Flow</Link>
          </AppButton>
        </div>
      </RoutePanel>
    </motion.section>
  );
}

/** Summarizes wallet-specific escrow activity for the connected freelancer using Convex data. */
export function DashboardPage() {
  const { summary, isLoading, isConnected, isTestnet, isFunded, address } =
    useFreelancerDashboard();
  const onboardingGuard = useRequireOnboarding();
  const { role, isLoading: isRoleLoading } = useDashboardRole();
  const {
    selectedMode,
    isReady: isModeReady,
    setSelectedMode,
  } = useDashboardMode({
    role,
    address,
    isConnected,
  });

  const showFreelancerSections = !isRoleLoading && isModeReady && selectedMode === "freelancer";
  const showClientSections = !isRoleLoading && isModeReady && selectedMode === "client";
  const heroCopy = resolveDashboardHeroCopy(selectedMode);

  if (!isConnected) {
    return (
      <WalletRequiredNotice
        title="Freelancer Income Dashboard"
        description="Connect your Stellar wallet to view your income dashboard."
      />
    );
  }

  if (onboardingGuard.isCheckingOnboarding) {
    return <p className="hr-text-secondary text-sm">Checking onboarding...</p>;
  }

  if (!isRoleLoading && role === "admin") {
    return <AdminDashboardPage />;
  }

  return (
    <div className="space-y-8">
      <ProductPageHero
        label={heroCopy.label}
        title={heroCopy.title}
        description={heroCopy.description}
      />

      {!isRoleLoading && isModeReady && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {address ? (
            <AppButton asChild variant="secondary" size="sm">
              <Link href={`/freelancers/${encodeURIComponent(address)}`}>View public profile</Link>
            </AppButton>
          ) : null}
          <DashboardModeLabel mode={selectedMode} />
          <DashboardModeSwitch selectedMode={selectedMode} onModeChange={setSelectedMode} />
        </div>
      )}

      {isTestnet && isFunded === false && <UnfundedWarningBanner />}

      <DeadlineNotificationsPanel />

      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="hr-text-secondary mb-4 text-sm">Loading income dashboard…</p>
          <DashboardSkeletonCards />
        </motion.div>
      )}

      {showFreelancerSections && !isLoading && summary && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            <IncomeMetricCard
              title="Total Earned"
              value={formatAssetAmountList(summary.totalEarnedByAsset)}
              subtitle="Completed escrow payments via Stellar"
              icon={DollarSign}
              iconClassName="hr-gradient-primary border-transparent text-white"
              animationDelay={0.3}
            />

            <IncomeMetricCard
              title="Pending Escrow"
              value={formatAssetAmountList(summary.pendingEscrowByAsset)}
              subtitle="Funds already locked by clients"
              icon={Clock}
              iconClassName="bg-primary text-primary-foreground border-transparent"
              animationDelay={0.35}
            />

            <IncomeMetricCard
              title="Completed Jobs"
              value={summary.completedJobs.toString()}
              subtitle="Payments released through Stellar escrow"
              icon={CheckCircle}
              iconClassName="hr-v2-badge-accent text-current"
              animationDelay={0.4}
            />

            <IncomeMetricCard
              title="Active Jobs"
              value={summary.activeJobs.toString()}
              subtitle="Funded or submitted, awaiting release"
              icon={Briefcase}
              iconClassName="hr-surface-muted hr-text-primary"
              animationDelay={0.45}
            />

            <IncomeMetricCard
              title="Awaiting Funding"
              value={summary.awaitingFunding.toString()}
              subtitle="Escrows created but not yet funded by client"
              icon={Hourglass}
              iconClassName="border-border text-muted-foreground"
              animationDelay={0.5}
            />
          </motion.div>

          <RecentPayoutsList payouts={summary.recentPayouts} />
        </>
      )}

      {showFreelancerSections && <AppliedJobsSection />}

      {showFreelancerSections && <OngoingJobsSection />}

      {showClientSections && <PostedJobsSection />}

      <QuickActions />
    </div>
  );
}
