"use client";

import {
  HighrableV2PageContainer,
  HighrableV2Section,
  SectionLabel,
} from "@repo/ui/components/highrable/v2-marketing";
import { motion } from "framer-motion";
import {
  Lock,
  Star,
  ShieldCheck,
  Wallet,
  Fingerprint,
  Sparkles,
  TrendingUp,
  Cpu,
} from "lucide-react";

import type { TFeatureItem } from "../types/landing-v2.types";

import { FEATURES } from "../constants/landing-v2.constants";
import { SpotlightCard } from "@repo/ui/components/highrable/spotlight-card";

// --- Micro-UI Visualizations for the Bento Grid ---

function EscrowVisual() {
  return (
    <div className="relative mt-4 flex h-32 w-full items-center justify-center overflow-hidden rounded-lg bg-neutral-50/50 p-4 dark:bg-neutral-950/40">
      <div className="flex items-center gap-6">
        <div className="rounded-lg border border-border bg-white px-3 py-1.5 text-center font-mono text-[0.65rem] shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="font-bold text-neutral-800 dark:text-neutral-200">Client</p>
          <p className="text-neutral-400">Funds Locked</p>
        </div>
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/40">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 rounded-full bg-orange-400/20 blur-sm"
          />
          <Lock className="h-5 w-5 text-orange-500" />
        </div>
        <div className="rounded-lg border border-border bg-white px-3 py-1.5 text-center font-mono text-[0.65rem] shadow-sm dark:border-border/30 dark:bg-neutral-900">
          <p className="font-bold text-neutral-800 dark:text-neutral-200">Freelancer</p>
          <p className="text-neutral-400">Milestone release</p>
        </div>
      </div>
    </div>
  );
}

function ReviewsVisual() {
  return (
    <div className="mt-4 flex h-32 w-full flex-col justify-center rounded-lg bg-neutral-50/50 p-4 text-left dark:bg-neutral-950/40">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
        ))}
        <span className="ml-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">5.0</span>
      </div>
      <p className="mt-2 text-xs font-medium text-neutral-800 dark:text-neutral-300">
        "Completed milestone exactly as described. Payment was instant."
      </p>
      <div className="mt-2 flex items-center gap-1 font-mono text-[0.65rem] text-neutral-400">
        <ShieldCheck className="h-3 w-3 text-emerald-500" />
        <span>Verified Ledger Hash: 0x8a92...ef3a</span>
      </div>
    </div>
  );
}

function AiMatchingVisual() {
  return (
    <div className="mt-4 flex h-32 w-full flex-col justify-between rounded-lg bg-neutral-50/50 p-3.5 text-left dark:bg-neutral-950/40">
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5 dark:border-neutral-800">
        <span className="font-sans text-xs font-bold text-neutral-700 dark:text-neutral-300">
          AI Candidate Fit
        </span>
        <span className="flex items-center gap-0.5 font-mono text-[0.6rem] font-bold text-orange-500">
          <Sparkles className="h-3 w-3 fill-current" />
          98% Match
        </span>
      </div>
      <div className="space-y-1 font-mono text-[0.65rem] text-neutral-500">
        <div className="flex justify-between">
          <span>Stellar Dev Skills:</span>
          <span className="text-neutral-800 dark:text-neutral-200">Excellent (5/5)</span>
        </div>
        <div className="flex justify-between">
          <span>Trust Score:</span>
          <span className="text-emerald-500">Perfect (On-Chain)</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className="h-full w-[98%] rounded-full bg-gradient-to-r from-orange-500 to-amber-400" />
      </div>
    </div>
  );
}

