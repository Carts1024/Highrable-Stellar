"use client";

import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
  V2_SURFACE_MUTED_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion } from "framer-motion";

import type { TProblemItem } from "../types/landing-v2.types";

import { PROBLEMS } from "../constants/landing-v2.constants";
import { SpotlightCard } from "@repo/ui/components/highrable/spotlight-card";

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
      className="h-full"
    >
      <SpotlightCard
        className="h-full border-border bg-card p-6 dark:border-neutral-800 dark:bg-neutral-900/50"
        spotlightColor="rgba(255, 112, 3, 0.08)"
        spotlightRadius={200}
      >
        <span className="hr-text-muted font-mono text-xs">{problem.number}</span>
        <h3 className="hr-text-primary mt-3 mb-2 text-base font-semibold">{problem.title}</h3>
        <p className="hr-text-secondary mb-4 text-sm leading-relaxed">{problem.description}</p>
        <div className="border-t border-border/70 pt-4 dark:border-neutral-800">
          <p className="hr-text-accent text-2xl font-bold tracking-tight">{problem.stat}</p>
          <p className="hr-text-muted mt-0.5 text-xs leading-relaxed">{problem.statSource}</p>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

/** Grid of real-world problems that Highrable solves, backed by statistics and spotlight effects. */
export function V2ProblemsSection() {
  return (
    <section
      className={`${V2_SURFACE_MUTED_CLASS} ${V2_SECTION_SPACING_CLASS} dark:bg-neutral-950/20`}
    >
      <div className={V2_PAGE_CONTAINER_CLASS}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl text-left"
        >
          <SectionLabel className="mb-4">The Problem</SectionLabel>
          <h2 className="hr-text-primary text-3xl leading-[1.15] font-medium md:text-4xl">
            The broken mechanics of freelancing
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
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
