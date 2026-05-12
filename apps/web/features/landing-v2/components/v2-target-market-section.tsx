"use client";

import { motion } from "framer-motion";

import type { TTargetSegment } from "../types/landing-v2.types";

import { TARGET_SEGMENTS } from "../constants/landing-v2.constants";
import { SectionLabel } from "./v2-section-label";

interface ISegmentCardProps {
  readonly segment: TTargetSegment;
  readonly index: number;
}

function RoleBadge({ role }: { readonly role: TTargetSegment["role"] }) {
  const isClient = role === "Client";
  return (
    <span
      className={`inline-block px-2.5 py-0.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase ${
        isClient
          ? "bg-[#0a0a0a] text-white"
          : "border border-[#FF7003]/40 bg-[#fff7ed] text-[#B94A00]"
      }`}
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
      className="border border-[#e8e8e8] bg-white p-7 transition-shadow hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.08)]"
    >
      <RoleBadge role={segment.role} />
      <h3 className="mt-4 mb-2 text-lg font-semibold text-[#0a0a0a]">{segment.title}</h3>
      <p className="mb-5 text-sm leading-relaxed text-[#5f5f5f]">{segment.description}</p>
      <ul className="space-y-2">
        {segment.needs.map((need) => (
          <li key={need} className="flex items-start gap-2.5 text-sm text-[#5f5f5f]">
            <span
              className="mt-1.5 inline-block h-1 w-1 shrink-0 bg-[#FF7003]"
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
    <section className="bg-white py-25">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
        >
          <SectionLabel className="mb-4">Who It's For</SectionLabel>
          <h2 className="text-3xl leading-[1.15] font-medium text-[#0a0a0a] md:text-4xl">
            Built for the people platforms forget
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5f5f5f]">
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
          className="mt-8 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase"
        >
          Phase 1: Philippines | Phase 2: Southeast Asia (Singapore, Vietnam, Malaysia, Indonesia)
        </motion.p>
      </div>
    </section>
  );
}
