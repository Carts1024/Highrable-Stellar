"use client";

import { ClientReliabilityBadge } from "@/features/client-profile/components/client-reliability-badge";
import { ProfileAvatar, WalletAddressTile } from "@/features/common";
import { HighrableV2IconNotice } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { ExternalLink, MapPin, Pencil } from "lucide-react";
import Link from "next/link";

import type { TClientTrustIndicator } from "@/features/client-profile/lib/client-trust";
import type { TClientProfile } from "@/features/client-profile/types";

function getClientNoticeTone(
  indicatorTone: TClientTrustIndicator["tone"],
): "danger" | "success" | "warning" {
  if (indicatorTone === "danger") {
    return "danger";
  }

  if (indicatorTone === "warning") {
    return "warning";
  }

  return "success";
}

export function ClientTrustProfileHeader({
  profile,
  indicator,
  canEdit,
  onEdit,
}: {
  readonly profile: TClientProfile;
  readonly indicator: TClientTrustIndicator;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
}) {
  const displayName = profile.companyName || profile.name || "Unnamed Client";
  const walletTypeLabel =
    profile.walletType === "passkey_smart_account" ? "Passkey Smart Account" : "External Wallet";

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="hr-mode-band relative h-28 sm:h-32">
        {canEdit ? (
          <AppButton
            type="button"
            variant="outline"
            onClick={onEdit}
            className="absolute top-3 right-3 h-8 rounded-lg border-white bg-white px-3 text-xs font-semibold"
          >
            <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Edit Client Profile
          </AppButton>
        ) : null}
      </div>

      <div className="px-5 pb-5 sm:px-6">
        <div className="-mt-10 flex flex-wrap items-end gap-4">
          <ProfileAvatar
            className="h-20 w-20 rounded-2xl"
            avatarUrl={profile.avatarUrl}
            displayName={displayName}
            fallbackLabel="UC"
          />
          <div className="min-w-0 pb-1">
            <span className="hr-mode-soft hr-mode-text inline-flex rounded-full border border-[var(--mode-border)] px-2.5 py-0.5 text-[11px] font-semibold">
              Client
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="hr-text-primary font-sans text-2xl font-bold sm:text-3xl">
                {displayName}
              </h1>
              <ClientReliabilityBadge indicator={indicator} />
              <HighrableV2IconNotice
                label="How client trust signals work"
                tone={getClientNoticeTone(indicator.tone)}
                message={
                  <span>
                    Client trust signals are based on Highrable escrow activity.{" "}
                    {indicator.description}
                  </span>
                }
              />
              <HighrableV2IconNotice
                label="Before working with this client"
                tone="warning"
                message="Freelancers should start work only when a specific gig or milestone is marked Payment Secured. A client profile may show funded history, but each new job still needs its own payment hold."
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="min-w-0 space-y-3">
            {profile.companyName && profile.name ? (
              <p className="text-sm text-[#5f5f5f]">Contact name: {profile.name}</p>
            ) : null}
            <p className="max-w-3xl text-sm leading-relaxed text-[#5f5f5f]">
              {profile.bio || "This client has not added a profile bio yet."}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {profile.location ? (
                <span className="inline-flex items-center gap-1 text-[#5f5f5f]">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {profile.location}
                </span>
              ) : null}
              {profile.websiteUrl ? (
                <Link
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hr-mode-text inline-flex items-center gap-1 font-medium hover:text-highrable-orange-4"
                >
                  Website <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
          <WalletAddressTile address={profile.walletAddress} note={walletTypeLabel} />
        </div>
      </div>
    </section>
  );
}
