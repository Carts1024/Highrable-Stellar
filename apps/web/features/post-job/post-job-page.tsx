"use client";

import { WalletStatusCard } from "@/core/wallet/components/wallet-status-card";
import { ProductPageHero } from "@/features/common";
import { CreateJobForm } from "@/features/marketplace/components/create-job-form";
import { useRequireOnboarding } from "@/features/onboarding";
import { HighrableV2Metric } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Standalone client job-posting page using the validated marketplace form flow. */
export function PostJobPage() {
  const router = useRouter();
  const onboardingGuard = useRequireOnboarding();

  if (onboardingGuard.isCheckingOnboarding) {
    return <p className="text-sm text-[#5f5f5f]">Checking onboarding...</p>;
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-8 border-b border-[#e8e8e8] pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <ProductPageHero
          label="Client Workflow"
          title={
            <>
              Post a Job <span className="hr-v2-gradient-text">with Escrow-Ready Terms</span>
            </>
          }
          description="Define the minimum work terms freelancers need: scope, payment asset, deadline, and escrow path."
          actions={
            <>
              <AppButton
                asChild
                variant="secondary"
                className="hr-v2-button-secondary rounded-none"
              >
                <Link href="/jobs">Browse Open Jobs</Link>
              </AppButton>
              <AppButton asChild variant="ghost" className="rounded-none">
                <Link href="/marketplace">Open Marketplace</Link>
              </AppButton>
            </>
          }
        />

        <div className="grid gap-5 border-l border-[#e8e8e8] py-2">
          <HighrableV2Metric label="01" value="Scope" description="Short, specific deliverables." />
          <HighrableV2Metric
            label="02"
            value="Asset"
            description="Use a configured escrow asset."
          />
          <HighrableV2Metric label="03" value="Escrow" description="Fund now or after selection." />
        </div>
      </section>

      <WalletStatusCard />

      <CreateJobForm
        onCreated={(createdJobId) => router.push(`/marketplace/jobs/${createdJobId}`)}
      />
    </div>
  );
}
