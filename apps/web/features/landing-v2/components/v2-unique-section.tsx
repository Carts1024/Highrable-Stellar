"use client";

import { motion } from "framer-motion";

import type { TUniquePoint } from "../types/landing-v2.types";

import { UNIQUE_POINTS } from "../constants/landing-v2.constants";
import { SectionLabel } from "./v2-section-label";

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
      className="border border-[#e8e8e8] bg-white p-7 transition-shadow hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.08)]"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-linear-to-br from-[#FF8801] to-[#E85D00]">
          <span className="font-mono text-[0.6rem] font-bold text-white">{point.number}</span>
        </div>
        <h3 className="leading-tight font-semibold text-[#0a0a0a]">{point.title}</h3>
      </div>
      <ul className="space-y-2.5">
        {point.points.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5 text-sm text-[#5f5f5f]">
            <span
              className="mt-1.5 inline-block h-1 w-1 shrink-0 bg-[#FF7003]"
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
    <section id="why-highrable" className="bg-white py-25">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
        >
          <SectionLabel className="mb-4">Why Highrable</SectionLabel>
          <h2 className="text-3xl leading-[1.15] font-medium text-[#0a0a0a] md:text-4xl">
            Not just a blockchain layer on top
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5f5f5f]">
            Highrable integrates AI hiring, smart contract escrow, portable on-chain reputation, and
            borderless stablecoin payments into one end-to-end platform - no competitor does all
            five.
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
