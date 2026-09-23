"use client";

import { parseWalletAddressParam } from "@/core/seo";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { ProductPageHero } from "@/features/common";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { EditFreelancerProfileForm } from "@/features/profile/components/edit-freelancer-profile-form";
import { FreelancerProfileHeader } from "@/features/profile/components/freelancer-profile-header";
import { FreelancerReputationSection } from "@/features/profile/components/freelancer-reputation-section";
import { api } from "@repo/convex-client";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@repo/ui/responsive-dialog";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import type { TFreelancerProfileResponse } from "@/features/profile/types";

export function FreelancerProfilePage({ walletAddress }: { readonly walletAddress: string }) {
  const decodedWalletAddress = useMemo(() => {
    return parseWalletAddressParam(walletAddress);
  }, [walletAddress]);
  const [isEditing, setIsEditing] = useState(false);
  const walletIdentity = useHighrableWalletIdentity();
  const profileData = useQuery(
    api.profiles.getFreelancerProfile,
    decodedWalletAddress ? { walletAddress: decodedWalletAddress } : "skip",
  ) as TFreelancerProfileResponse | null | undefined;

  if (!decodedWalletAddress) {
    return <p className="text-sm text-muted-foreground">Freelancer profile not found.</p>;
  }

  if (profileData === undefined) {
    return <p className="text-sm text-muted-foreground">Loading freelancer profile...</p>;
  }

  if (profileData === null) {
    return <p className="text-sm text-muted-foreground">Freelancer profile not found.</p>;
  }

  const { profile, stats, verifiedReviews, recentContracts } = profileData;
  const canEdit = isSameWallet(walletIdentity.walletAddress, profile.walletAddress);

  return (
    <div className="space-y-8">
      <ProductPageHero
        label="Freelancer Profile"
        title={
          <>
            Wallet-based <span className="hr-v2-gradient-text">Work History</span>
          </>
        }
        description="Completed work and reviews are verified through real paid Stellar escrow transactions — harder to fake than standard marketplace ratings."
      />

      <FreelancerProfileHeader
        profile={profile}
        stats={stats}
        canEdit={canEdit}
        onEdit={() => setIsEditing(true)}
      />

      <ResponsiveDialog open={isEditing && canEdit} onOpenChange={setIsEditing}>
        <ResponsiveDialogContent className="max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="hr-text-primary text-lg sm:text-xl">
              Edit profile
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="hr-text-secondary text-sm">
              Keep these fields aligned with your public onboarding identity.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            {canEdit ? (
              <EditFreelancerProfileForm
                profile={profile}
                onSaved={() => setIsEditing(false)}
                onCancel={() => setIsEditing(false)}
              />
            ) : null}
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {stats.completedContracts === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 p-5 font-sans text-sm text-muted-foreground sm:rounded-2xl">
          This freelancer does not have escrow-verified paid work yet.
        </p>
      ) : null}

      <FreelancerReputationSection
        stats={stats}
        reviews={verifiedReviews}
        contracts={recentContracts}
      />
    </div>
  );
}
