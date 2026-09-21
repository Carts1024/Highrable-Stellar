"use client";

import {
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/** Full-width final CTA styled inside a glassmorphic dark container with animated background glow blobs. */
export function V2CtaSection() {
  return (
    <section className={`relative overflow-hidden ${V2_SECTION_SPACING_CLASS}`}>
      <div className={V2_PAGE_CONTAINER_CLASS}>
        <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 px-8 py-16 text-center shadow-2xl md:px-16 md:py-24 dark:border-neutral-800 dark:bg-black">
          {/* Immersive background glow effects */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], x: [0, 20, 0], y: [0, -20, 0] }}
            transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
            className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-orange-600/20 blur-[80px]"
          />
          <motion.div
            animate={{ scale: [1.2, 1, 1.2], x: [0, -30, 0], y: [0, 30, 0] }}
            transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
            className="pointer-events-none absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-amber-600/15 blur-[100px]"
          />
          {/* Third slow-moving blob for depth */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], x: [0, -15, 0], y: [0, 15, 0] }}
            transition={{ repeat: Infinity, duration: 16, ease: "easeInOut", delay: 3 }}
            className="pointer-events-none absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/8 blur-[90px]"
          />

          {/* Animated dot-grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          {/* Thin glowing beam border line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-orange-500/50 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-orange-500/20 to-transparent" />

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
                Secure · Instant · Fair
              </span>
            </div>

            <h2 className="mb-6 text-3xl leading-[1.1] font-bold tracking-tight text-white md:text-[3.25rem]">
              The future of freelance
              <br />
              work is guaranteed.
            </h2>

            <p className="mx-auto max-w-lg text-sm leading-relaxed text-neutral-400 sm:text-base">
              Join Highrable today. Your payment is held safely until the work is done, you get paid
              in seconds, and every review you earn is permanent.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
