"use client";

import { AppButton } from "@/core/ui/button";
import { WalletStatusCard } from "@/core/wallet/components/wallet-status-card";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { ProductPageHero } from "@/features/common";
import { CreateJobForm } from "@/features/marketplace/components/create-job-form";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Standalone client job-posting page using the validated marketplace form flow. */
export function PostJobPage() {
  const router = useRouter();
  const { isConnected } = useWallet();

  return (
    <div className="space-y-8">
      <ProductPageHero
        label="Client Workflow"
        title={
          <>
            Post a Job <span className="text-[#FF7003]">with Escrow-Ready Terms</span>
          </>
        }
        description="Define job scope, budget, and payment asset. Once submitted, applicants can apply and the selected freelancer can move into the escrow execution flow."
        actions={
          <>
            <AppButton asChild appVariant="secondary">
              <Link href="/jobs">Browse Open Jobs</Link>
            </AppButton>
            <AppButton asChild appVariant="ghost">
              <Link href="/marketplace">Open Marketplace</Link>
            </AppButton>
          </>
        }
      />

      {isConnected ? <WalletStatusCard /> : null}

      <CreateJobForm
        onCreated={(createdJobId) => router.push(`/marketplace/jobs/${createdJobId}`)}
      />
    </div>
  );
}
