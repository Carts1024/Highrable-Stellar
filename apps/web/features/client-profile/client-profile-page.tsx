"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { ClientTrustProfileHeader } from "@/features/client-profile/components/client-trust-profile-header";
import { ClientTrustStatsCards } from "@/features/client-profile/components/client-trust-stats-cards";
import { ClientWorkBreakdown } from "@/features/client-profile/components/client-work-breakdown";
import { EditClientProfileForm } from "@/features/client-profile/components/edit-client-profile-form";
import { FreelancerSafetyExplanationCard } from "@/features/client-profile/components/freelancer-safety-explanation-card";
import { RecentClientJobsSection } from "@/features/client-profile/components/recent-client-jobs-section";
import { RecentCompletedPaymentsSection } from "@/features/client-profile/components/recent-completed-payments-section";
import { RecentFundedEscrowsSection } from "@/features/client-profile/components/recent-funded-escrows-section";
import { ReportedJobsSummaryCard } from "@/features/client-profile/components/reported-jobs-summary-card";
import { getClientTrustIndicator } from "@/features/client-profile/lib/client-trust";
import { ProductPageHero } from "@/features/common";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import type { TClientTrustProfileResponse } from "@/features/client-profile/types";

export function ClientProfilePage({ walletAddress }: { readonly walletAddress: string }) {
  const decodedWalletAddress = useMemo(() => {
    try {
      return decodeURIComponent(walletAddress).trim();
    } catch {
      return walletAddress.trim();
    }
  }, [walletAddress]);
  const [isEditing, setIsEditing] = useState(false);
  const walletIdentity = useHighrableWalletIdentity();
  const hasWalletAddress = decodedWalletAddress.length > 0;
  const profileData = useQuery(
    api.profiles.getClientTrustProfile,
    hasWalletAddress ? { walletAddress: decodedWalletAddress } : "skip",
  ) as TClientTrustProfileResponse | null | undefined;

  if (!hasWalletAddress) {
    return <p className="text-sm text-gray-700">Client profile not found.</p>;
  }

  if (profileData === undefined) {
    return <p className="text-sm text-gray-500">Loading client trust profile...</p>;
  }

  if (profileData === null) {
    return <p className="text-sm text-gray-700">Client profile not found.</p>;
  }

  const {
    profile,
    stats,
    recentJobs,
    recentFundedEscrows,
    recentCompletedPayments,
    reportedJobsSummary,
  } = profileData;
  const canEdit = isSameWallet(walletIdentity.walletAddress, profile.walletAddress);
  const indicator = getClientTrustIndicator(stats);

  return (
    <div className="space-y-8">
      <ProductPageHero
        label="Client Trust Profile"
        title={
          <>
            Escrow behavior <span className="text-[#FF7003]">before commitment</span>
          </>
        }
        description="Client trust on Highrable is based on escrow behavior, not vague ratings."
      />

      <ClientTrustProfileHeader
        profile={profile}
        indicator={indicator}
        canEdit={canEdit}
        onEdit={() => setIsEditing(true)}
      />

      {isEditing && canEdit ? (
        <EditClientProfileForm
          profile={profile}
          onSaved={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      ) : null}

      <ClientTrustStatsCards stats={stats} />
      <ClientWorkBreakdown stats={stats} />
      <RecentFundedEscrowsSection escrows={recentFundedEscrows} />
      <RecentCompletedPaymentsSection payments={recentCompletedPayments} />
      <RecentClientJobsSection jobs={recentJobs} />
      {reportedJobsSummary ? <ReportedJobsSummaryCard summary={reportedJobsSummary} /> : null}
      <FreelancerSafetyExplanationCard />
    </div>
  );
}
