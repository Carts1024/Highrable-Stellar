"use client";

import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_NUMBER_BADGE_CLASS,
  V2_PAGE_CONTAINER_CLASS,
  V2_PANEL_INTERACTIVE_CLASS,
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
      className={`${V2_PANEL_INTERACTIVE_CLASS} p-7 hover:border-ring/30`}
    >
      <div className="mb-5 flex items-center gap-3">
        <div
          className={`${V2_NUMBER_BADGE_CLASS} flex h-8 w-8 shrink-0 items-center justify-center`}
        >
          <span className="font-mono text-[0.6rem] font-bold text-white">{point.number}</span>
        </div>
        <h3 className="hr-text-primary leading-tight font-semibold">{point.title}</h3>
        {point.comingSoon && (
          <span className="hr-v2-badge-accent ml-auto px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.08em] uppercase">
            Coming Soon
          </span>
        )}
      </div>
      <ul className="space-y-2.5">
        {point.points.map((bullet) => (
          <li key={bullet} className="hr-text-secondary flex items-start gap-2.5 text-sm">
            <span
              className="hr-text-accent mt-1.5 inline-block h-1 w-1 shrink-0 bg-current"
              aria-hidden="true"
            />
            {bullet}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/** Five competitive differentiators explaining why Highrable is uniquely positioned. */
export function V2UniqueSection() {
  return (
    <section id="why-highrable" className={`bg-white ${V2_SECTION_SPACING_CLASS}`}>
      <div className={V2_PAGE_CONTAINER_CLASS}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {UNIQUE_POINTS.map((point, index) => (
            <UniquePointCard key={point.id} point={point} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
