"use client";

import { ProfileAvatar, WalletAddressTile } from "@/features/common";
import {
  getGithubProfileUrl,
  getSafeExternalProfileUrl,
  getXProfileUrl,
} from "@/features/profile/lib/profile-format";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { ExternalLink, Github, MapPin, Pencil, ShieldCheck } from "lucide-react";
import Link from "next/link";

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
  const displayName = profile.name || "Unnamed Freelancer";
  const walletTypeLabel =
    profile.walletType === "passkey_smart_account" ? "Passkey Smart Account" : "External Wallet";
  const portfolioUrl = getSafeExternalProfileUrl(profile.portfolioUrl);
  const websiteUrl = getSafeExternalProfileUrl(profile.websiteUrl);
  const xProfileUrl = getXProfileUrl(profile.xHandle);
  const githubProfileUrl = getGithubProfileUrl(profile.githubUsername);

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      {/* Cover */}
      <div className="hr-mode-band relative h-28 sm:h-32">
        <div className="absolute top-3 right-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Payments verified
          </span>
          {canEdit ? (
            <AppButton
              type="button"
              variant="outline"
              onClick={onEdit}
              className="h-8 shrink-0 rounded-lg border-white bg-white px-3 text-xs font-semibold"
            >
              <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Edit profile
            </AppButton>
          ) : null}
        </div>
      </div>

      {/* Identity */}
      <div className="px-5 pb-5 sm:px-6">
        <div className="-mt-10 flex flex-wrap items-end gap-4">
          <ProfileAvatar
            className="h-20 w-20 rounded-2xl"
            avatarUrl={profile.avatarUrl}
            displayName={displayName}
            fallbackLabel="UF"
          />
          <div className="min-w-0 pb-1">
            <span className="hr-mode-soft hr-mode-text inline-flex rounded-full border border-[var(--mode-border)] px-2.5 py-0.5 text-[11px] font-semibold">
              Freelancer
            </span>
            <h2 className="hr-text-primary mt-1 font-sans text-2xl font-bold">{displayName}</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="min-w-0 space-y-3">
            <p className="hr-text-secondary max-w-3xl font-sans text-sm leading-relaxed">
              {profile.bio || "This freelancer has not added a bio yet."}
            </p>

            {profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="hr-mode-soft hr-text-primary inline-flex items-center rounded-full border border-[var(--mode-border)] px-3 py-1 text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}

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
                  className="inline-flex items-center gap-1 font-medium text-highrable-orange-3 transition-colors hover:text-highrable-orange-4"
                >
                  Portfolio <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
              {websiteUrl ? (
                <Link
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-highrable-orange-3 transition-colors hover:text-highrable-orange-4"
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
                      className="inline-flex h-4 w-4 items-center justify-center rounded bg-highrable-orange-2 text-[9px] font-bold text-[var(--mode-on)]"
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

          <WalletAddressTile address={profile.walletAddress} note={walletTypeLabel} />
        </div>
      </div>

      {/* No work footer strip */}
      {stats.completedContracts === 0 ? (
        <div className="border-t border-border/60 bg-muted/30 px-5 py-3 sm:px-6">
          <p className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            No paid jobs finished on Highrable yet
          </p>
        </div>
      ) : null}
    </section>
  );
}
