"use client";

export function DisputeActionGuardNotice() {
  return (
    <div className="rounded-lg border border-[#FF7003]/30 bg-orange-50 px-4 py-3 text-sm text-[#8a3a00]">
      This escrow is currently disputed. Release and cancellation actions are paused during review.
    </div>
  );
}
