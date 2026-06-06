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

import { Particles } from "@repo/ui/components/highrable/particles";
import { HeroInteractiveDashboard } from "./hero-interactive-dashboard";

const FADE_UP = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

const STATS = [
  { value: "5%", label: "Flat Escrow Fee" },
  { value: "Instant", label: "Stablecoin Payouts" },
  { value: "On-Chain", label: "Verified Reviews" },
] as const;

import { useEffect, useState } from "react";

function TypingHeadline({ text, speed = 100 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i === text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return <span className="inline-block">{displayed}</span>;
}

function AnnouncementBadge() {
  return (
    <div
      className={`mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 ${V2_BADGE_ACCENT_CLASS}`}
    >
      <span className="inline-block h-1 w-1 bg-current" aria-hidden="true" />
      <span className="font-mono text-[0.65rem] tracking-[0.08em] uppercase">
        Built on Stellar • Smart Contract Escrow Live
      </span>
    </div>
  );
}

function HeroHeadline() {
  return (
    <h1 className="hr-text-primary mb-6 text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl md:text-[3.75rem] lg:leading-[1.05]">
      Freelancing Built on
      <br />
      <span className={V2_GRADIENT_TEXT_CLASS}>
        <TypingHeadline text="Guaranteed Trust" />
      </span>
    </h1>
  );
}

function HeroSubtitle() {
  return (
    <p className="hr-text-secondary mb-8 text-base leading-relaxed sm:text-lg">
      Highrable is a next-generation freelance marketplace built on Stellar. Client payments are
      locked in smart-contract escrows and reputation is permanently recorded on-chain, eliminating
      withholding fees and payment risks.
    </p>
  );
}

function HeroCTAs() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row justify-center md:justify-start">
      <Link
        href="/jobs"
        className={`${V2_BUTTON_PRIMARY_CLASS} px-8 py-3.5 text-center text-sm font-semibold shadow-lg hover:shadow-orange-500/20`}
      >
        Find Work - It's Free
      </Link>
      <Link
        href="/post-job"
        className={`${V2_BUTTON_SECONDARY_CLASS} px-8 py-3.5 text-center font-mono text-xs tracking-widest uppercase transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800`}
      >
        Post a Job
      </Link>
    </div>
  );
}

function HeroStats() {
  return (
    <div className="mt-12 flex flex-wrap items-center justify-center md:justify-start gap-6 border-t border-border pt-8 sm:gap-12">
      {STATS.map(({ value, label }) => (
        <div key={label} className="text-center md:text-left">
          <p className="hr-text-primary text-xl font-bold md:text-2xl">{value}</p>
          <p className="hr-text-muted mt-1 font-mono text-[0.65rem] tracking-[0.06em] uppercase">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Full-width hero section with split-screen layout showcasing copy and live widgets. */
export function V2Hero() {
  return (
    <section className="relative overflow-hidden bg-background pt-28 pb-20 lg:pt-36 lg:pb-28">
      {/* Dynamic Network background canvas */}
      <Particles className="pointer-events-none absolute inset-0 z-0 opacity-70" />

      {/* Subtle light aura gradient */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40 dark:opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% -10%, rgba(255,112,3,0.15) 0%, transparent 80%)",
        }}
      />

      <div className={`${V2_PAGE_CONTAINER_CLASS} relative z-10`}>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Heading and Text */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center md:text-left lg:col-span-7"
          >
            <motion.div {...FADE_UP} transition={{ duration: 0.6 }}>
              <AnnouncementBadge />
            </motion.div>

            <HeroHeadline />

            <motion.div {...FADE_UP} transition={{ duration: 0.7, delay: 0.15 }}>
              <HeroSubtitle />
            </motion.div>

            <motion.div {...FADE_UP} transition={{ duration: 0.7, delay: 0.25 }}>
              <HeroCTAs />
            </motion.div>

            <motion.div {...FADE_UP} transition={{ duration: 0.7, delay: 0.35 }}>
              <HeroStats />
            </motion.div>
          </motion.div>

          {/* Right Column: Interactive Trust Dashboard Mockup */}
          {/* Right Column: Interactive Trust Dashboard Mockup - hidden on small screens */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, type: "spring", stiffness: 100 }}
            className="flex w-full justify-center lg:col-span-5 hidden sm:block"
          >
            <HeroInteractiveDashboard />
          </motion.div>
          {/* Placeholder for very small screens */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, type: "spring", stiffness: 100 }}
            className="flex w-full justify-center lg:col-span-5 block sm:hidden"
          >
            <div className="text-center text-sm text-muted-foreground">Dashboard preview unavailable on small screens</div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
