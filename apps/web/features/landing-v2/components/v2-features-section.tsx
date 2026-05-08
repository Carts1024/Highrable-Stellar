"use client";

import { motion } from "framer-motion";

import type { TFeatureItem } from "../types/landing-v2.types";

import { FEATURES } from "../constants/landing-v2.constants";
import { SectionLabel } from "./v2-section-label";

const FEATURE_NUMBERS = ["01", "02", "03", "04", "05", "06"] as const;

interface IFeatureCardProps {
  readonly feature: TFeatureItem;
  readonly number: string;
  readonly index: number;
}

function FeatureCard({ feature, number, index }: IFeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      className="group border border-[#e8e8e8] bg-white p-6 transition-all hover:border-[#FF7003]/40 hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.08)]"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center bg-linear-to-br from-[#FF8801] to-[#E85D00]">
          <span className="font-mono text-[0.6rem] font-bold text-white">{number}</span>
        </div>
      </div>
      <h3 className="mb-2 font-semibold text-[#0a0a0a]">{feature.title}</h3>
      <p className="mb-4 text-sm leading-relaxed text-[#5f5f5f]">{feature.description}</p>
      <div className="border-t border-[#f5f5f5] pt-3">
        <p className="text-xs leading-relaxed text-[#B94A00]">
          <span className="mr-1 font-mono tracking-wider uppercase">Impact -</span>
          {feature.businessValue}
        </p>
      </div>
    </motion.div>
  );
}

/** Six-feature grid highlighting Highrable's core platform capabilities. */
export function V2FeaturesSection() {
  return (
    <section id="features" className="bg-white py-25">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
        >
          <SectionLabel className="mb-4">Key Features</SectionLabel>
          <h2 className="text-3xl leading-[1.15] font-medium text-[#0a0a0a] md:text-4xl">
            Everything you need in one trusted platform
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5f5f5f]">
            Highrable integrates AI hiring, blockchain escrow, and portable reputation into a single
            seamless workflow - for both freelancers and clients.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              number={FEATURE_NUMBERS[index] ?? "01"}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
