"use client";

import {
  HighrableV2NumberBadge,
  HighrableV2PageContainer,
  HighrableV2Panel,
  HighrableV2Section,
  SectionLabel,
} from "@repo/ui/components/highrable/v2-marketing";
import { motion } from "framer-motion";

import type { TFeatureItem } from "../types/landing-v2.types";

import { FEATURES } from "../constants/landing-v2.constants";

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
      className="group"
    >
      <HighrableV2Panel interactive className="h-full p-6 transition-all hover:border-ring/30">
        <div className="mb-4 flex items-start justify-between">
          <HighrableV2NumberBadge className="h-9 w-9">
            <span className="font-mono text-[0.6rem] font-bold text-white">{number}</span>
          </HighrableV2NumberBadge>
        </div>
        <h3 className="hr-text-primary mb-2 font-semibold">{feature.title}</h3>
        <p className="hr-text-secondary mb-4 text-sm leading-relaxed">{feature.description}</p>
        <div className="border-t border-border/70 pt-3">
          <p className="hr-text-accent text-xs leading-relaxed">
            <span className="mr-1 font-mono tracking-wider uppercase">Impact -</span>
            {feature.businessValue}
          </p>
        </div>
      </HighrableV2Panel>
    </motion.div>
  );
}

/** Six-feature grid highlighting Highrable's core platform capabilities. */
export function V2FeaturesSection() {
  return (
    <HighrableV2Section id="features">
      <HighrableV2PageContainer>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
        >
          <SectionLabel className="mb-4">Key Features</SectionLabel>
          <h2 className="hr-text-primary text-3xl leading-[1.15] font-medium md:text-4xl">
            Everything you need in one trusted platform
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
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
      </HighrableV2PageContainer>
    </HighrableV2Section>
  );
}
