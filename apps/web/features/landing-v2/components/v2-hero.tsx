"use client";

import {
  V2_BADGE_ACCENT_CLASS,
  V2_BUTTON_PRIMARY_CLASS,
  V2_BUTTON_SECONDARY_CLASS,
  V2_GRADIENT_TEXT_CLASS,
  V2_PAGE_CONTAINER_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion } from "framer-motion";
import Link from "next/link";

const FADE_UP = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } };

const STATS = [
  { value: "5%", label: "Flat Escrow Fee" },
  { value: "Instant", label: "Stablecoin Payouts" },
  { value: "On-Chain", label: "Verified Reviews" },
] as const;

function AnnouncementBadge() {
  return (
    <div
      className={`mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 ${V2_BADGE_ACCENT_CLASS}`}
    >
      <span className="inline-block h-1 w-1 bg-current" aria-hidden="true" />
      <span className="font-mono text-[0.65rem] tracking-[0.08em] uppercase">
        Built on Stellar | AI Features Coming Soon
      </span>
    </div>
  );
}

function HeroHeadline() {
  return (
    <h1 className="hr-text-primary mb-6 text-5xl leading-[1.1] font-medium tracking-tight md:text-[4rem]">
      Freelancing Built on <span className={V2_GRADIENT_TEXT_CLASS}>Guaranteed Trust</span>
    </h1>
  );
}

function HeroSubtitle() {
  return (
    <p className="hr-text-secondary mx-auto mb-10 max-w-2xl text-lg leading-relaxed">
      Highrable is a next-generation freelance marketplace built on Stellar. Smart contract escrow
      and on-chain reputation are core to the platform today, with AI-driven hiring features coming
      soon.
    </p>
  );
}

function HeroCTAs() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <Link href="/jobs" className={`${V2_BUTTON_PRIMARY_CLASS} px-8 py-3.5 text-sm font-semibold`}>
        Find Work - It's Free
      </Link>
      <Link
        href="/post-job"
        className={`${V2_BUTTON_SECONDARY_CLASS} px-8 py-3.5 font-mono text-xs tracking-widest uppercase`}
      >
        Post a Job
      </Link>
    </div>
  );
}

function HeroStats() {
  return (
    <div className="mt-16 flex flex-col items-center justify-center gap-8 border-t border-border pt-10 sm:flex-row sm:gap-16">
      {STATS.map(({ value, label }) => (
        <div key={label} className="text-center">
          <p className="hr-text-primary text-2xl font-semibold">{value}</p>
          <p className="hr-text-muted mt-1 font-mono text-[0.7rem] tracking-[0.06em] uppercase">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Full-width hero section with headline, CTAs, and key stats. */
export function V2Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-32 pb-24">
      {/* Subtle background gradient */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,112,3,0.07) 0%, transparent 70%)",
        }}
      />

      <motion.div
        {...FADE_UP}
        transition={{ duration: 0.7 }}
        className={`${V2_PAGE_CONTAINER_CLASS} text-center`}
      >
        <motion.div {...FADE_UP} transition={{ duration: 0.6 }}>
          <AnnouncementBadge />
        </motion.div>

        <motion.div {...FADE_UP} transition={{ duration: 0.7, delay: 0.1 }}>
          <HeroHeadline />
        </motion.div>

        <motion.div {...FADE_UP} transition={{ duration: 0.7, delay: 0.2 }}>
          <HeroSubtitle />
        </motion.div>

        <motion.div {...FADE_UP} transition={{ duration: 0.7, delay: 0.3 }}>
          <HeroCTAs />
        </motion.div>

        <motion.div {...FADE_UP} transition={{ duration: 0.7, delay: 0.45 }}>
          <HeroStats />
        </motion.div>
      </motion.div>
    </section>
  );
}
