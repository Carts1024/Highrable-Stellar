"use client";

import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Check, Copy, ExternalLink, MapPin, Pencil, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { TFreelancerProfile, TFreelancerProfileStats } from "@/features/profile/types";

export function FreelancerProfileHeader({
  profile,
  stats,
  canEdit,
  onEdit,
}: {
  readonly profile: TFreelancerProfile;
  readonly stats: TFreelancerProfileStats;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const displayName = profile.name || "Unnamed Freelancer";
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
            {initials || "UF"}
          </div>
          <div className="min-w-0 space-y-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-[#0a0a0a]">{displayName}</h1>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Escrow-Verified Reputation
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#5f5f5f]">
                <span className="font-mono break-all">
                  {shortenWalletAddress(profile.walletAddress)}
                </span>
                <Badge variant="outline" className="border-[#e8e8e8] bg-[#fafafa]">
                  {walletTypeLabel}
                </Badge>
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
              {profile.bio || "This freelancer has not added a bio yet."}
            </p>

            {profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="outline" className="border-[#e8e8e8] bg-[#fafafa]">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-4 text-sm">
              {profile.location ? (
                <span className="inline-flex items-center gap-1 text-[#5f5f5f]">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {profile.location}
                </span>
              ) : null}
              {profile.portfolioUrl ? (
                <Link
                  href={profile.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#FF7003] hover:text-[#E85D00]"
                >
                  Portfolio <ExternalLink className="h-3.5 w-3.5" />
                </Link>
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
            Edit Profile
          </AppButton>
        ) : null}
      </div>

      <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Completed work and reviews are verified through paid Stellar escrow records.
      </div>

      {stats.completedContracts === 0 ? (
        <p className="mt-3 text-sm text-[#5f5f5f]">
          This freelancer has not completed verified paid work on Highrable yet.
        </p>
      ) : null}
    </section>
  );
}
