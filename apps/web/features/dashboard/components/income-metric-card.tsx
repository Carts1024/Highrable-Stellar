"use client";

import { motion } from "framer-motion";

import type { LucideIcon } from "lucide-react";

type IIncomeMetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  colorClass: string;
  bgColorClass: string;
  animationDelay?: number;
};

export function IncomeMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass,
  bgColorClass,
  animationDelay = 0,
}: IIncomeMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      className={`rounded-2xl border border-gray-100 bg-linear-to-br ${bgColorClass} p-6`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-3">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-1 truncate text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${colorClass}`}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
}
