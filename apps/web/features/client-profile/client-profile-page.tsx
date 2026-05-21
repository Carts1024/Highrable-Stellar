"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { ClientTrustActivitySection } from "@/features/client-profile/components/client-trust-activity-section";
import { ClientTrustProfileHeader } from "@/features/client-profile/components/client-trust-profile-header";
import { EditClientProfileForm } from "@/features/client-profile/components/edit-client-profile-form";
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

      <ClientTrustActivitySection
        stats={stats}
        recentJobs={recentJobs}
        recentFundedEscrows={recentFundedEscrows}
        recentCompletedPayments={recentCompletedPayments}
        {...(reportedJobsSummary ? { reportedJobsSummary } : {})}
      />
    </div>
  );
}
