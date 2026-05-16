"use client";

import { ClientReliabilityBadge } from "@/features/client-profile/components/client-reliability-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Check, Copy, ExternalLink, MapPin, Pencil, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { TClientTrustIndicator } from "@/features/client-profile/lib/client-trust";
import type { TClientProfile } from "@/features/client-profile/types";

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
  const [copied, setCopied] = useState(false);
  const displayName = profile.companyName || profile.name || "Unnamed Client";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const walletTypeLabel =
    profile.walletType === "passkey_smart_account" ? "Passkey Smart Account" : "External Wallet";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profile.walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#0a0a0a] text-xl font-semibold text-white">
            {initials || "UC"}
          </div>
          <div className="min-w-0 space-y-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-[#0a0a0a]">{displayName}</h1>
                <ClientReliabilityBadge indicator={indicator} />
              </div>
              {profile.companyName && profile.name ? (
                <p className="text-sm text-[#5f5f5f]">Contact name: {profile.name}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#5f5f5f]">
                <span className="font-mono break-all">
                  {shortenWalletAddress(profile.walletAddress)}
                </span>
                <span className="rounded-full border border-[#e8e8e8] bg-[#fafafa] px-2 py-1 text-xs font-medium text-[#5f5f5f]">
                  {walletTypeLabel}
                </span>
                <AppButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleCopy()}
                  className="h-8 px-2"
                  aria-label="Copy wallet address"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </AppButton>
              </div>
            </div>

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
                  className="inline-flex items-center gap-1 font-medium text-[#FF7003] hover:text-[#E85D00]"
                >
                  Website <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {canEdit ? (
          <AppButton type="button" variant="secondary" onClick={onEdit} className="shrink-0">
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Edit Client Profile
          </AppButton>
        ) : null}
      </div>

      <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Client trust signals are based on Highrable escrow activity. {indicator.description}
          </p>
        </div>
      </div>
    </section>
  );
}
