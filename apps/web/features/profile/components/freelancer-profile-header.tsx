"use client";

import { ProfileAvatar } from "@/features/common";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import {
  getGithubProfileUrl,
  getSafeExternalProfileUrl,
  getXProfileUrl,
} from "@/features/profile/lib/profile-format";
import { HighrableV2IconNotice } from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Check, Copy, ExternalLink, Github, MapPin, Pencil, ShieldCheck } from "lucide-react";
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
  const walletTypeLabel =
    profile.walletType === "passkey_smart_account" ? "Passkey Smart Account" : "External Wallet";
  const portfolioUrl = getSafeExternalProfileUrl(profile.portfolioUrl);
  const websiteUrl = getSafeExternalProfileUrl(profile.websiteUrl);
  const xProfileUrl = getXProfileUrl(profile.xHandle);
  const githubProfileUrl = getGithubProfileUrl(profile.githubUsername);

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
    <section className="border border-[#e8e8e8] bg-white">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4 p-5 sm:p-6">
          <ProfileAvatar
            avatarUrl={profile.avatarUrl}
            displayName={displayName}
            fallbackLabel="UF"
          />
          <div className="min-w-0 space-y-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-[#0a0a0a]">{displayName}</h1>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Escrow-Verified Reputation
                </Badge>
                <HighrableV2IconNotice
                  label="How freelancer reputation is verified"
                  tone="success"
                  message="Completed work and reviews are verified through paid Stellar escrow records."
                />
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
              {portfolioUrl ? (
                <Link
                  href={portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#FF7003] hover:text-[#E85D00]"
                >
                  Portfolio <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : null}
              {websiteUrl ? (
                <Link
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#FF7003] hover:text-[#E85D00]"
                >
                  Website <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>

            {profile.discordHandle || profile.xHandle || profile.githubUsername ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-[#e8e8e8] pt-3 text-sm">
                {profile.discordHandle ? (
                  <span className="inline-flex items-center gap-2 border border-[#e8e8e8] bg-[#fafafa] px-3 py-1.5 font-medium text-[#5f5f5f]">
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center bg-[#5865F2] text-[10px] font-bold text-white"
                      aria-hidden="true"
                    >
                      D
                    </span>
                    {profile.discordHandle}
                  </span>
                ) : null}
                {profile.xHandle && xProfileUrl ? (
                  <Link
                    href={xProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-[#e8e8e8] bg-[#fafafa] px-3 py-1.5 font-medium text-[#5f5f5f] transition-colors hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
                  >
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center bg-[#0a0a0a] text-[11px] font-bold text-white"
                      aria-hidden="true"
                    >
                      X
                    </span>
                    @{profile.xHandle}
                  </Link>
                ) : null}
                {profile.githubUsername && githubProfileUrl ? (
                  <Link
                    href={githubProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-[#e8e8e8] bg-[#fafafa] px-3 py-1.5 font-medium text-[#5f5f5f] transition-colors hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
                  >
                    <Github className="h-4 w-4" aria-hidden="true" />
                    {profile.githubUsername}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {canEdit ? (
          <AppButton
            type="button"
            variant="secondary"
            onClick={onEdit}
            className="m-5 shrink-0 rounded-none sm:m-6"
          >
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Edit Profile
          </AppButton>
        ) : null}
      </div>

      {stats.completedContracts === 0 ? (
        <p className="border-t border-[#e8e8e8] px-5 py-3 text-sm text-[#5f5f5f] sm:px-6">
          This freelancer has not completed verified paid work on Highrable yet.
        </p>
      ) : null}
    </section>
  );
}
