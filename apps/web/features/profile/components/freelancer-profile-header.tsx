"use client";

import { ProfileAvatar } from "@/features/common";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import {
  getGithubProfileUrl,
  getSafeExternalProfileUrl,
  getXProfileUrl,
} from "@/features/profile/lib/profile-format";
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
    <section className="rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl">
      {/* Header bar — mirrors job-detail "Contract Snapshot" pattern */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-5 sm:p-6">
        <div className="space-y-2">
          <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
            Freelancer Identity
          </p>
          <h2 className="hr-text-primary font-sans text-2xl font-semibold">{displayName}</h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Escrow-verified
          </span>
          {canEdit ? (
            <AppButton
              type="button"
              variant="outline"
              onClick={onEdit}
              className="h-9 shrink-0 rounded-lg px-4 text-xs font-semibold"
            >
              <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Edit profile
            </AppButton>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6">
        <div className="flex min-w-0 gap-4">
          <div className="shrink-0">
            <ProfileAvatar
              avatarUrl={profile.avatarUrl}
              displayName={displayName}
              fallbackLabel="UF"
            />
          </div>

          <div className="min-w-0 space-y-3">
            {/* Wallet address row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs break-all text-muted-foreground">
                {shortenWalletAddress(profile.walletAddress)}
              </span>
              <span className="inline-flex items-center rounded-md border border-border/80 bg-muted/50 px-2 py-0.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                {walletTypeLabel}
              </span>
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleCopy()}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                aria-label="Copy wallet address"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </AppButton>
            </div>

            {/* Bio */}
            <p className="hr-text-secondary max-w-3xl font-sans text-sm leading-relaxed">
              {profile.bio || "This freelancer has not added a bio yet."}
            </p>

            {/* Skills */}
            {profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="hr-text-primary inline-flex items-center rounded-md border border-border/80 bg-muted/50 px-2.5 py-1 text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Location + external links */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {profile.location ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {profile.location}
                </span>
              ) : null}
              {portfolioUrl ? (
                <Link
                  href={portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-highrable-orange-3 transition-colors hover:text-highrable-orange-2"
                >
                  Portfolio <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
              {websiteUrl ? (
                <Link
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-highrable-orange-3 transition-colors hover:text-highrable-orange-2"
                >
                  Website <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
            </div>

            {/* Social handles */}
            {profile.discordHandle || profile.xHandle || profile.githubUsername ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                {profile.discordHandle ? (
                  <span className="hr-text-primary inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/50 px-3 py-1.5 text-xs font-medium">
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#5865F2] text-[9px] font-bold text-white"
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
                    className="hr-text-primary inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/50 px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted"
                  >
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded bg-foreground text-[9px] font-bold text-background"
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
                    className="hr-text-primary inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/50 px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted"
                  >
                    <Github className="h-3.5 w-3.5" aria-hidden="true" />
                    {profile.githubUsername}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Meta grid — mirrors job-detail dl grid */}
        <dl className="mt-6 grid gap-5 border-t border-border/60 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
              Wallet
            </dt>
            <dd className="hr-text-primary font-sans font-semibold break-all">
              {profile.walletAddress}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
              Wallet type
            </dt>
            <dd className="hr-text-primary font-sans font-semibold">{walletTypeLabel}</dd>
          </div>
          {profile.location ? (
            <div>
              <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
                Location
              </dt>
              <dd className="hr-text-primary font-sans font-semibold">{profile.location}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {/* No work footer strip */}
      {stats.completedContracts === 0 ? (
        <div className="border-t border-border/60 bg-muted/30 px-5 py-3 sm:px-6">
          <p className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            No escrow-verified paid work completed on Highrable yet
          </p>
        </div>
      ) : null}
    </section>
  );
}
