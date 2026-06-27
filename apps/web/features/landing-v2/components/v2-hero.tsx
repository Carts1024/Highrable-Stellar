"use client";

import { Particles } from "@repo/ui/components/highrable/particles";
import {
  V2_BADGE_ACCENT_CLASS,
  V2_GRADIENT_TEXT_CLASS,
  V2_PAGE_CONTAINER_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Lock, ShieldCheck, Star, Zap } from "lucide-react";

import { V2WaitlistForm } from "./v2-waitlist-form";

const FADE_UP = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } };

function AnnouncementBadge() {
  return (
    <motion.div
      {...FADE_UP}
      transition={{ duration: 0.5 }}
      className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 sm:mb-6 sm:px-4 ${V2_BADGE_ACCENT_CLASS}`}
    >
      <motion.span
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500"
        aria-hidden="true"
      />
      <span className="font-mono text-[0.6rem] tracking-[0.08em] uppercase sm:text-[0.65rem]">
        Built on Stellar · Smart Contract Escrow Live
      </span>
    </motion.div>
  );
}

/** Floating browser-chrome mockup showcasing the Highrable platform UI */
function HeroAppMockup() {
  return (
    <div className="relative w-full max-w-full">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -inset-6 z-0 sm:-inset-8">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 right-0 h-48 w-48 rounded-full bg-orange-500/25 blur-[70px] sm:h-72 sm:w-72 sm:blur-[80px]"
        />
        <motion.div
          animate={{ scale: [1.06, 1, 1.06], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-amber-400/20 blur-[60px] sm:h-56 sm:w-56 sm:blur-[70px]"
        />
      </div>

      {/* Window */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: 4 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, delay: 0.2, type: "spring", stiffness: 80 }}
        style={{ perspective: 1000 }}
        className="relative z-10"
      >
        <div className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white/80 shadow-2xl shadow-black/20 backdrop-blur-xl dark:border-neutral-800/80 dark:bg-neutral-900/90">
          {/* Top bar */}
          <div className="flex items-center gap-2 border-b border-neutral-200/50 bg-neutral-50/80 px-3 py-3 sm:px-4 dark:border-neutral-800/50 dark:bg-neutral-950/60">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>

            <div className="mx-auto flex items-center gap-2 rounded-md bg-neutral-200/60 px-2 py-1 sm:px-3 dark:bg-neutral-800/60">
              <Lock className="h-2.5 w-2.5 text-neutral-400" />
              <span className="font-mono text-[0.55rem] text-neutral-500 sm:text-[0.6rem]">
                highrable.work
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3 p-3 sm:space-y-4 sm:p-5">
            {/* Freelancer */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-800/40"
            >
              <div className="relative shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-orange-400 to-amber-500 text-sm font-bold text-white shadow sm:h-10 sm:w-10">
                  KL
                </div>
                <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-neutral-900" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">
                    Kai Larsson
                  </span>

                  <span className="flex items-center gap-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[0.55rem] font-semibold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-2.5 w-2.5" /> Verified
                  </span>
                </div>

                <p className="font-mono text-[0.6rem] text-neutral-400">
                  Soroban · Rust · TypeScript
                </p>

                <div className="mt-1 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-0.5 text-[0.55rem] text-neutral-400">5.0 (38)</span>
                </div>
              </div>
            </motion.div>

            {/* Escrow */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              className="rounded-xl border border-orange-200/60 bg-orange-50/50 p-3 dark:border-orange-900/40 dark:bg-orange-950/20"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[0.58rem] font-semibold tracking-wider text-orange-600 uppercase dark:text-orange-400">
                  Active Escrow · #HR-4892
                </span>

                <span className="flex items-center gap-1 font-mono text-[0.55rem] text-neutral-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>

              <div className="flex items-end justify-between">
                <span className="text-lg font-black tracking-tight text-neutral-900 sm:text-xl dark:text-neutral-50">
                  3,200 USDC
                </span>
                <span className="font-mono text-[0.6rem] text-neutral-400">2 of 3 milestones</span>
              </div>

              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "66%" }}
                  transition={{ delay: 0.8, duration: 0.9, ease: "easeOut" }}
                  className="h-full rounded-full bg-linear-to-r from-orange-500 to-amber-400"
                />
              </div>
            </motion.div>

            {/* Settlements */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="space-y-2"
            >
              <p className="font-mono text-[0.58rem] tracking-wider text-neutral-400 uppercase">
                Recent Settlements
              </p>
              {[
                {
                  amount: "+1,200 USDC",
                  label: "Milestone 1 released",
                  icon: CheckCircle2,
                  color: "text-emerald-500",
                  delay: 0.75,
                },
                {
                  amount: "+850 USDC",
                  label: "Milestone 2 released",
                  icon: Zap,
                  color: "text-orange-500",
                  delay: 0.85,
                },
              ].map(({ amount, label, icon: Icon, color, delay }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay, duration: 0.4 }}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2 dark:border-neutral-800/60 dark:bg-neutral-800/30"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    <span className="text-[0.65rem] text-neutral-600 dark:text-neutral-400">
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-400">
                    {amount}
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Floating badges */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-2 left-2 z-20 flex items-center gap-2 rounded-xl border border-neutral-200/60 bg-white/90 px-3 py-2 shadow-xl backdrop-blur-md sm:-bottom-4 sm:-left-6 dark:border-neutral-800 dark:bg-neutral-900/90"
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <div>
          <p className="text-[0.65rem] font-bold text-neutral-800 dark:text-neutral-100">
            0 Disputes
          </p>
          <p className="text-[0.55rem] text-neutral-400">On-chain verified</p>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute -top-2 right-2 z-20 flex items-center gap-2 rounded-xl border border-neutral-200/60 bg-white/90 px-3 py-2 shadow-xl backdrop-blur-md sm:-top-4 sm:-right-4 dark:border-neutral-800 dark:bg-neutral-900/90"
      >
        <Zap className="h-4 w-4 text-orange-500" />
        <div>
          <p className="text-[0.65rem] font-bold text-neutral-800 dark:text-neutral-100">
            2.3s Settlement
          </p>
          <p className="text-[0.55rem] text-neutral-400">Stellar network</p>
        </div>
      </motion.div>
    </div>
  );
}

/** Full-width hero section with split-screen waitlist layout. */
export function V2Hero() {
  return (
    <section className="relative overflow-hidden bg-background pt-20 pb-16 sm:pt-24 sm:pb-20 lg:pt-36 lg:pb-32">
      <Particles className="pointer-events-none absolute inset-0 z-0 opacity-60" />

      {/* Top orange radial aura */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 55% -5%, rgba(255,112,3,0.13) 0%, transparent 75%)",
        }}
      />

      <div className={`${V2_PAGE_CONTAINER_CLASS} relative z-10`}>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-12">
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="
              flex flex-col items-center text-center
              lg:items-start lg:text-left
            "
          >
            <AnnouncementBadge />

            <motion.h1
              {...FADE_UP}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="hr-text-primary mb-6 text-3xl leading-[1.08] font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-[3.85rem]"
            >
              The Next Era of
              <br />
              <span className={V2_GRADIENT_TEXT_CLASS}>Freelance Work.</span>
            </motion.h1>

            <motion.p
              {...FADE_UP}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hr-text-secondary mb-8 max-w-lg text-sm leading-relaxed sm:text-base lg:text-lg"
            >
              Highrable secures payments in Soroban smart-contract escrows and archives verified
              developer reputation permanently on-chain.{" "}
              <span className="hr-text-primary font-semibold">Zero payment risk.</span>
            </motion.p>

            <motion.div
              {...FADE_UP}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="w-full max-w-md"
            >
              <V2WaitlistForm />
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              {...FADE_UP}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="
                mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2
                lg:justify-start
              "
            >
              {["Smart-contract escrow", "On-chain reputation", "Instant USDC payouts"].map(
                (label) => (
                  <span
                    key={label}
                    className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {label}
                  </span>
                ),
              )}
            </motion.div>
          </motion.div>

          {/* Right column */}
          <div className="hidden lg:block">
            <HeroAppMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
