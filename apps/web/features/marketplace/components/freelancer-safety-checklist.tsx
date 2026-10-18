"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
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
      <div className="space-y-2">
        <h2 className="hr-text-primary font-sans text-lg font-semibold">Before Starting Work</h2>
        <p className="hr-text-secondary font-sans text-sm">
          Only start after the job shows Payment Secured and the payment terms match the agreement.
        </p>
      </div>
    );
  }

  const checklist = [
    {
      label: "Client Selected You",
      isComplete: isSelectedFreelancer,
    },
    {
      label: "Payment Hold Created",
      isComplete: escrow !== null && escrow !== undefined,
    },
    {
      label: "Funds Verified Funded",
      isComplete: escrow?.status === "funded" || escrow?.status === "submitted",
    },
    {
      label: `Payment is ${formatAmount(job.budget)} ${formatAssetLabel(job.asset)}`,
      isComplete: escrow?.amount === job.budget && escrow?.asset === job.asset,
    },
    {
      label: "Work Stays Within Highrable Approval Flow",
      isComplete: escrow?.status === "funded" || escrow?.status === "submitted",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="hr-text-primary font-sans text-lg font-semibold">Before Starting Work</h2>
        <p className="hr-text-secondary font-sans text-sm">
          Confirm the payment hold and payment terms before you begin delivery.
        </p>
      </div>
      <ul className="space-y-2.5 font-sans text-sm">
        {checklist.map((item) => {
          const Icon = item.isComplete ? CheckCircle2 : Circle;

          return (
            <li key={item.label} className="flex items-center gap-2 text-muted-foreground">
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  item.isComplete ? "text-emerald-700" : "text-amber-600"
                }`}
              />
              <span className={item.isComplete ? "hr-text-primary" : undefined}>{item.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
