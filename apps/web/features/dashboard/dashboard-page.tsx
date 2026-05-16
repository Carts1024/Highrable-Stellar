"use client";

import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { ProductPageHero } from "@/features/common";
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
import { Button as AppButton } from "@repo/ui/components/ui/button";
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
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>
        Your testnet wallet is not funded. You can view your dashboard, but Stellar transactions
        require test XLM.
      </span>
    </div>
  );
}

function DashboardSkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-gray-100 bg-gray-100"
        />
      ))}
    </div>
  );
}

function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm"
    >
      <h2 className="mb-4 text-xl font-semibold text-[#0a0a0a]">Quick Actions</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/marketplace"
          className="group flex items-center space-x-3 rounded-lg border border-[#e8e8e8] p-4 transition-all duration-200 hover:border-[#FF7003] hover:bg-[#FF7003]/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-[#FF7003] to-[#FF8801]">
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <p className="font-medium text-[#0a0a0a] group-hover:text-[#FF7003]">Browse Jobs</p>
            <p className="text-sm text-[#5f5f5f]">Find new opportunities</p>
          </div>
        </Link>

        <Link
          href="/post-job"
          className="group flex items-center space-x-3 rounded-lg border border-[#e8e8e8] p-4 transition-all duration-200 hover:border-[#FF7003] hover:bg-[#FF7003]/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-blue-600">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <p className="font-medium text-[#0a0a0a] group-hover:text-[#FF7003]">Post a Job</p>
            <p className="text-sm text-[#5f5f5f]">Hire talented freelancers</p>
          </div>
        </Link>
      </div>

      <div className="mt-4 flex justify-end">
        <AppButton asChild variant="secondary">
          <Link href="/marketplace">Open Marketplace Flow</Link>
        </AppButton>
      </div>
    </motion.div>
  );
}

/** Summarizes wallet-specific escrow activity for the connected freelancer using Convex data. */
export function DashboardPage() {
  const { summary, isLoading, isConnected, isTestnet, isFunded, address } =
    useFreelancerDashboard();
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

      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="mb-4 text-sm text-gray-500">Loading income dashboard…</p>
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
              colorClass="from-emerald-500 to-emerald-600"
              bgColorClass="from-emerald-500/10 to-emerald-600/10"
              animationDelay={0.3}
            />

            <IncomeMetricCard
              title="Pending Escrow"
              value={formatAssetAmountList(summary.pendingEscrowByAsset)}
              subtitle="Funds already locked by clients"
              icon={Clock}
              colorClass="from-blue-500 to-blue-600"
              bgColorClass="from-blue-500/10 to-blue-600/10"
              animationDelay={0.35}
            />

            <IncomeMetricCard
              title="Completed Jobs"
              value={summary.completedJobs.toString()}
              subtitle="Payments released through Stellar escrow"
              icon={CheckCircle}
              colorClass="from-[#FF7003] to-[#FF8801]"
              bgColorClass="from-[#FF7003]/10 to-[#FF8801]/10"
              animationDelay={0.4}
            />

            <IncomeMetricCard
              title="Active Jobs"
              value={summary.activeJobs.toString()}
              subtitle="Funded or submitted, awaiting release"
              icon={Briefcase}
              colorClass="from-violet-500 to-violet-600"
              bgColorClass="from-violet-500/10 to-violet-600/10"
              animationDelay={0.45}
            />

            <IncomeMetricCard
              title="Awaiting Funding"
              value={summary.awaitingFunding.toString()}
              subtitle="Escrows created but not yet funded by client"
              icon={Hourglass}
              colorClass="from-gray-400 to-gray-500"
              bgColorClass="from-gray-400/10 to-gray-500/10"
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
