import { Briefcase, UserRound } from "lucide-react";

import type { TDashboardMode } from "@/features/dashboard/types";
import type { LucideIcon } from "lucide-react";

export type TAppMode = TDashboardMode;

export interface IModeCopy {
  /** Short name used in badges and the switch ("Freelancer"). */
  readonly shortLabel: string;
  /** Full label ("Freelancer mode"). */
  readonly label: string;
  /** One-line explanation of what the user can do in this mode. */
  readonly tagline: string;
  /** Colour name shown to users in helper text. */
  readonly colorName: string;
  readonly icon: LucideIcon;
}

export const MODE_COPY: Record<TAppMode, IModeCopy> = {
  freelancer: {
    shortLabel: "Freelancer",
    label: "Freelancer mode",
    tagline: "You are finding work and getting paid.",
    colorName: "orange",
    icon: UserRound,
  },
  client: {
    shortLabel: "Client",
    label: "Client mode",
    tagline: "You are hiring people and paying for work.",
    colorName: "yellow",
    icon: Briefcase,
  },
};

export interface IModeNavItem {
  readonly name: string;
  readonly href: string;
  readonly description: string;
}

/** Navigation shown for each mode. Pages that belong to the other mode are never listed. */
export const MODE_NAVIGATION: Record<TAppMode, readonly IModeNavItem[]> = {
  freelancer: [
    { name: "Find Work", href: "/jobs", description: "Browse open jobs and apply" },
    { name: "My Work", href: "/dashboard", description: "Your earnings and active jobs" },
    { name: "Disputes", href: "/disputes", description: "Problems you have raised or received" },
  ],
  client: [
    { name: "Post a Job", href: "/post-job", description: "Describe the work you need done" },
    { name: "My Jobs", href: "/dashboard", description: "Jobs you posted and their progress" },
    { name: "Find Freelancers", href: "/talent", description: "Look for people to hire" },
    { name: "Disputes", href: "/disputes", description: "Problems you have raised or received" },
  ],
};
