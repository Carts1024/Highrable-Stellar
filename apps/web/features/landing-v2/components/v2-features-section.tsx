"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Sparkles, Star, UserRound, Wallet, Zap } from "lucide-react";

import {
  EDITORIAL_CONTAINER_CLASS,
  EDITORIAL_SECTION_CLASS,
  EditorialSectionLabel,
} from "./editorial-layout";
import { V2AnnouncementMarquee, V2Reveal } from "./v2-animated-elements";

const FEATURES = [
  { icon: ShieldCheck, title: "Secure payment holds", comingSoon: false },
  { icon: Star, title: "Reviews from real work", comingSoon: false },
  { icon: Zap, title: "Fast, low-fee payments", comingSoon: false },
  { icon: Wallet, title: "A reputation you keep", comingSoon: false },
  { icon: UserRound, title: "Simple sign-up", comingSoon: false },
  { icon: Sparkles, title: "AI matching + interview", comingSoon: true },
] as const;

/** Simple icon-led overview of Highrable’s key features. */
export function V2FeaturesSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="features" className={`${EDITORIAL_SECTION_CLASS} text-center`}>
      <div className={`${EDITORIAL_CONTAINER_CLASS} pb-12`}>
        <div className="mx-auto mb-10 max-w-2xl">
          <EditorialSectionLabel>What Highrable does</EditorialSectionLabel>
          <V2Reveal
            as="h2"
            delay={0.08}
            className="hr-text-primary text-3xl leading-[1.08] font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            The essentials for work you can trust.
          </V2Reveal>
          <V2Reveal
            as="p"
            delay={0.16}
            className="hr-text-secondary mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base"
          >
            Keep payment, approvals, and your work history visible from start to finish.
          </V2Reveal>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, comingSoon }, index) => (
            <V2Reveal
              as="article"
              key={title}
              y={16}
              scale={0.98}
              lift
              delay={0.24 + index * 0.07}
              className="flex flex-col items-center gap-3"
            >
              <motion.span
                whileHover={shouldReduceMotion ? undefined : { scale: 1.1, rotate: 4 }}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-highrable-surface-accent text-highrable-orange-1"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </motion.span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h3 className="hr-text-primary text-sm font-semibold">{title}</h3>
                {comingSoon && (
                  <span className="hr-text-accent rounded bg-highrable-surface-accent px-2 py-1 font-mono text-[0.55rem] font-bold tracking-wide uppercase">
                    Coming soon
                  </span>
                )}
              </div>
            </V2Reveal>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0">
        <V2AnnouncementMarquee />
      </div>
    </section>
  );
}
