"use client";

import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_BADGE_ACCENT_CLASS,
  V2_BADGE_SOLID_CLASS,
  V2_PAGE_CONTAINER_CLASS,
  V2_PANEL_INTERACTIVE_CLASS,
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
      className={`${V2_PANEL_INTERACTIVE_CLASS} p-7 hover:border-ring/30`}
    >
      <RoleBadge role={segment.role} />
      <h3 className="hr-text-primary mt-4 mb-2 text-lg font-semibold">{segment.title}</h3>
      <p className="hr-text-secondary mb-5 text-sm leading-relaxed">{segment.description}</p>
      <ul className="space-y-2">
        {segment.needs.map((need) => (
          <li key={need} className="hr-text-secondary flex items-start gap-2.5 text-sm">
            <span
              className="hr-text-accent mt-1.5 inline-block h-1 w-1 shrink-0 bg-current"
              aria-hidden="true"
            />
            {need}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/** Three target user segments with their specific pain points and needs. */
export function V2TargetMarketSection() {
  return (
    <section className={`bg-white ${V2_SECTION_SPACING_CLASS}`}>
      <div className={V2_PAGE_CONTAINER_CLASS}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TARGET_SEGMENTS.map((segment, index) => (
            <SegmentCard key={segment.id} segment={segment} index={index} />
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="hr-text-muted mt-8 font-mono text-xs tracking-[0.06em] uppercase"
        >
          Phase 1: Philippines | Phase 2: Southeast Asia (Singapore, Vietnam, Malaysia, Indonesia)
        </motion.p>
      </div>
    </section>
  );
}
