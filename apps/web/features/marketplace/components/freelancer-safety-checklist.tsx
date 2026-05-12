"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
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
      <Card className="border-[#e8e8e8] bg-white">
        <CardHeader>
          <CardTitle className="text-[#0a0a0a]">Before Starting Work</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#5f5f5f]">
            Only start after the job shows Verified Funded and the payment terms match the
            agreement.
          </p>
        </CardContent>
      </Card>
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
    <Card className="border-[#e8e8e8] bg-white">
      <CardHeader>
        <CardTitle className="text-[#0a0a0a]">Before Starting Work</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {checklist.map((item) => {
            const Icon = item.isComplete ? CheckCircle2 : Circle;

            return (
              <li key={item.label} className="flex items-center gap-2 text-[#5f5f5f]">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    item.isComplete ? "text-emerald-700" : "text-amber-600"
                  }`}
                />
                <span className={item.isComplete ? "text-[#0a0a0a]" : undefined}>{item.label}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
