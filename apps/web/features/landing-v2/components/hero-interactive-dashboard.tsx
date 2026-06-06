"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  Lock,
  ShieldCheck,
  Star,
  Unlock,
  Zap,
} from "lucide-react";
import { useState } from "react";

/**
 * Renders an interactive Web3 dashboard container representing
 * Highrable's on-chain freelancing mechanics (Escrow, Stellar Payment, Reputation).
 */
export function HeroInteractiveDashboard() {
  const [step, setStep] = useState<"funded" | "releasing" | "released">("funded");
  const [completedCount, setCompletedCount] = useState(14);
  const [isSimulating, setIsSimulating] = useState(false);

  const triggerSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setStep("releasing");

    setTimeout(() => {
      setStep("released");
      setCompletedCount(15);
      setIsSimulating(false);
    }, 2200);
  };

  const resetSimulation = () => {
    if (isSimulating) return;
    setStep("funded");
    setCompletedCount(14);
  };

  return (
    <div className="relative mx-auto w-full max-w-[500px] rounded-2xl border border-border/80 bg-card p-6 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/80">
      {/* Glow highlight */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-orange-500/10 blur-[60px]" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-amber-500/10 blur-[60px]" />

      {/* Header bar */}
      <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-red-400" />
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-yellow-400" />
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-green-400" />
          <span className="ml-1.5 font-mono text-[0.65rem] tracking-wider text-neutral-400">
            highrable.work
          </span>
        </div>
        <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-2 py-0.5 font-mono text-[0.6rem] font-semibold text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
          Testnet
        </span>
      </div>

      {/* Main Grid: Escrow milestones + Freelancer Badge */}
      <div className="space-y-6">
        {/* Section 1: Escrow Tracker */}
        <div className="rounded-xl border border-border/60 bg-neutral-50/50 p-4 dark:border-neutral-800/80 dark:bg-neutral-950/40">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200">
              <Coins className="h-3.5 w-3.5 text-orange-500" />
              Soroban Escrow #4892
            </h4>
            <span className="font-mono text-[0.65rem] text-neutral-400">
              Contract Amount: 1,500 USDC
            </span>
          </div>

          <div className="space-y-3">
            {/* Milestone 1 */}
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div className="text-left">
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Milestone 1: Web Architecture Design
                </p>
                <span className="font-mono text-[0.6rem] text-emerald-600 dark:text-emerald-400">
                  Approved & Released • 500 USDC
                </span>
              </div>
            </div>

            {/* Milestone 2 */}
            <div className="flex items-start gap-3">
              <div className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                {step === "funded" && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                {step === "releasing" && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="h-3.5 w-3.5 rounded-full border-2 border-orange-500 border-t-transparent"
                  />
                )}
                {step === "released" && <Unlock className="h-3.5 w-3.5 text-emerald-500" />}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Milestone 2: Frontend Implementation
                </p>
                <div className="flex items-center gap-1.5 font-mono text-[0.6rem]">
                  {step === "funded" && (
                    <span className="text-amber-600 dark:text-amber-400">
                      Funded in Smart Contract • 1,000 USDC
                    </span>
                  )}
                  {step === "releasing" && (
                    <span className="animate-pulse text-orange-500">
                      Processing Smart Contract Release...
                    </span>
                  )}
                  {step === "released" && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Payment Released Successfully!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Freelancer Portable Profile Card */}
        <div className="rounded-xl border border-border/60 bg-white p-4 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-950/20">
          <div className="flex items-start gap-4">
            {/* Avatar Placeholder */}
            <div className="relative h-12 w-12 shrink-0 overflow-visible rounded-full border border-orange-100 bg-orange-50 p-1 dark:border-orange-950 dark:bg-orange-950/20">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-linear-to-tr from-orange-400 to-amber-400 font-sans text-xs font-bold text-white">
                JD
              </div>
              {/* Position badge slightly outside the avatar so it's not clipped */}
              <span className="absolute right-0 bottom-0 block h-3 w-3 rounded-full border border-white bg-green-500 ring-2 ring-white/80 dark:border-neutral-900 dark:ring-neutral-900/60" />
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                  John Doe
                </h5>
                <span className="flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50/50 px-2 py-0.5 font-mono text-[0.55rem] font-semibold text-emerald-700 dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
              </div>
              <p className="font-mono text-[0.65rem] text-neutral-400">
                Soroban Contract Specialist
              </p>

              {/* Stats */}
              <div className="mt-2.5 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    5.0
                  </span>
                </div>
                <div className="h-3 w-px bg-border dark:bg-neutral-800" />
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {completedCount}
                  </span>{" "}
                  On-chain Projects
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Interactive Trigger & Simulation Feedback */}
        <div className="flex flex-col gap-3">
          {step === "funded" ? (
            <button
              type="button"
              onClick={triggerSimulation}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-orange-500 to-amber-500 py-3 font-mono text-xs font-semibold text-white shadow-lg transition-all hover:brightness-105 active:scale-[0.98]"
            >
              <Zap className="h-4 w-4 fill-current" />
              Simulate USDC Payment Release
            </button>
          ) : step === "releasing" ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50/20 py-3 font-mono text-xs text-orange-600 dark:border-orange-950/30 dark:text-orange-400">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Invoking Soroban smart contract...
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Milestone 2 released successfully!
              </div>
              <button
                type="button"
                onClick={resetSimulation}
                className="font-mono text-[0.65rem] text-neutral-400 underline hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                Reset Simulation Demo
              </button>
            </div>
          )}

          {/* Stellar Transaction Ledger Toast */}
          <AnimatePresence>
            {step === "released" && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-50/40 p-3.5 text-left font-mono text-[0.65rem] dark:bg-emerald-950/20"
              >
                <div className="mb-1 flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-400">
                  <span>LEDGER UPDATE CONFIRMED</span>
                  <a
                    href="https://stellar.expert"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-0.5 hover:underline"
                  >
                    stellar.expert
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <div className="space-y-1 text-neutral-600 dark:text-neutral-400">
                  <p>
                    <span className="text-neutral-400">TX Hash:</span> a7d3...f29b
                  </p>
                  <p>
                    <span className="text-neutral-400">Operation:</span> Invoke Soroban Release
                    (escrow_id: #4892, milestone: 2)
                  </p>
                  <p>
                    <span className="text-neutral-400">Status:</span> SUCCESS (USDC Transferred:
                    1,000.00)
                  </p>
                  <p>
                    <span className="text-neutral-400">Settlement:</span> 2.3s •{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">Fee: 0.00001 XLM</span>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
