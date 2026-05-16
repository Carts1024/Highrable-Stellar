"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { ProductPageHero } from "@/features/common";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { EditFreelancerProfileForm } from "@/features/profile/components/edit-freelancer-profile-form";
import { FreelancerProfileHeader } from "@/features/profile/components/freelancer-profile-header";
import { FreelancerReviewsSection } from "@/features/profile/components/freelancer-reviews-section";
import { FreelancerStatsCards } from "@/features/profile/components/freelancer-stats-cards";
import { RecentContractsSection } from "@/features/profile/components/recent-contracts-section";
import { ReputationExplanationCard } from "@/features/profile/components/reputation-explanation-card";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import type { TFreelancerProfileResponse } from "@/features/profile/types";

export function FreelancerProfilePage({ walletAddress }: { readonly walletAddress: string }) {
  const decodedWalletAddress = useMemo(() => {
    try {
      return decodeURIComponent(walletAddress).trim();
    } catch {
      return walletAddress.trim();
    }
  }, [walletAddress]);
  const [isEditing, setIsEditing] = useState(false);
  const { address } = useWallet();
  const hasWalletAddress = decodedWalletAddress.length > 0;
  const profileData = useQuery(
    api.profiles.getFreelancerProfile,
    hasWalletAddress ? { walletAddress: decodedWalletAddress } : "skip",
  ) as TFreelancerProfileResponse | null | undefined;

  if (!hasWalletAddress) {
    return <p className="text-sm text-gray-700">Freelancer profile not found.</p>;
  }

  if (profileData === undefined) {
    return <p className="text-sm text-gray-500">Loading freelancer profile...</p>;
  }

  if (profileData === null) {
    return <p className="text-sm text-gray-700">Freelancer profile not found.</p>;
  }

  const { profile, stats, verifiedReviews, recentContracts } = profileData;
  const canEdit = isSameWallet(address, profile.walletAddress);

  return (
    <div className="space-y-8">
      <ProductPageHero
        label="Freelancer Profile"
        title={
          <>
            Wallet-based <span className="text-[#FF7003]">work history</span>
          </>
        }
        description="Completed work and reviews on Highrable are verified through real paid Stellar escrow transactions."
      />

      <FreelancerProfileHeader
        profile={profile}
        stats={stats}
        canEdit={canEdit}
        onEdit={() => setIsEditing(true)}
      />

      {isEditing && canEdit ? (
        <EditFreelancerProfileForm
          profile={profile}
          onSaved={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      ) : null}

      {stats.completedContracts === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e8e8e8] bg-white p-5 text-sm text-[#5f5f5f]">
          This freelancer does not have escrow-verified paid work yet.
        </p>
      ) : null}

      <FreelancerStatsCards stats={stats} />
      <FreelancerReviewsSection reviews={verifiedReviews} />
      <RecentContractsSection contracts={recentContracts} />
      <ReputationExplanationCard />
    </div>
  );
}
