"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import {
  EDITORIAL_CONTAINER_CLASS,
  EDITORIAL_SECTION_CLASS,
  EditorialSectionLabel,
} from "./editorial-layout";
import { V2Reveal } from "./v2-animated-elements";

const WORKFLOW_STEPS = [
  {
    title: "Fund",
    icon: "$",
    description: "Client deposits payment before work begins.",
  },
  {
    title: "Work",
    icon: "</>",
    description: "Freelancer starts on the agreed work.",
  },
  {
    title: "Approve",
    icon: "✓",
    description: "Client reviews the deliverable before paying.",
  },
  {
    title: "Pay",
    icon: "→",
    description: "Approval releases that milestone’s payment.",
  },
  {
    title: "Record",
    icon: "◉",
    description: "The job joins the freelancer’s history.",
  },
] as const;

/** Shows the five project steps, highlighting each one in turn. */
export function V2HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveStep((currentStep) => (currentStep + 1) % WORKFLOW_STEPS.length);
    }, 1800);

    return () => window.clearInterval(intervalId);
  }, [shouldReduceMotion]);

  return (
    <section id="how-it-works" className={`${EDITORIAL_SECTION_CLASS} text-center`}>
      <div className={`${EDITORIAL_CONTAINER_CLASS} max-w-6xl`}>
        <div className="mx-auto mb-12 max-w-2xl">
          <EditorialSectionLabel>How it works</EditorialSectionLabel>
          <V2Reveal
            as="h2"
            delay={0.08}
            className="hr-text-primary text-3xl leading-[1.08] font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            From agreement to payment, in the open.
          </V2Reveal>
          <V2Reveal
            as="p"
            delay={0.16}
            className="hr-text-secondary mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base"
          >
            Every step of the job is tracked, so trust doesn’t rely on promises.
          </V2Reveal>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute top-7 right-[9%] left-[9%] hidden border-t border-dashed border-border lg:block"
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {WORKFLOW_STEPS.map((step, index) => {
              const isActive = index === activeStep;

              return (
                <V2Reveal
                  as="article"
                  key={step.title}
                  y={16}
                  delay={0.24 + index * 0.08}
                  ariaCurrent={isActive ? "step" : undefined}
                  className="relative flex flex-col items-center last:col-span-2 last:mx-auto last:max-w-xs sm:last:col-span-1 sm:last:max-w-none"
                >
                  <motion.span
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ duration: 0.4 }}
                    className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full border font-sans text-lg font-bold transition-colors duration-400 ${
                      isActive
                        ? "border-[#FF8703] bg-highrable-surface-accent text-highrable-orange-1"
                        : "border-transparent bg-muted text-highrable-text-muted"
                    }`}
                  >
                    {step.icon}
                  </motion.span>
                  <p
                    className={`mt-5 font-mono text-xl font-bold transition-colors duration-400 ${
                      isActive ? "text-highrable-orange-1" : "text-highrable-text-muted"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="hr-text-primary mt-2 text-base font-semibold">{step.title}</h3>
                  <p className="hr-text-muted mt-1.5 max-w-[13rem] text-xs leading-relaxed sm:text-sm">
                    {step.description}
                  </p>
                </V2Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
