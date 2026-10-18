"use client";

import { StatCard, type TStatTone } from "@/features/common";
import { motion } from "framer-motion";

import type { LucideIcon } from "lucide-react";

interface IIncomeMetricCardProps {
  readonly title: string;
  readonly value: string;
  readonly subtitle?: string;
  readonly icon: LucideIcon;
  readonly tone?: TStatTone;
  readonly animationDelay?: number;
}

export function IncomeMetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "orange",
  animationDelay = 0,
}: IIncomeMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
    >
      <StatCard label={title} value={value} description={subtitle} icon={icon} tone={tone} />
    </motion.div>
  );
}
