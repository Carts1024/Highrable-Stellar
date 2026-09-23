"use client";

import { motion } from "framer-motion";

import type { LucideIcon } from "lucide-react";

interface IIncomeMetricCardProps {
  readonly title: string;
  readonly value: string;
  readonly subtitle?: string;
  readonly icon: LucideIcon;
  readonly animationDelay?: number;
}

export function IncomeMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  animationDelay = 0,
}: IIncomeMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      className="rounded-xl border border-border bg-card p-5 shadow-none transition-all duration-200 hover:border-highrable-orange-3/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-3">
          <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground/80 uppercase">
            {title}
          </p>
          <p className="hr-text-primary mt-2 truncate font-sans text-2xl leading-none font-bold tracking-tight">
            {value}
          </p>
          {subtitle ? (
            <p className="hr-text-secondary mt-2 font-sans text-xs leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-highrable-orange-2/10 text-highrable-orange-2">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
