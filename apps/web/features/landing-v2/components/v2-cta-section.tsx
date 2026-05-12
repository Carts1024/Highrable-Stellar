"use client";

import { motion } from "framer-motion";
import Link from "next/link";

/** Full-width final CTA with orange gradient background. */
export function V2CtaSection() {
  return (
    <section className="relative overflow-hidden py-25">
      {/* Orange gradient background */}
      <div className="absolute inset-0 bg-linear-to-br from-[#FF8801] via-[#FF7003] to-[#E85D00]" />

      {/* Hard-shadow grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #000 0px, #000 1px, transparent 1px, transparent 40px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="relative mx-auto max-w-7xl px-6 text-center"
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
            className="bg-white px-8 py-3.5 font-mono text-xs tracking-widest text-[#E85D00] uppercase transition-all hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.25)]"
          >
            Find Work
          </Link>
          <Link
            href="/post-job"
            className="border border-white bg-transparent px-8 py-3.5 font-mono text-xs tracking-widest text-white uppercase transition-colors hover:bg-white hover:text-[#E85D00]"
          >
            Post a Job
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
