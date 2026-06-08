"use client";

import { SpotlightCard } from "@repo/ui/components/highrable/spotlight-card";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_NUMBER_BADGE_CLASS,
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion } from "framer-motion";

import type { TUniquePoint } from "../types/landing-v2.types";

import { UNIQUE_POINTS } from "../constants/landing-v2.constants";

interface IUniquePointCardProps {
  readonly point: TUniquePoint;
  readonly index: number;
}

function UniquePointCard({ point, index }: IUniquePointCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="h-full"
    >
      <SpotlightCard
        className="flex h-full flex-col border-border bg-card p-7 dark:border-neutral-800 dark:bg-neutral-900/50"
        spotlightColor="rgba(255, 112, 3, 0.06)"
        spotlightRadius={220}
      >
        <div className="mb-5 flex items-center gap-3">
          <div
            className={`${V2_NUMBER_BADGE_CLASS} flex h-8 w-8 shrink-0 items-center justify-center rounded-full`}
          >
            <span className="font-mono text-[0.6rem] font-bold text-white">{point.number}</span>
          </div>
          <h3 className="hr-text-primary text-left text-sm leading-tight font-bold">
            {point.title}
          </h3>
          {point.comingSoon && (
            <span className="hr-v2-badge-accent ml-auto px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.08em] uppercase">
              Coming Soon
            </span>
          )}
        </div>
        <ul className="mt-auto space-y-3 border-t border-border/60 pt-4 text-left dark:border-neutral-800">
          {point.points.map((bullet) => (
            <li
              key={bullet}
              className="hr-text-secondary flex items-start gap-2.5 text-xs leading-relaxed"
            >
              <span
                className="hr-text-accent mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500"
                aria-hidden="true"
              />
              {bullet}
            </li>
          ))}
        </ul>
      </SpotlightCard>
    </motion.div>
  );
}

/** Five competitive differentiators explaining why Highrable is uniquely positioned, wrapped in Spotlight effect. */
export function V2UniqueSection() {
  return (
    <section
      id="why-highrable"
      className={`bg-white ${V2_SECTION_SPACING_CLASS} dark:bg-neutral-900/20`}
    >
      <div className={V2_PAGE_CONTAINER_CLASS}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl text-left"
        >
          <SectionLabel className="mb-4">Why Highrable</SectionLabel>
          <h2 className="hr-text-primary text-3xl leading-[1.15] font-medium md:text-4xl">
            Not just a blockchain layer on top
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
            Highrable combines smart contract escrow, portable on-chain reputation, and borderless
            stablecoin payments today, with AI hiring marked as coming soon.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {UNIQUE_POINTS.map((point, index) => (
            <UniquePointCard key={point.id} point={point} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
