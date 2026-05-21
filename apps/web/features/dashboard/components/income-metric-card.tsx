"use client";

import { cn } from "@repo/ui/lib/utils";
import { motion } from "framer-motion";

import type { LucideIcon } from "lucide-react";

interface IIncomeMetricCardProps {
  readonly title: string;
  readonly value: string;
  readonly subtitle?: string;
  readonly icon: LucideIcon;
  readonly iconClassName?: string;
  readonly animationDelay?: number;
}

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
      className="border border-[#e8e8e8] bg-white p-5"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-3">
          <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">{title}</p>
          <p className="mt-2 truncate text-2xl leading-none font-semibold text-[#0a0a0a]">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-2 text-xs leading-relaxed text-[#5f5f5f]">{subtitle}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center border border-[#e8e8e8] bg-white",
            iconClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
