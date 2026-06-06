"use client";

import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
  V2_SURFACE_MUTED_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion, AnimatePresence } from "framer-motion";
import { User, Building, Sparkles } from "lucide-react";
import { useState } from "react";

import { CLIENT_STEPS, FREELANCER_STEPS } from "../constants/landing-v2.constants";

export function V2HowItWorksSection() {
  const [activeTab, setActiveTab] = useState<"freelancer" | "client">("freelancer");

  const currentSteps = activeTab === "freelancer" ? FREELANCER_STEPS : CLIENT_STEPS;

  return (
    <section
      id="how-it-works"
      className={`${V2_SURFACE_MUTED_CLASS} ${V2_SECTION_SPACING_CLASS} dark:bg-neutral-950/20`}
    >
      <div className={V2_PAGE_CONTAINER_CLASS}>
        {/* Title Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl text-left"
        >
          <SectionLabel className="mb-4">How It Works</SectionLabel>
          <h2 className="hr-text-primary text-3xl leading-[1.15] font-medium md:text-4xl">
            From first match to final payment
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
            Every step in the Highrable workflow is backed by blockchain verification - no
            middlemen, no guesswork, no disputes.
          </p>
        </motion.div>

        {/* Tab & Timeline Container */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left Panel: Tab Selector Card */}
          <div className="flex flex-col justify-start lg:col-span-4">
            <div className="rounded-xl border border-border bg-card p-6 text-left shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50">
              <h3 className="hr-text-primary mb-2 text-lg font-bold">Select Your Role</h3>
              <p className="hr-text-secondary mb-6 text-xs leading-relaxed">
                Explore the platform experience tailored to your workflow goals as a freelancer or a
                client.
              </p>

              {/* Tab Selector Buttons */}
              <div className="relative flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("freelancer")}
                  className={`relative z-10 flex flex-1 items-center justify-center gap-2 py-2.5 font-mono text-[0.65rem] font-bold tracking-wider uppercase transition-colors duration-200 ${
                    activeTab === "freelancer"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Freelancer
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("client")}
                  className={`relative z-10 flex flex-1 items-center justify-center gap-2 py-2.5 font-mono text-[0.65rem] font-bold tracking-wider uppercase transition-colors duration-200 ${
                    activeTab === "client"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  <Building className="h-3.5 w-3.5" />
                  Client
                </button>

                {/* Sliding background pill */}
                <motion.div
                  className="absolute inset-y-1 rounded-md bg-white shadow-sm dark:bg-neutral-900"
                  layoutId="activeTabPill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  style={{
                    width: "calc(50% - 4px)",
                    left: activeTab === "freelancer" ? "4px" : "calc(50%)",
                  }}
                />
              </div>

              {/* Short summary based on role */}
              <div className="mt-6 border-t border-border/60 pt-6 dark:border-neutral-800">
                <p className="hr-text-primary text-sm font-semibold">
                  {activeTab === "freelancer"
                    ? "Deliver Work & Get Paid Securely"
                    : "Hire Verified Global Talent"}
                </p>
                <p className="hr-text-secondary mt-2 text-xs leading-relaxed">
                  {activeTab === "freelancer"
                    ? "Connect your wallet, sign proposal contracts, and work with the confidence that payment is locked in smart-contract escrows."
                    : "Post contracts, set rates, deposit funds into escrow, and let smart logic handle milestone payout approvals automatically."}
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel: Vertical Animated Timeline */}
          <div className="relative pl-4 text-left lg:col-span-8 lg:pl-10">
            {/* Connecting Vertical Track Line */}
            <div className="absolute top-4 bottom-4 left-4 sm:left-9 w-0.5 border-l-2 border-dashed border-border lg:left-[59px] dark:border-neutral-800" />

            <div className="relative space-y-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-8"
                >
                  {currentSteps.map((step, idx) => (
                    <motion.div
                      key={step.step}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.06 }}
                      className="group relative flex items-start gap-5"
                    >
                      {/* Step Number Circle Indicator */}
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-orange-500 bg-card font-mono text-xs font-bold text-orange-500 shadow-md transition-colors group-hover:bg-orange-500 group-hover:text-white dark:bg-neutral-900">
                        {String(step.step).padStart(2, "0")}
                      </div>

                      {/* Content Block */}
                      <div className="flex-1 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900/40">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="hr-text-primary text-sm font-bold">{step.title}</h4>
                          {step.comingSoon && (
                            <span className="hr-v2-badge-accent flex items-center gap-0.5 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.08em] uppercase">
                              <Sparkles className="h-2.5 w-2.5 fill-current" />
                              AI Coming Soon
                            </span>
                          )}
                        </div>
                        <p className="hr-text-secondary mt-1 text-xs leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
