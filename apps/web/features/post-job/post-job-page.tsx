"use client";

import { WalletStatusCard } from "@/core/wallet/components/wallet-status-card";
import { ProductPageHero } from "@/features/common";
import { CreateJobForm } from "@/features/marketplace/components/create-job-form";
import { ModeGate } from "@/features/mode";
import { useRequireOnboarding } from "@/features/onboarding";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { FileText, Layers, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const POSTING_STEPS = [
  {
    icon: FileText,
    label: "1 · Describe",
    description: "Say what you need done.",
  },
  {
    icon: Layers,
    label: "2 · Set the price",
    description: "Pick a budget and a deadline.",
  },
  {
    icon: ShieldCheck,
    label: "3 · Pay safely",
    description: "Your money is held until you approve the work.",
  },
] as const;

/** Standalone client job-posting page using the validated marketplace form flow. */
export function PostJobPage() {
  const router = useRouter();
  const onboardingGuard = useRequireOnboarding();

  if (onboardingGuard.isCheckingOnboarding) {
    return <p className="font-sans text-sm text-muted-foreground">Checking onboarding…</p>;
  }

  return (
    <ModeGate allow="client" purpose="post a job">
      <div className="space-y-8">
        {/* Hero */}
        <section className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-8 lg:pb-10">
          <ProductPageHero
            label="Client · Post a job"
            title={
              <>
                Post a job <span className="hr-mode-text">and hire with confidence</span>
              </>
            }
            description="Tell freelancers what you need and how much you will pay. Your payment can be held safely until you approve the finished work."
            actions={
              <>
                <AppButton asChild className="hr-v2-button-primary gap-2 rounded-lg px-6 font-mono">
                  <Link href="/dashboard">See My Jobs</Link>
                </AppButton>
              </>
            }
          />

          {/* Step panel */}
          <div className="flex flex-col gap-0 divide-y divide-border/60 rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl">
            {POSTING_STEPS.map(({ icon: Icon, label, description }) => (
              <div key={label} className="flex items-start gap-3 px-4 py-3 sm:px-5 sm:py-4">
                <div className="hr-mode-soft hr-mode-text mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="mb-1 font-mono text-xs tracking-[0.08em] text-muted-foreground/80 uppercase">
                    {label}
                  </span>
                  <span className="hr-text-primary text-xs leading-none font-medium sm:text-sm">
                    {description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <WalletStatusCard />

        <CreateJobForm
          onCreated={(createdJobId) => router.push(`/marketplace/jobs/${createdJobId}`)}
        />
      </div>
    </ModeGate>
  );
}
