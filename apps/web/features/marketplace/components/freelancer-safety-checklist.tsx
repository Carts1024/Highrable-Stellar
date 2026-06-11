"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@repo/ui/responsive-dialog";
import { CheckCircle2, Circle } from "lucide-react";

import type { TConvexDoc } from "@repo/convex-client";

interface IFreelancerSafetyChecklistProps {
  readonly job: TConvexDoc<"jobs">;
  readonly escrow: TConvexDoc<"escrows"> | null | undefined;
  readonly connectedWallet: string | null;
}

export function FreelancerSafetyChecklist({
  job,
  escrow,
  connectedWallet,
}: IFreelancerSafetyChecklistProps) {
  const isSelectedFreelancer =
    !!connectedWallet && isSameWallet(connectedWallet, job.selectedFreelancerWallet);

  if (!isSelectedFreelancer) {
    return (
      <section className="flex flex-wrap items-center justify-between rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="space-y-2">
          <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
            Work Safety
          </p>
          <h2 className="hr-text-primary mt-0.5 font-sans text-lg font-semibold">
            Before Starting Work
          </h2>
        </div>

        <ResponsiveDialog>
          <ResponsiveDialogTrigger asChild>
            <AppButton type="button" variant="primary" className="text-xs">
              View Checklist
            </AppButton>
          </ResponsiveDialogTrigger>

          <ResponsiveDialogContent className="max-w-3xl">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Before Starting Work</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody className="font-sans text-sm">
              Only start after the job shows Verified Funded and the payment terms match the
              agreement.
            </ResponsiveDialogBody>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </section>
    );
  }

  const checklist = [
    {
      label: "Client selected you",
      isComplete: isSelectedFreelancer,
    },
    {
      label: "Escrow created",
      isComplete: escrow !== null && escrow !== undefined,
    },
    {
      label: "Funds verified funded",
      isComplete: escrow?.status === "funded" || escrow?.status === "submitted",
    },
    {
      label: `Payment is ${formatAmount(job.budget)} ${formatAssetLabel(job.asset)}`,
      isComplete: escrow?.amount === job.budget && escrow?.asset === job.asset,
    },
    {
      label: "Work stays within Highrable approval flow",
      isComplete: escrow?.status === "funded" || escrow?.status === "submitted",
    },
  ];

  return (
    <section className="flex flex-wrap items-center justify-between rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:rounded-2xl sm:p-6">
      <div className="space-y-2">
        <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
          Work Safety
        </p>
        <h2 className="hr-text-primary mt-0.5 font-sans text-lg font-semibold">
          Before Starting Work
        </h2>
      </div>

      <ResponsiveDialog>
        <ResponsiveDialogTrigger asChild>
          <AppButton type="button" variant="primary" className="text-xs">
            View Checklist
          </AppButton>
        </ResponsiveDialogTrigger>

        <ResponsiveDialogContent className="max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Before Starting Work</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Confirm the escrow and payment terms before you begin delivery.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <ul className="space-y-2 font-sans text-sm">
              {checklist.map((item) => {
                const Icon = item.isComplete ? CheckCircle2 : Circle;

                return (
                  <li key={item.label} className="flex items-center gap-2 text-muted-foreground">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        item.isComplete ? "text-emerald-700" : "text-amber-600"
                      }`}
                    />
                    <span className={item.isComplete ? "hr-text-primary" : undefined}>
                      {item.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </section>
  );
}
