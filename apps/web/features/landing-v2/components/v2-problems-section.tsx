"use client";

import { SpotlightCard } from "@repo/ui/components/highrable/spotlight-card";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
  V2_SURFACE_MUTED_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useInView } from "framer-motion";
import { useEffect, useRef } from "react";

import type { TProblemItem } from "../types/landing-v2.types";

import { PROBLEMS } from "../constants/landing-v2.constants";

/** Animated counter that counts up when it enters the viewport */
function AnimatedStat({ stat }: { stat: string }) {
  // Extract numeric portion and suffix (%, days, etc.)
  const match = stat.match(/^([\d.]+)(.*)$/);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const count = useMotionValue(0);

  useEffect(() => {
    if (!isInView || !match) return;
    const target = parseFloat(match[1]!);
    const controls = animate(count, target, {
      duration: 1.6,
      ease: "easeOut",
    });
    return controls.stop;
  }, [isInView, count, match]);

  if (!match) {
    return <span ref={ref}>{stat}</span>;
  }

  const suffix = match[2];
  const isDecimal = match[1]!.includes(".");

  return (
    <span ref={ref} className="tabular-nums">
      <motion.span>
        {useTransform(count, (v) => (isDecimal ? v.toFixed(2) : Math.round(v).toString()))}
      </motion.span>
      {suffix}
    </span>
  );
}

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
          <p className="hr-text-accent text-2xl font-bold tracking-tight">
            <AnimatedStat stat={problem.stat} />
          </p>
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
            Freelancing is broken — for both sides
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
            Traditional platforms profit from the problem instead of solving it. Here's what
            freelancers and clients deal with every day.
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
