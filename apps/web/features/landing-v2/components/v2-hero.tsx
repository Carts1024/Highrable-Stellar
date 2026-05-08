"use client";

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
    <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#FF7003]/30 bg-[#fff7ed] px-4 py-1.5">
      <span className="inline-block h-1 w-1 bg-[#FF7003]" aria-hidden="true" />
      <span className="font-mono text-[0.65rem] tracking-[0.08em] text-[#B94A00] uppercase">
        Built on Stellar | Powered by AI
      </span>
    </div>
  );
}

function HeroHeadline() {
  return (
    <h1 className="mb-6 text-5xl leading-[1.1] font-medium tracking-tight text-[#0a0a0a] md:text-[4rem]">
      Freelancing Built on{" "}
      <span className="bg-linear-to-r from-[#FF8801] via-[#FF7003] to-[#E85D00] bg-clip-text text-transparent">
        Guaranteed Trust
      </span>
    </h1>
  );
}

function HeroSubtitle() {
  return (
    <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#5f5f5f]">
      Highrable is the next-generation freelance marketplace at the intersection of Agentic AI and
      Stellar. Smart contract escrow, on-chain reputation, and AI-driven hiring - all in one
      trustless, zero-border ecosystem.
    </p>
  );
}

function HeroCTAs() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <Link
        href="/jobs"
        className="bg-linear-to-br from-[#FF8801] via-[#FF7003] to-[#E85D00] px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.20)] hover:brightness-105"
        style={{ borderRadius: "8px" }}
      >
        Find Work - It's Free
      </Link>
      <Link
        href="/post-job"
        className="border border-[#0a0a0a] bg-white px-8 py-3.5 font-mono text-xs tracking-widest text-[#0a0a0a] uppercase transition-colors hover:bg-[#0a0a0a] hover:text-white"
      >
        Post a Job
      </Link>
    </div>
  );
}

function HeroStats() {
  return (
    <div className="mt-16 flex flex-col items-center justify-center gap-8 border-t border-[#e8e8e8] pt-10 sm:flex-row sm:gap-16">
      {STATS.map(({ value, label }) => (
        <div key={label} className="text-center">
          <p className="text-2xl font-semibold text-[#0a0a0a]">{value}</p>
          <p className="mt-1 font-mono text-[0.7rem] tracking-[0.06em] text-[#7f7f7f] uppercase">
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
        className="mx-auto max-w-7xl px-6 text-center"
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
