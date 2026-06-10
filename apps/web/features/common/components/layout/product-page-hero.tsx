"use client";

import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { cn } from "@repo/ui/lib/utils";
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
    <section className={cn("max-w-4xl", className)}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="max-w-3xl space-y-4"
      >
        <SectionLabel>{label}</SectionLabel>
        <h1 className="hr-text-primary font-sans text-3xl leading-tight font-bold sm:text-4xl">
          {title}
        </h1>
        <p className="hr-text-secondary max-w-xl text-sm leading-relaxed sm:text-base">
          {description}
        </p>
        {actions ? <div className="flex flex-wrap items-center gap-3 pt-2">{actions}</div> : null}
      </motion.div>
    </section>
  );
}
