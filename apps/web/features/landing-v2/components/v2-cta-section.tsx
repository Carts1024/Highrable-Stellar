"use client";

import Link from "next/link";

import { EDITORIAL_CONTAINER_CLASS, EDITORIAL_SECTION_CLASS } from "./editorial-layout";
import { V2Reveal } from "./v2-animated-elements";

/** Final full-screen invitation, using the landing page's existing actions. */
export function V2CtaSection() {
  return (
    <section className={EDITORIAL_SECTION_CLASS}>
      <div className={EDITORIAL_CONTAINER_CLASS}>
        <V2Reveal
          y={24}
          scale={0.98}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl bg-linear-to-br from-[#FF8703] to-[#FE6002] px-5 py-14 text-center text-white sm:px-12 sm:py-16 md:py-24"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-white/15 blur-3xl"
          />
          <div className="relative mx-auto max-w-2xl">
            <V2Reveal
              as="span"
              delay={0.1}
              y={12}
              className="inline-flex rounded-full border border-white/45 px-4 py-2 font-mono text-[0.6rem] font-semibold tracking-[0.12em] uppercase"
            >
              Secure · Fast · Fair
            </V2Reveal>
            <V2Reveal
              as="h2"
              delay={0.18}
              className="mx-auto mt-6 text-3xl leading-[1.08] font-bold tracking-tight sm:text-4xl md:text-6xl"
            >
              The next era of freelance work.
            </V2Reveal>
            <V2Reveal
              as="p"
              delay={0.26}
              className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base"
            >
              Your payment is held safely until the work is approved, and every review you earn is
              kept permanently.
            </V2Reveal>

            <V2Reveal delay={0.34} className="mt-8 flex justify-center">
              <div className="mx-auto flex w-full max-w-md flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/jobs"
                  className="hr-button-hover-shadow flex min-h-11 items-center justify-center rounded-lg bg-white px-6 py-3 font-mono text-xs font-bold tracking-widest text-[#B94A00] uppercase transition-colors hover:bg-white/90"
                >
                  Find Work
                </Link>
                <Link
                  href="/post-job"
                  className="hr-button-hover-shadow flex min-h-11 items-center justify-center rounded-lg border border-white/70 px-6 py-3 font-mono text-xs font-bold tracking-widest text-white uppercase transition-colors hover:bg-transparent"
                >
                  Post a Job
                </Link>
              </div>
            </V2Reveal>
          </div>
        </V2Reveal>
      </div>
    </section>
  );
}
