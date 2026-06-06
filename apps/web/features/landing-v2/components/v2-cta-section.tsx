"use client";

import {
  V2_BUTTON_INVERSE_CLASS,
  V2_BUTTON_LIGHT_CLASS,
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

/** Full-width final CTA styled inside a glassmorphic dark container with animated background glow blobs. */
export function V2CtaSection() {
  return (
    <section className={`relative overflow-hidden ${V2_SECTION_SPACING_CLASS}`}>
      <div className={V2_PAGE_CONTAINER_CLASS}>
        <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 px-8 py-16 text-center shadow-2xl md:px-16 md:py-24 dark:border-neutral-800 dark:bg-black">
          {/* Immersive background glow effects */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              x: [0, 20, 0],
              y: [0, -20, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 10,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-orange-600/20 blur-[80px]"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              x: [0, -30, 0],
              y: [0, 30, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 12,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-amber-600/15 blur-[100px]"
          />

          {/* Thin glowing beam border line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

          {/* Content Wrapper */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65 }}
            className="relative z-10 mx-auto max-w-2xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-orange-400">
              <Sparkles className="h-3.5 w-3.5 fill-current" />
              <span className="font-mono text-[0.65rem] font-bold tracking-widest uppercase">
                Stellar Network Escrow
              </span>
            </div>

            <h2 className="mb-6 text-3xl leading-[1.1] font-bold tracking-tight text-white md:text-[3.25rem]">
              The future of freelance
              <br />
              work is guaranteed.
            </h2>

            <p className="mx-auto mb-10 max-w-lg text-sm leading-relaxed text-neutral-400 sm:text-base">
              Join Highrable today. Secure your milestones with smart contracts, receive
              near-instant payouts, and own your verified reputation.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/jobs"
                className={`${V2_BUTTON_LIGHT_CLASS} flex items-center justify-center gap-2 px-8 py-3.5 font-mono text-xs font-bold tracking-widest uppercase shadow-lg shadow-white/5`}
              >
                Find Work
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/post-job"
                className={`${V2_BUTTON_INVERSE_CLASS} flex items-center justify-center gap-2 px-8 py-3.5 font-mono text-xs font-bold tracking-widest uppercase hover:border-orange-500`}
              >
                Post a Job
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
