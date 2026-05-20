"use client";

import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useState } from "react";

import type { TDisputeParentType } from "../types";
import type { TConvexDoc } from "@repo/convex-client";

import { OpenDisputeDialog } from "./open-dispute-dialog";

export function OpenDisputeButton({
  job,
  milestone,
  escrow,
  parentType,
  parentId,
  disabled,
  className,
}: {
  readonly job: TConvexDoc<"jobs">;
  readonly milestone?: TConvexDoc<"milestones">;
  readonly escrow: TConvexDoc<"escrows"> | null | undefined;
  readonly parentType: TDisputeParentType;
  readonly parentId: string;
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!escrow) return null;

  return (
    <>
      <AppButton
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={
          className ??
          "rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        Open Dispute
      </AppButton>
      <OpenDisputeDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        job={job}
        milestone={milestone}
        escrow={escrow}
        parentType={parentType}
        parentId={parentId}
      />
    </>
  );
}
