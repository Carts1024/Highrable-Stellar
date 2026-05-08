"use client";

import { motion } from "framer-motion";

import type { TProblemItem } from "../types/landing-v2.types";

import { PROBLEMS } from "../constants/landing-v2.constants";
import { SectionLabel } from "./v2-section-label";

interface IProblemCardProps {
  readonly problem: TProblemItem;
  readonly index: number;
}

function ProblemCard({ problem, index }: IProblemCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="border border-[#e8e8e8] bg-white p-6 transition-shadow hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.08)]"
    >
      <span className="font-mono text-xs text-[#7f7f7f]">{problem.number}</span>
      <h3 className="mt-3 mb-2 text-base font-semibold text-[#0a0a0a]">{problem.title}</h3>
      <p className="mb-4 text-sm leading-relaxed text-[#5f5f5f]">{problem.description}</p>
      <div className="border-t border-[#f5f5f5] pt-4">
        <p className="text-2xl font-semibold text-[#FF7003]">{problem.stat}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[#7f7f7f]">{problem.statSource}</p>
      </div>
    </motion.div>
  );
}

/** Grid of real-world problems that Highrable solves, backed by statistics. */
export function V2ProblemsSection() {
  return (
    <section className="bg-[#f5f5f5] py-25">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
        >
          <SectionLabel className="mb-4">The Problem</SectionLabel>
          <h2 className="text-3xl leading-[1.15] font-medium text-[#0a0a0a] md:text-4xl">
            The broken mechanics of freelancing
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5f5f5f]">
            Traditional platforms have failed both sides of the marketplace. These are the systemic
            problems Highrable is built to fix.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PROBLEMS.map((problem, index) => (
            <ProblemCard key={problem.id} problem={problem} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
