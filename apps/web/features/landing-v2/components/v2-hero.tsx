"use client";

import GradientWaves from "@repo/ui/components/highrable/gradient-waves";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { EDITORIAL_CONTAINER_CLASS } from "./editorial-layout";
import { V2AnnouncementMarquee, V2Reveal } from "./v2-animated-elements";

function HeroLaunchActions() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center gap-3 sm:flex-row">
      <Link
        href="/jobs"
        className="hr-button-hover-shadow flex min-h-11 items-center justify-center gap-2 rounded-lg bg-linear-to-r from-[#FF8703] to-[#FE6002] px-6 py-3 font-mono text-xs font-bold tracking-widest text-white uppercase transition-opacity hover:opacity-90"
      >
        Find Work
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
      <Link
        href="/post-job"
        className="hr-button-hover-shadow hr-text-accent flex min-h-11 items-center justify-center rounded-lg border border-highrable-orange-3 px-6 py-3 font-mono text-xs font-bold tracking-widest uppercase transition-colors hover:bg-transparent"
      >
        Post a Job
      </Link>
    </div>
  );
}

/** Full-screen editorial hero with the marketplace actions. */
export function V2Hero() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateColorScheme = () => setIsDarkMode(colorScheme.matches);

    updateColorScheme();
    colorScheme.addEventListener("change", updateColorScheme);
    return () => colorScheme.removeEventListener("change", updateColorScheme);
  }, []);

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden border-b border-border bg-background px-4 pt-24 pb-20 text-center text-foreground sm:px-6 sm:pt-28 sm:pb-24"
    >
      <GradientWaves
        horizonColor={isDarkMode ? "#171717" : "#FFF8F1"}
        waveColor={isDarkMode ? "#332113" : "#FFE0C2"}
        crestColor={isDarkMode ? "#A95008" : "#FF8703"}
        speed={0.25}
        amplitude={5}
        swell={40}
        detail="low"
        grainIntensity={0.03}
        parallaxStrength={0.35}
        className="absolute inset-0 z-0"
      />

      <div className={`${EDITORIAL_CONTAINER_CLASS} relative z-10 py-10 text-center`}>
        <V2Reveal
          as="p"
          className="mb-5 font-mono text-[0.65rem] font-semibold tracking-[0.12em] text-highrable-text-accent uppercase"
        >
          Freelance work, made fair
        </V2Reveal>

        <V2Reveal
          as="h1"
          delay={0.08}
          className="mx-auto max-w-6xl text-[clamp(2.4rem,7.2vw,6rem)] leading-[0.98] font-bold tracking-[-0.055em]"
        >
          Get Funded. Do the Work.
          <br />
          <span className="bg-linear-to-r from-[#FF8703] to-[#FE6002] bg-clip-text text-transparent">
            Get Paid.
          </span>
        </V2Reveal>

        <V2Reveal
          as="p"
          delay={0.16}
          className="hr-text-muted mx-auto mt-6 max-w-xl font-mono text-sm leading-relaxed sm:text-base"
        >
          A freelance platform built on contracts, not promises.
        </V2Reveal>

        <V2Reveal delay={0.24} className="mt-8 flex justify-center">
          <HeroLaunchActions />
        </V2Reveal>

        <V2Reveal
          delay={0.32}
          className="mt-8 inline-flex flex-wrap items-center justify-center gap-3"
        >
          <div className="flex" aria-hidden="true">
            <span className="h-8 w-8 rounded-full border-2 border-background bg-[#FFD9B0] shadow-sm" />
            <span className="-ml-2.5 h-8 w-8 rounded-full border-2 border-background bg-[#FFB877] shadow-sm" />
            <span className="-ml-2.5 h-8 w-8 rounded-full border-2 border-background bg-[#FE6002] shadow-sm" />
            <span className="-ml-2.5 h-8 w-8 rounded-full border-2 border-background bg-[#27221F] shadow-sm" />
          </div>
          <div className="text-left">
            <p
              className="font-sans text-sm tracking-[0.12em] text-[#FF8703]"
              aria-label="5 out of 5 stars"
            >
              ★★★★★
            </p>
            <p className="hr-text-muted mt-0.5 font-mono text-[0.65rem]">
              For freelancers and clients, everywhere
            </p>
          </div>
        </V2Reveal>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10">
        <V2AnnouncementMarquee />
      </div>
    </section>
  );
}
