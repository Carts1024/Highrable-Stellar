"use client";

import { motion } from "framer-motion";

import type { TWorkflowStep } from "../types/landing-v2.types";

import { CLIENT_STEPS, FREELANCER_STEPS } from "../constants/landing-v2.constants";
import { SectionLabel } from "./v2-section-label";

interface IWorkflowColumnProps {
  readonly label: string;
  readonly roleTag: string;
  readonly steps: readonly TWorkflowStep[];
  readonly delay?: number;
}

interface IWorkflowStepRowProps {
  readonly step: TWorkflowStep;
  readonly index: number;
  readonly baseDelay: number;
}

function WorkflowStepRow({ step, index, baseDelay }: IWorkflowStepRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: baseDelay + index * 0.07 }}
      className="flex items-start gap-4"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#FF7003] bg-white">
        <span className="font-mono text-xs font-bold text-[#FF7003]">
          {String(step.step).padStart(2, "0")}
        </span>
      </div>
      <div className="pt-0.5">
        <h4 className="font-semibold text-[#0a0a0a]">{step.title}</h4>
        <p className="mt-0.5 text-sm leading-relaxed text-[#5f5f5f]">{step.description}</p>
      </div>
    </motion.div>
  );
}

function WorkflowColumn({ label, roleTag, steps, delay = 0 }: IWorkflowColumnProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
    >
      <div className="mb-8">
        <div className="mb-1 inline-flex items-center gap-2 bg-[#fff7ed] px-3 py-1">
          <span className="font-mono text-[0.65rem] tracking-[0.08em] text-[#B94A00] uppercase">
            {roleTag}
          </span>
        </div>
        <h3 className="mt-3 text-xl font-semibold text-[#0a0a0a]">{label}</h3>
      </div>

      <div className="space-y-6">
        {steps.map((step, index) => (
          <WorkflowStepRow key={step.step} step={step} index={index} baseDelay={delay} />
        ))}
      </div>
    </motion.div>
  );
}

/** Side-by-side freelancer and client workflow journeys. */
export function V2HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-[#f5f5f5] py-25">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
        >
          <SectionLabel className="mb-4">How It Works</SectionLabel>
          <h2 className="text-3xl leading-[1.15] font-medium text-[#0a0a0a] md:text-4xl">
            From first match to final payment
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5f5f5f]">
            Every step in the Highrable workflow is backed by blockchain verification - no
            middlemen, no guesswork, no disputes.
          </p>
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <WorkflowColumn
            label="For Freelancers"
            roleTag="Freelancer Journey"
            steps={FREELANCER_STEPS}
            delay={0.1}
          />
          <WorkflowColumn
            label="For Clients"
            roleTag="Client Journey"
            steps={CLIENT_STEPS}
            delay={0.2}
          />
        </div>
      </div>
    </section>
  );
}
