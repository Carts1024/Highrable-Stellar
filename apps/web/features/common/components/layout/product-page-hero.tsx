"use client";

import { SectionLabel } from "@/features/landing-v2/components/v2-section-label";
import { motion } from "framer-motion";

import type { ReactNode } from "react";

interface IProductPageHeroProps {
  readonly label: string;
  readonly title: ReactNode;
  readonly description: string;
  readonly actions?: ReactNode;
  readonly className?: string;
}

/** Reusable v2-inspired page hero for product routes. */
export function ProductPageHero({
  label,
  title,
  description,
  actions,
  className,
}: IProductPageHeroProps) {
  return (
    <section className={className}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="max-w-3xl space-y-4"
      >
        <SectionLabel>{label}</SectionLabel>
        <h1 className="text-4xl leading-tight font-medium text-[#0a0a0a] sm:text-5xl">{title}</h1>
        <p className="text-base leading-relaxed text-[#5f5f5f] sm:text-lg">{description}</p>
        {actions ? <div className="flex flex-wrap items-center gap-3 pt-2">{actions}</div> : null}
      </motion.div>
    </section>
  );
}
