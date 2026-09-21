"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { AdminDashboardPage } from "@/features/admin";
import { ProductPageHero, RouteCallout } from "@/features/common";
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
  LayoutDashboard,
  Users,
} from "lucide-react";
import Link from "next/link";

import type { TAssetAmount, TDashboardMode } from "@/features/dashboard/types";

interface IQuickAction {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: typeof Briefcase;
}

const QUICK_ACTIONS: readonly IQuickAction[] = [
  {
    href: "/marketplace",
    title: "Browse Jobs",
    description: "Find new opportunities",
    icon: Briefcase,
  },
  {
    href: "/post-job",
    title: "Post a Job",
    description: "Hire talented freelancers",
    icon: Users,
  },
  {
    href: "/disputes",
    title: "Disputes",
    description: "Review active cases",
    icon: AlertTriangle,
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
          Client <span className="text-[#FF7003]">Jobs Dashboard</span>
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
        Freelancer <span className="text-[#FF7003]">Income Dashboard</span>
      </>
    ),
    description:
      "Track Stellar escrow earnings, pending balances, and payout momentum across your active engagements.",
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
        Your testnet wallet is not funded. You can view your dashboard, but Stellar transactions
        require test XLM.
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

function DashboardCommandBar({
  mode,
  address,
  onModeChange,
}: {
  readonly mode: TDashboardMode;
  readonly address?: string | null;
  readonly onModeChange: (mode: TDashboardMode) => void;
}) {
  const publicProfileHref = address
    ? `/${mode === "client" ? "clients" : "freelancers"}/${encodeURIComponent(address)}`
    : null;

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-highrable-orange-2/10 text-highrable-orange-2">
            <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground/80 uppercase">
              Dashboard Mode
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <DashboardModeLabel mode={mode} />
              <p className="hr-text-secondary text-sm">
                Switch between freelancer and client work.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {publicProfileHref ? (
            <AppButton
              asChild
              variant="outline"
              className="h-9 rounded-lg px-4 text-xs font-semibold"
            >
              <Link href={publicProfileHref}>View public profile</Link>
            </AppButton>
          ) : null}
          <DashboardModeSwitch selectedMode={mode} onModeChange={onModeChange} />
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
            Quick Actions
          </p>
          <h2 className="hr-text-primary font-sans text-lg font-semibold">Common workflows</h2>
        </div>
        <AppButton asChild variant="outline" className="h-9 rounded-lg px-4 text-xs font-semibold">
          <Link href="/marketplace">Open Marketplace Flow</Link>
        </AppButton>
      </div>

      <div className="flex flex-col gap-4">
        {QUICK_ACTIONS.map((action) => {
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
                Open
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
    return <p className="font-sans text-sm text-muted-foreground">Checking onboarding…</p>;
  }

  if (!isRoleLoading && role === "admin") {
    return <AdminDashboardPage />;
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-8 lg:pb-10">
        <ProductPageHero
          label={heroCopy.label}
          title={heroCopy.title}
          description={heroCopy.description}
        />

        {/* Metric panel */}
        <div className="flex flex-col gap-0 divide-y divide-border/60 rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl">
          {[
            { label: "Mode", value: selectedMode === "client" ? "Client" : "Talent" },
            { label: "Network", value: isTestnet ? "Testnet" : "Mainnet" },
            {
              label: "Wallet",
              value: isFunded === false ? "Needs XLM" : "Ready",
              accent: isFunded === false,
            },
          ].map(({ label, value, accent }) => (
            <div key={label} className="flex flex-col gap-0.5 px-4 py-3 sm:px-5 sm:py-4">
              <span className="mb-2 font-mono text-xs tracking-[0.08em] text-muted-foreground/80 uppercase">
                {label}
              </span>
              <span
                className={cn(
                  "text-lg leading-none font-semibold sm:text-xl",
                  accent ? "text-highrable-orange-2" : "hr-text-primary",
                )}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {!isRoleLoading && isModeReady && (
        <DashboardCommandBar mode={selectedMode} address={address} onModeChange={setSelectedMode} />
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
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <IncomeMetricCard
              title="Total Earned"
              value={formatAssetAmountList(summary.totalEarnedByAsset)}
              subtitle="Completed escrow payments via Stellar"
              icon={DollarSign}
              animationDelay={0.3}
            />

            <IncomeMetricCard
              title="Pending Escrow"
              value={formatAssetAmountList(summary.pendingEscrowByAsset)}
              subtitle="Funds already locked by clients"
              icon={Clock}
              animationDelay={0.35}
            />

            <IncomeMetricCard
              title="Completed Jobs"
              value={summary.completedJobs.toString()}
              subtitle="Payments released through Stellar escrow"
              icon={CheckCircle}
              animationDelay={0.4}
            />

            <IncomeMetricCard
              title="Active Jobs"
              value={summary.activeJobs.toString()}
              subtitle="Funded or submitted, awaiting release"
              icon={Briefcase}
              animationDelay={0.45}
            />

            <IncomeMetricCard
              title="Awaiting Funding"
              value={summary.awaitingFunding.toString()}
              subtitle="Escrows created but not yet funded by client"
              icon={Hourglass}
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
