"use client";

import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { getWorkTypeLabel } from "@/features/profile/lib/profile-format";
import { api } from "@repo/convex-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useQuery } from "convex/react";
import { useId } from "react";

import type { TShowcaseableCompletedWork } from "../types";

const NO_SHOWCASE_VALUE = "__no_showcase__";

interface IShowcaseWorkSelectorProps {
  readonly freelancerWallet: string | null | undefined;
  readonly selectedEscrowId: string | null;
  readonly onSelectedEscrowIdChange: (escrowId: string | null) => void;
}

function formatShowcaseLabel(work: TShowcaseableCompletedWork): string {
  const title = work.milestoneTitle ? `${work.jobTitle} - ${work.milestoneTitle}` : work.jobTitle;
  return `${title} (${formatAmount(work.amount)} ${formatAsset(work.asset)})`;
}

export function ShowcaseWorkSelector({
  freelancerWallet,
  selectedEscrowId,
  onSelectedEscrowIdChange,
}: IShowcaseWorkSelectorProps) {
  const selectorId = useId();
  const works = useQuery(
    api.applications.listShowcaseableCompletedWorksByFreelancer,
    freelancerWallet ? { freelancerWallet } : "skip",
  ) as TShowcaseableCompletedWork[] | undefined;

  const hasCompletedWorks = (works?.length ?? 0) > 0;
  const selectedWork = works?.find((work) => work.escrowId === selectedEscrowId) ?? null;

  return (
    <div className="space-y-2">
      <label htmlFor={selectorId} className="block text-sm font-medium text-[#0a0a0a]">
        Showcased completed work
      </label>
      <Select
        value={selectedEscrowId ?? NO_SHOWCASE_VALUE}
        onValueChange={(value) =>
          onSelectedEscrowIdChange(value === NO_SHOWCASE_VALUE ? null : value)
        }
        disabled={works === undefined || !hasCompletedWorks}
      >
        <SelectTrigger
          id={selectorId}
          className="w-full border-[#e8e8e8] bg-white text-left"
          aria-label="Showcased completed work"
        >
          <SelectValue
            placeholder={
              works === undefined ? "Loading completed work..." : "No showcased work selected"
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_SHOWCASE_VALUE}>No showcased work</SelectItem>
          {works?.map((work) => (
            <SelectItem key={work.escrowId} value={work.escrowId}>
              {formatShowcaseLabel(work)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!freelancerWallet ? (
        <p className="text-xs text-[#7f7f7f]">Connect wallet to choose showcased work.</p>
      ) : null}
      {freelancerWallet && works !== undefined && !hasCompletedWorks ? (
        <p className="text-xs text-[#7f7f7f]">
          No escrow-verified completed work is available to showcase yet.
        </p>
      ) : null}
      {selectedWork ? (
        <p className="text-xs text-[#5f5f5f]">
          {getWorkTypeLabel(selectedWork.workType)} selected for this application.
        </p>
      ) : null}
    </div>
  );
}
