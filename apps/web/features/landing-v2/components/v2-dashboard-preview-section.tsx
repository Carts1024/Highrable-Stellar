"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CircleCheck, Lock, ShieldCheck, Star, Zap } from "lucide-react";

import {
  EDITORIAL_CONTAINER_CLASS,
  EDITORIAL_SECTION_CLASS,
  EditorialSectionLabel,
} from "./editorial-layout";
import { V2Reveal } from "./v2-animated-elements";

const RECENT_PAYMENTS = [
  { label: "Milestone 1 approved", amount: "+1,200 USDC" },
  { label: "Milestone 2 approved", amount: "+850 USDC" },
] as const;

/** Decorative browser-window dashboard preview with floating status badges. */
export function V2DashboardPreviewSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className={`${EDITORIAL_SECTION_CLASS} text-center`}>
      <motion.div
        aria-hidden="true"
        className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-linear-to-br from-[#FF8703] to-[#FE6002] opacity-20 blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, 26, 0], y: [0, -18, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-linear-to-br from-highrable-orange-3 to-[#FF8703] opacity-20 blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, -22, 0], y: [0, 16, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className={`${EDITORIAL_CONTAINER_CLASS} relative z-10`}>
        <div className="mx-auto mb-8 max-w-2xl">
          <EditorialSectionLabel>See it in your dashboard</EditorialSectionLabel>
          <V2Reveal
            as="h2"
            delay={0.08}
            className="hr-text-primary text-3xl leading-[1.08] font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            Every milestone stays in view.
          </V2Reveal>
          <V2Reveal
            as="p"
            delay={0.16}
            className="hr-text-secondary mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base"
          >
            See what is funded, what has been approved, and what comes next.
          </V2Reveal>
        </div>

        <V2Reveal
          delay={0.24}
          y={24}
          scale={0.97}
          className="relative mx-auto max-w-3xl px-0 py-10 sm:px-2 sm:py-12"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-6 inset-y-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)] bg-[size:44px_44px] opacity-50"
          />
          <span
            aria-hidden="true"
            className="absolute top-2 left-[48%] h-3 w-3 rounded-full bg-highrable-orange-1 opacity-30"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-3 left-[62%] h-2.5 w-2.5 rounded-full bg-highrable-orange-1 opacity-30"
          />

          <motion.article
            aria-label="Example Highrable payment hold dashboard"
            animate={shouldReduceMotion ? undefined : { y: [0, -6, 0] }}
            transition={
              shouldReduceMotion ? undefined : { duration: 8, ease: "easeInOut", repeat: Infinity }
            }
            className="relative z-10 overflow-hidden rounded-[20px] border border-border bg-card text-left shadow-[0_24px_60px_rgba(0,0,0,0.14)]"
          >
            <div className="relative flex items-center gap-2 border-b border-border bg-muted px-4 py-3 sm:px-5">
              <span className="h-3 w-3 rounded-full bg-[#F0625D]" />
              <span className="h-3 w-3 rounded-full bg-[#F5C400]" />
              <span className="h-3 w-3 rounded-full bg-[#3ECF8E]" />
              <div className="hr-text-primary ml-2 flex min-w-0 items-center gap-1.5 rounded-lg bg-border/60 px-2.5 py-1.5 font-mono text-[0.65rem] sm:absolute sm:left-1/2 sm:ml-0 sm:-translate-x-1/2 sm:gap-2 sm:px-4 sm:text-xs">
                <Lock className="h-3 w-3 text-highrable-text-muted" aria-hidden="true" />
                highrable.work
              </div>
            </div>

            <div className="space-y-3 p-3 sm:space-y-4 sm:p-6">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl border border-border bg-muted/50 p-3 min-[400px]:flex-nowrap sm:gap-4 sm:p-4">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#F5A524] to-[#E8720C] font-sans text-sm font-bold text-white sm:h-14 sm:w-14 sm:text-base">
                  KL
                  <span className="absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-[#3ECF8E]" />
                </span>
                <div className="min-w-0 flex-1 basis-32">
                  <h3 className="hr-text-primary text-base font-semibold sm:text-lg">
                    Kai Larsson
                  </h3>
                  <p className="mt-0.5 font-mono text-[0.65rem] text-highrable-text-muted sm:text-xs">
                    Web Dev · Design · TypeScript
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5">
                    <span className="flex text-[#F5B70A]" aria-label="5 out of 5 stars">
                      {[0, 1, 2, 3, 4].map((star) => (
                        <Star key={star} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      ))}
                    </span>
                    <span className="text-xs whitespace-nowrap text-highrable-text-muted">
                      5.0 (38 jobs)
                    </span>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#1F9D55]/30 bg-[#1F9D55]/10 px-2 py-1 text-[0.65rem] font-semibold text-[#1F9D55] sm:px-2.5 sm:text-xs">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Verified
                </span>
              </div>

              <div className="rounded-2xl border border-highrable-orange-1/30 bg-highrable-surface-accent p-3.5 sm:p-5">
                <div className="flex justify-between gap-3 font-mono text-[0.6rem] font-bold tracking-wide uppercase sm:text-xs">
                  <span className="hr-text-accent">Payment hold · #HR-4892</span>
                  <span className="flex items-center gap-1.5 font-medium text-highrable-text-muted normal-case">
                    <span className="h-2 w-2 rounded-full bg-[#3ECF8E]" />
                    Active
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                  <span className="hr-text-primary text-2xl font-bold tracking-tight sm:text-3xl">
                    3,200 USDC
                  </span>
                  <span className="font-mono text-[0.65rem] text-highrable-text-muted sm:text-xs">
                    2 of 3 milestones
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full w-2/3 rounded-full bg-linear-to-r from-[#E8720C] to-[#F5B70A]" />
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-[0.65rem] tracking-wide text-highrable-text-muted uppercase sm:text-xs">
                  Recent payments
                </p>
                <div className="space-y-2">
                  {RECENT_PAYMENTS.map(({ label, amount }) => (
                    <div
                      key={label}
                      className="hr-text-primary flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs sm:px-4 sm:text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <CircleCheck
                          className="h-4 w-4 shrink-0 text-[#1F9D55]"
                          aria-hidden="true"
                        />
                        {label}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 font-mono text-xs font-bold whitespace-nowrap text-[#1F9D55] sm:text-sm">
                        {amount}
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.article>

          <motion.div
            animate={shouldReduceMotion ? undefined : { y: [0, -7, 0] }}
            transition={
              shouldReduceMotion ? undefined : { duration: 7, ease: "easeInOut", repeat: Infinity }
            }
            className="absolute bottom-2 left-0 z-20 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.16)] sm:bottom-6 sm:-left-6 sm:gap-3 sm:px-4 sm:py-3"
          >
            <CircleCheck className="h-6 w-6 text-[#1F9D55]" aria-hidden="true" />
            <span>
              <span className="hr-text-primary block text-sm font-bold">0 Disputes</span>
              <span className="hidden text-xs text-highrable-text-muted sm:block">
                Verified record
              </span>
            </span>
          </motion.div>

          <motion.div
            animate={shouldReduceMotion ? undefined : { y: [0, 6, 0] }}
            transition={
              shouldReduceMotion ? undefined : { duration: 8, ease: "easeInOut", repeat: Infinity }
            }
            className="absolute top-0 right-0 z-20 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.16)] sm:top-2 sm:-right-6 sm:gap-3 sm:px-4 sm:py-3"
          >
            <Zap className="h-6 w-6 text-highrable-orange-2" aria-hidden="true" />
            <span>
              <span className="hr-text-primary block text-sm font-bold">2.3s Payout</span>
              <span className="hidden text-xs text-highrable-text-muted sm:block">
                Near-instant transfer
              </span>
            </span>
          </motion.div>
        </V2Reveal>
      </div>
    </section>
  );
}
