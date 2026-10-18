import {
  Activity,
  Award,
  BadgeCheck,
  Briefcase,
  CircleDollarSign,
  Clock,
  FileText,
  Layers,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";

import type { TStatTone } from "./stat-card";
import type { LucideIcon } from "lucide-react";

const STAT_STYLES: readonly { readonly tone: TStatTone; readonly Icon: LucideIcon }[] = [
  { tone: "orange", Icon: Briefcase },
  { tone: "yellow", Icon: Layers },
  { tone: "green", Icon: CircleDollarSign },
  { tone: "sky", Icon: Wallet },
  { tone: "violet", Icon: Star },
  { tone: "rose", Icon: ShieldCheck },
  { tone: "orange", Icon: Activity },
  { tone: "yellow", Icon: Clock },
  { tone: "green", Icon: BadgeCheck },
  { tone: "sky", Icon: FileText },
  { tone: "violet", Icon: Award },
];

/** Gives each summary card in a group its own pastel tone and icon, repeating after the list ends. */
export function getStatStyle(index: number) {
  return STAT_STYLES[index % STAT_STYLES.length]!;
}
