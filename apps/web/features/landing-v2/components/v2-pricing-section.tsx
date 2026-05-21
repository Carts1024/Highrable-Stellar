"use client";

import {
  V2_BUTTON_PRIMARY_CLASS,
  V2_BUTTON_SECONDARY_CLASS,
  V2_PAGE_CONTAINER_CLASS,
  V2_PANEL_CLASS,
  V2_PANEL_INTERACTIVE_CLASS,
  V2_SECTION_SPACING_CLASS,
  V2_SURFACE_MUTED_CLASS,
} from "@/features/common/lib/v2-theme";
import { cn } from "@repo/ui/lib/utils";
import { motion } from "framer-motion";
import { useState } from "react";

import type { TPricingCategory, TPricingTier } from "../types/landing-v2.types";

import { PRICING_CATEGORIES } from "../constants/landing-v2.constants";
import { SectionLabel } from "./v2-section-label";

interface IPricingCardProps {
  readonly tier: TPricingTier;
  readonly index: number;
}

interface ICategoryTabsProps {
  readonly categories: readonly TPricingCategory[];
  readonly activeIndex: number;
  readonly onSelect: (index: number) => void;
}

function CategoryTabs({ categories, activeIndex, onSelect }: ICategoryTabsProps) {
  return (
    <div className={`${V2_PANEL_CLASS} ${V2_SURFACE_MUTED_CLASS} mb-10 flex w-fit gap-1 p-1`}>
      {categories.map((category, index) => (
        <button
          key={category.label}
          onClick={() => onSelect(index)}
          className={cn(
            "px-5 py-2 font-mono text-xs tracking-[0.06em] uppercase transition-colors",
            activeIndex === index ? "hr-v2-badge-solid" : "hr-text-secondary hover:hr-text-primary",
          )}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}

function PricingCard({ tier, index }: IPricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={cn(
        V2_PANEL_INTERACTIVE_CLASS,
        "relative p-7",
        tier.highlighted ? "border-ring" : undefined,
      )}
    >
      {tier.highlighted && (
        <div className="hr-gradient-primary absolute -top-px right-0 left-0 h-0.5" />
      )}
      {tier.highlighted && (
        <div className="mb-4">
          <span className="hr-v2-number-badge px-2.5 py-0.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase">
            Most Popular
          </span>
        </div>
      )}
      <h3 className="hr-text-primary text-lg font-semibold">{tier.name}</h3>
      <div className="mt-2 flex items-baseline gap-0.5">
        <span className="hr-text-primary text-3xl font-semibold">{tier.price}</span>
        {tier.period && <span className="hr-text-muted font-mono text-xs">{tier.period}</span>}
      </div>
      <p className="hr-text-muted mt-1 text-sm">{tier.description}</p>

      <ul className="my-6 space-y-3">
        {tier.features.map((feature) => (
          <li key={feature.label} className="flex items-center gap-2.5 text-sm">
            {feature.included ? (
              <span
                className="hr-text-accent inline-block h-1 w-1 shrink-0 bg-current"
                aria-hidden="true"
              />
            ) : (
              <span className="inline-block h-1 w-1 shrink-0 bg-border" aria-hidden="true" />
            )}
            <span
              className={
                feature.included
                  ? "hr-text-primary"
                  : "hr-text-muted line-through decoration-border"
              }
            >
              {feature.label}
            </span>
          </li>
        ))}
      </ul>

      <button
        className={cn(
          "w-full py-2.5 font-mono text-xs tracking-widest uppercase",
          tier.highlighted ? V2_BUTTON_PRIMARY_CLASS : V2_BUTTON_SECONDARY_CLASS,
        )}
      >
        {tier.ctaLabel}
      </button>
    </motion.div>
  );
}

/** Tabbed pricing section for freelancer and client subscription tiers. */
export function V2PricingSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCategory = PRICING_CATEGORIES[activeIndex];

  return (
    <section id="pricing" className={`${V2_SURFACE_MUTED_CLASS} ${V2_SECTION_SPACING_CLASS}`}>
      <div className={V2_PAGE_CONTAINER_CLASS}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
        >
          <SectionLabel className="mb-4">Pricing</SectionLabel>
          <h2 className="hr-text-primary text-3xl leading-[1.15] font-medium md:text-4xl">
            Fair pricing. No hidden commissions.
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
            A flat <strong className="hr-text-accent font-semibold">5% escrow fee</strong> on funded
            contracts - vs the 10-20% industry standard. Freelancers keep 100% of their negotiated
            rate.
          </p>
        </motion.div>

        <CategoryTabs
          categories={PRICING_CATEGORIES}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
        />

        {activeCategory && (
          <div
            className={`grid grid-cols-1 gap-4 ${
              activeCategory.tiers.length === 2 ? "max-w-2xl md:grid-cols-2" : "md:grid-cols-3"
            }`}
          >
            {activeCategory.tiers.map((tier, index) => (
              <PricingCard key={tier.id} tier={tier} index={index} />
            ))}
          </div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="hr-text-muted mt-8 font-mono text-xs tracking-[0.06em] uppercase"
        >
          Pay-per-use | AI Interview Credits $5/5-pack | Job Boost $10/week | Profile Boost $5/week
        </motion.p>
      </div>
    </section>
  );
}
