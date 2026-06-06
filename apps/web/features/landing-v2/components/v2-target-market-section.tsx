"use client";

import { SpotlightCard } from "@repo/ui/components/highrable/spotlight-card";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_BADGE_ACCENT_CLASS,
  V2_BADGE_SOLID_CLASS,
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion } from "framer-motion";

import type { TTargetSegment } from "../types/landing-v2.types";

import { TARGET_SEGMENTS } from "../constants/landing-v2.constants";

interface ISegmentCardProps {
  readonly segment: TTargetSegment;
  readonly index: number;
}

function RoleBadge({ role }: { readonly role: TTargetSegment["role"] }) {
  const isClient = role === "Client";
  return (
    <span
      className={`inline-block px-2.5 py-0.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase ${isClient ? V2_BADGE_SOLID_CLASS : V2_BADGE_ACCENT_CLASS}`}
    >
      {role}
    </span>
  );
}

function SegmentCard({ segment, index }: ISegmentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="animate-fade-in h-full"
    >
      <SpotlightCard
        className="flex h-full flex-col justify-between border-border bg-card p-7 dark:border-neutral-800 dark:bg-neutral-900/50"
        spotlightColor="rgba(255, 112, 3, 0.08)"
        spotlightRadius={200}
      >
        <div>
          <div className="text-left">
            <RoleBadge role={segment.role} />
          </div>
          <h3 className="hr-text-primary mt-4 mb-2 text-left text-base font-bold">
            {segment.title}
          </h3>
          <p className="hr-text-secondary mb-5 text-left text-xs leading-relaxed">
            {segment.description}
          </p>
        </div>
        <ul className="mt-auto space-y-2.5 border-t border-border/60 pt-4 text-left dark:border-neutral-800">
          {segment.needs.map((need) => (
            <li key={need} className="hr-text-secondary flex items-start gap-2.5 text-xs">
              <span
                className="hr-text-accent mt-1.5 inline-block h-1 w-1 shrink-0 bg-current"
                aria-hidden="true"
              />
              {need}
            </li>
          ))}
        </ul>
      </SpotlightCard>
    </motion.div>
  );
}

/** Three target user segments with their specific pain points and needs, wrapped in Spotlight effects. */
export function V2TargetMarketSection() {
  return (
    <section className={`bg-white ${V2_SECTION_SPACING_CLASS} dark:bg-neutral-900/20`}>
      <div className={V2_PAGE_CONTAINER_CLASS}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl text-left"
        >
          <SectionLabel className="mb-4">Who It's For</SectionLabel>
          <h2 className="hr-text-primary text-3xl leading-[1.15] font-medium md:text-4xl">
            Built for the people platforms forget
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
            Starting with the Philippines - the fastest-growing freelancing country by revenue - and
            expanding across Southeast Asia.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TARGET_SEGMENTS.map((segment, index) => (
            <SegmentCard key={segment.id} segment={segment} index={index} />
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="hr-text-muted mt-8 text-left font-mono text-[0.65rem] tracking-[0.06em] uppercase"
        >
          Phase 1: Philippines | Phase 2: Southeast Asia (Singapore, Vietnam, Malaysia, Indonesia)
        </motion.p>
      </div>
    </section>
  );
}
