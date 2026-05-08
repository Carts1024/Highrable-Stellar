"use client";

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
    <div className="mb-10 flex w-fit gap-1 border border-[#e8e8e8] bg-[#f5f5f5] p-1">
      {categories.map((category, index) => (
        <button
          key={category.label}
          onClick={() => onSelect(index)}
          className={`px-5 py-2 font-mono text-xs tracking-[0.06em] uppercase transition-colors ${
            activeIndex === index
              ? "bg-[#0a0a0a] text-white"
              : "text-[#5f5f5f] hover:text-[#0a0a0a]"
          }`}
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
      className={`relative border bg-white p-7 transition-shadow hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.08)] ${
        tier.highlighted ? "border-[#FF7003]" : "border-[#e8e8e8]"
      }`}
    >
      {tier.highlighted && (
        <div className="absolute -top-px right-0 left-0 h-0.5 bg-linear-to-r from-[#FF8801] via-[#FF7003] to-[#E85D00]" />
      )}
      {tier.highlighted && (
        <div className="mb-4">
          <span className="bg-linear-to-r from-[#FF8801] to-[#E85D00] px-2.5 py-0.5 font-mono text-[0.6rem] tracking-[0.08em] text-white uppercase">
            Most Popular
          </span>
        </div>
      )}
      <h3 className="text-lg font-semibold text-[#0a0a0a]">{tier.name}</h3>
      <div className="mt-2 flex items-baseline gap-0.5">
        <span className="text-3xl font-semibold text-[#0a0a0a]">{tier.price}</span>
        {tier.period && <span className="font-mono text-xs text-[#7f7f7f]">{tier.period}</span>}
      </div>
      <p className="mt-1 text-sm text-[#7f7f7f]">{tier.description}</p>

      <ul className="my-6 space-y-3">
        {tier.features.map((feature) => (
          <li key={feature.label} className="flex items-center gap-2.5 text-sm">
            {feature.included ? (
              <span className="inline-block h-1 w-1 shrink-0 bg-[#FF7003]" aria-hidden="true" />
            ) : (
              <span className="inline-block h-1 w-1 shrink-0 bg-[#e8e8e8]" aria-hidden="true" />
            )}
            <span
              className={
                feature.included
                  ? "text-[#0a0a0a]"
                  : "text-[#7f7f7f] line-through decoration-[#e8e8e8]"
              }
            >
              {feature.label}
            </span>
          </li>
        ))}
      </ul>

      <button
        className={`w-full py-2.5 font-mono text-xs tracking-widest uppercase transition-colors ${
          tier.highlighted
            ? "bg-linear-to-br from-[#FF8801] via-[#FF7003] to-[#E85D00] text-white hover:brightness-105"
            : "border border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white"
        }`}
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
    <section id="pricing" className="bg-[#f5f5f5] py-25">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
        >
          <SectionLabel className="mb-4">Pricing</SectionLabel>
          <h2 className="text-3xl leading-[1.15] font-medium text-[#0a0a0a] md:text-4xl">
            Fair pricing. No hidden commissions.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5f5f5f]">
            A flat <strong className="font-semibold text-[#FF7003]">5% escrow fee</strong> on funded
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
          className="mt-8 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase"
        >
          Pay-per-use | AI Interview Credits $5/5-pack | Job Boost $10/week | Profile Boost $5/week
        </motion.p>
      </div>
    </section>
  );
}