function WalletVisual() {
  return (
    <div className="mt-4 flex h-32 w-full items-center justify-between gap-4 rounded-lg bg-neutral-50/50 p-4 text-left dark:bg-neutral-950/40">
      <div className="space-y-1">
        <p className="font-mono text-[0.65rem] text-neutral-400">Stellar Wallet (USDC)</p>
        <p className="text-xl font-bold text-neutral-800 dark:text-neutral-100">$1,480.00</p>
        <span className="inline-flex items-center gap-0.5 font-mono text-[0.6rem] text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="h-3 w-3" />
          Near-Zero Fee Payout
        </span>
      </div>
      {/* Mini Chart Mockup */}
      <div className="flex h-12 w-24 items-end gap-1.5">
        {[20, 35, 25, 45, 60, 50, 75].map((h, i) => (
          <div
            key={i}
            className="w-2.5 rounded-t bg-gradient-to-t from-orange-300 to-orange-500"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function ReputationVisual() {
  return (
    <div className="mt-4 flex h-32 w-full flex-col justify-center rounded-lg bg-neutral-50/50 p-4 text-left dark:bg-neutral-950/40">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/40">
          <ShieldCheck className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
            Portable Reputation ID
          </p>
          <p className="font-mono text-[0.6rem] text-neutral-400">did:stellar:freelancer:402</p>
        </div>
      </div>
      <div className="mt-3 flex gap-3 text-center">
        <div className="rounded border border-border bg-white px-2.5 py-1 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-bold text-orange-500">14</p>
          <p className="font-mono text-[0.55rem] text-neutral-400 uppercase">Jobs Done</p>
        </div>
        <div className="rounded border border-border bg-white px-2.5 py-1 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-bold text-orange-500">100%</p>
          <p className="font-mono text-[0.55rem] text-neutral-400 uppercase">Release Rate</p>
        </div>
      </div>
    </div>
  );
}

function OnboardingVisual() {
  return (
    <div className="mt-4 flex h-32 w-full flex-col justify-center gap-2 rounded-lg bg-neutral-50/50 p-4 dark:bg-neutral-950/40">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 font-mono text-[0.65rem] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <Fingerprint className="h-3.5 w-3.5 animate-pulse text-orange-500" />
        <span>Continue with Passkey</span>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border border-border bg-white py-1.5 text-center font-mono text-[0.6rem] text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
          Google
        </div>
        <div className="flex-1 rounded-lg border border-border bg-white py-1.5 text-center font-mono text-[0.6rem] text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
          GitHub
        </div>
      </div>
    </div>
  );
}

const FEATURE_VISUALS: Record<string, React.ReactNode> = {
  escrow: <EscrowVisual />,
  reviews: <ReviewsVisual />,
  "ai-matching": <AiMatchingVisual />,
  wallet: <WalletVisual />,
  reputation: <ReputationVisual />,
  onboarding: <OnboardingVisual />,
};

interface IFeatureCardProps {
  readonly feature: TFeatureItem;
  readonly index: number;
}

function FeatureCard({ feature, index }: IFeatureCardProps) {
  const isLarge = feature.id === "escrow" || feature.id === "wallet";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className={isLarge ? "md:col-span-2" : "md:col-span-1"}
    >
      <SpotlightCard
        className="flex h-full flex-col justify-between border-border bg-card p-6 dark:border-neutral-800 dark:bg-neutral-900/50"
        spotlightColor="rgba(255, 112, 3, 0.06)"
        spotlightRadius={260}
      >
        <div>
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/20">
              {feature.id === "escrow" && <Lock className="h-4.5 w-4.5 text-orange-500" />}
              {feature.id === "reviews" && (
                <Star className="h-4.5 w-4.5 fill-current text-orange-500" />
              )}
              {feature.id === "ai-matching" && <Cpu className="h-4.5 w-4.5 text-orange-500" />}
              {feature.id === "wallet" && <Wallet className="h-4.5 w-4.5 text-orange-500" />}
              {feature.id === "reputation" && (
                <ShieldCheck className="h-4.5 w-4.5 text-orange-500" />
              )}
              {feature.id === "onboarding" && (
                <Fingerprint className="h-4.5 w-4.5 text-orange-500" />
              )}
            </div>
            {feature.comingSoon && (
              <span className="hr-v2-badge-accent px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.08em] uppercase">
                Coming Soon
              </span>
            )}
          </div>
          <h3 className="hr-text-primary mb-2 text-left text-base font-bold">{feature.title}</h3>
          <p className="hr-text-secondary mb-4 text-left text-xs leading-relaxed">
            {feature.description}
          </p>
        </div>

        {/* Dynamic Micro UI Asset */}
        {FEATURE_VISUALS[feature.id]}

        <div className="mt-5 border-t border-border/70 pt-3 text-left dark:border-neutral-800">
          <p className="hr-text-accent text-[0.7rem] leading-relaxed font-medium">
            <span className="mr-1 font-mono tracking-wider text-neutral-400 uppercase">
              Impact -
            </span>
            {feature.businessValue}
          </p>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

/** Redesigned Bento Grid highlighting Highrable's core capabilities. */
export function V2FeaturesSection() {
  return (
    <HighrableV2Section id="features">
      <HighrableV2PageContainer>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl text-left"
        >
          <SectionLabel className="mb-4">Key Features</SectionLabel>
          <h2 className="hr-text-primary text-3xl leading-[1.15] font-medium md:text-4xl">
            Everything you need in one trusted platform
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
            Highrable integrates blockchain escrow and portable reputation today, with AI hiring
            features clearly marked as coming soon.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} />
          ))}
        </div>
      </HighrableV2PageContainer>
    </HighrableV2Section>
  );
}
