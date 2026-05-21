"use client";

import {
  V2_BUTTON_INVERSE_CLASS,
  V2_BUTTON_LIGHT_CLASS,
  V2_GRID_OVERLAY_CLASS,
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
} from "@/features/common/lib/v2-theme";
import { motion } from "framer-motion";
import Link from "next/link";

/** Full-width final CTA with orange gradient background. */
export function V2CtaSection() {
  return (
    <section className={`relative overflow-hidden ${V2_SECTION_SPACING_CLASS}`}>
      {/* Orange gradient background */}
      <div className="hr-gradient-primary absolute inset-0" />

      {/* Hard-shadow grid texture overlay */}
      <div className={`${V2_GRID_OVERLAY_CLASS} pointer-events-none absolute inset-0 opacity-10`} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className={`${V2_PAGE_CONTAINER_CLASS} relative text-center`}
      >
        <div className="mb-4 inline-flex items-center gap-2">
          <span className="h-1 w-1 bg-white/80" aria-hidden="true" />
          <p className="font-mono text-[0.7rem] tracking-widest text-white/70 uppercase">
            Start Today
          </p>
        </div>
        <h2 className="mb-4 text-3xl leading-[1.1] font-medium text-white md:text-[2.75rem]">
          The future of work is trustless.
          <br />
          Are you ready?
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-white/80">
          Join Highrable and be part of the first wave of freelancers and clients building a fairer,
          faster, and borderless economy on Stellar.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/jobs"
            className={`${V2_BUTTON_LIGHT_CLASS} px-8 py-3.5 font-mono text-xs tracking-widest uppercase`}
          >
            Find Work
          </Link>
          <Link
            href="/post-job"
            className={`${V2_BUTTON_INVERSE_CLASS} px-8 py-3.5 font-mono text-xs tracking-widest uppercase`}
          >
            Post a Job
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
