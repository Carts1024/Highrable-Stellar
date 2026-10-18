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
        <h2 className="hr-text-primary font-sans text-sm font-semibold">Before you start work</h2>
        <p className="hr-text-secondary font-sans text-sm">
          Only start once the payment is on hold and the amount matches the agreement.
        </p>
      </div>
    );
  }

  const checklist = [
    {
      label: "Client selected you",
      isComplete: isSelectedFreelancer,
    },
    {
      label: "Payment hold created",
      isComplete: escrow !== null && escrow !== undefined,
    },
    {
      label: "Funds verified on hold",
      isComplete: escrow?.status === "funded" || escrow?.status === "submitted",
    },
    {
      label: `Payment is ${formatAmount(job.budget)} ${formatAssetLabel(job.asset)}`,
      isComplete: escrow?.amount === job.budget && escrow?.asset === job.asset,
    },
    {
      label: "Work stays inside Highrable's approval flow",
      isComplete: escrow?.status === "funded" || escrow?.status === "submitted",
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="hr-text-primary font-sans text-sm font-semibold">Before you start work</h2>
      <ul className="space-y-2 font-sans text-sm">
        {checklist.map((item) => {
          const Icon = item.isComplete ? CheckCircle2 : Circle;

          return (
            <li key={item.label} className="flex items-start gap-2 text-muted-foreground">
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  item.isComplete ? "text-emerald-600" : "text-zinc-300"
                }`}
                aria-hidden="true"
              />
              <span className="sr-only">{item.isComplete ? "Done:" : "Not yet:"}</span>
              <span className={item.isComplete ? "hr-text-primary" : undefined}>{item.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
