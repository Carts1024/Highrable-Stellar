"use client";

import { WalletStatusCard } from "@/core/wallet/components/wallet-status-card";
import { ProductPageHero } from "@/features/common";
import { CreateJobForm } from "@/features/marketplace/components/create-job-form";
import { useRequireOnboarding } from "@/features/onboarding";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { FileText, Layers, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const POSTING_STEPS = [
  {
    icon: FileText,
    label: "01 · Scope",
    description: "Short, specific deliverables.",
  },
  {
    icon: Layers,
    label: "02 · Asset",
    description: "Use a configured escrow asset.",
  },
  {
    icon: ShieldCheck,
    label: "03 · Escrow",
    description: "Fund now or after selection.",
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
    <div className="space-y-8">
      {/* Hero */}
      <section className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-8 lg:pb-10">
        <ProductPageHero
          label="Client Workflow"
          title={
            <>
              Post a Job <span className="text-[#FF7003]">with Escrow-Ready Terms</span>
            </>
          }
          description="Define the minimum work terms freelancers need: scope, payment asset, deadline, and escrow path."
          actions={
            <>
              <AppButton asChild className="hr-v2-button-primary gap-2 rounded-lg px-6 font-mono">
                <Link href="/jobs">Browse Open Jobs</Link>
              </AppButton>
              <AppButton asChild className="rounded-lg px-6 font-mono">
                <Link href="/marketplace">Open Marketplace</Link>
              </AppButton>
            </>
          }
        />

        {/* Step panel */}
        <div className="flex flex-col gap-0 divide-y divide-border/60 rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl">
          {POSTING_STEPS.map(({ icon: Icon, label, description }) => (
            <div key={label} className="flex items-start gap-3 px-4 py-3 sm:px-5 sm:py-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-highrable-orange-2/10 text-highrable-orange-2">
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
  );
}
