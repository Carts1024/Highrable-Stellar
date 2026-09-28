"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Lock, ShieldCheck, Wallet } from "lucide-react";

import {
  EDITORIAL_CONTAINER_CLASS,
  EDITORIAL_SECTION_CLASS,
  EditorialSectionLabel,
} from "./editorial-layout";
import { V2Reveal } from "./v2-animated-elements";

const AUDIENCES = [
  {
    icon: Wallet,
    title: "Freelancers",
    description: "See the funds before you start.",
    detail: "The client’s payment is locked in before work begins, so you know it’s secured.",
    fromX: -20,
  },
  {
    icon: ShieldCheck,
    title: "Clients",
    description: "Approve the work before you pay.",
    detail: "Your payment stays on hold until you review the deliverable and approve it.",
    fromX: 20,
  },
] as const;

/** Shows the two sides of a project and the simple promise each one needs. */
export function V2TargetMarketSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className={`${EDITORIAL_SECTION_CLASS} text-center`}>
      <motion.div
        aria-hidden="true"
        className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-linear-to-br from-[#FF8703] to-[#FE6002] opacity-20 blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, 26, 0], y: [0, -18, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-linear-to-br from-highrable-orange-3 to-[#FF8703] opacity-20 blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, -22, 0], y: [0, 16, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className={`${EDITORIAL_CONTAINER_CLASS} relative z-10 max-w-5xl`}>
        <div className="mx-auto mb-12 max-w-2xl">
          <EditorialSectionLabel>Who it’s for</EditorialSectionLabel>
          <V2Reveal
            as="h2"
            delay={0.08}
            className="hr-text-primary text-2xl leading-[1.15] font-bold tracking-tight sm:text-3xl md:text-4xl"
          >
            Built for both sides of the work.
          </V2Reveal>
          <V2Reveal
            as="p"
            delay={0.16}
            className="hr-text-secondary mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base"
          >
            Clear expectations and payment protections for clients and freelancers.
          </V2Reveal>
        </div>

        <div className="relative grid gap-6 text-left md:grid-cols-2">
          <motion.span
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 z-10 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-highrable-orange-1 shadow-sm md:flex"
            animate={shouldReduceMotion ? undefined : { scale: [1, 1.15, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Lock className="h-5 w-5" aria-hidden="true" />
          </motion.span>

          {AUDIENCES.map(({ icon: Icon, title, description, detail, fromX }, index) => (
            <V2Reveal
              as="article"
              key={title}
              x={fromX}
              y={12}
              scale={0.98}
              lift
              delay={0.24 + index * 0.1}
              className="rounded-xl border border-border bg-card p-7 transition-shadow hover:shadow-lg sm:p-9"
            >
              <motion.span
                whileHover={shouldReduceMotion ? undefined : { scale: 1.1, rotate: 4 }}
                className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-highrable-surface-accent text-highrable-orange-1"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </motion.span>
              <p className="hr-text-accent mb-2 font-mono text-[0.6rem] font-semibold tracking-[0.1em] uppercase">
                {title}
              </p>
              <h3 className="hr-text-primary max-w-sm text-lg leading-snug font-semibold sm:text-xl">
                {description}
              </h3>
              <p className="hr-text-secondary mt-3 max-w-sm text-sm leading-relaxed">{detail}</p>
            </V2Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
