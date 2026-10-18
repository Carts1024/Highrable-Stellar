"use client";

import { ProductPageHero } from "@/features/common";
import { CreateJobForm } from "@/features/marketplace/components/create-job-form";
import { ModeGate } from "@/features/mode";
import { useRequireOnboarding } from "@/features/onboarding";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Standalone client job-posting page using the validated marketplace form flow. */
export function PostJobPage() {
  const router = useRouter();
  const onboardingGuard = useRequireOnboarding();

  if (onboardingGuard.isCheckingOnboarding) {
    return <p className="font-sans text-sm text-muted-foreground">Checking onboarding…</p>;
  }

  return (
    <ModeGate allow="client" purpose="post a job">
      <div className="space-y-6">
        <ProductPageHero
          title="Post a job"
          description="Describe the work and set a budget. The payment is held on Stellar until you approve the finished work."
          actions={
            <AppButton asChild variant="ghost" className="h-9 px-3 text-sm">
              <Link href="/dashboard">My jobs</Link>
            </AppButton>
          }
        />

        <CreateJobForm
          onCreated={(createdJobId) => router.push(`/marketplace/jobs/${createdJobId}`)}
        />
      </div>
    </ModeGate>
  );
}
