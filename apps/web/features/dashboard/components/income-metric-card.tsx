"use client";

import { cn } from "@repo/ui/lib/utils";
import { motion } from "framer-motion";

import type { LucideIcon } from "lucide-react";

type IIncomeMetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName?: string;
  animationDelay?: number;
};

export function IncomeMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  animationDelay = 0,
}: IIncomeMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      className="hr-panel p-6 shadow-none"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-3">
          <p className="hr-text-secondary text-sm font-medium">{title}</p>
          <p className="hr-text-primary mt-1 truncate text-2xl font-bold">{value}</p>
          {subtitle ? <p className="hr-text-muted mt-1 text-xs">{subtitle}</p> : null}
        </div>
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background",
            iconClassName,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
}
