"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatTokenAmount } from "@/core/stellar/amounts";
import { stablecoinConfig } from "@/core/stellar/stablecoin-config";
import { AppButton } from "@/core/ui/button";
import { AppInput } from "@/core/ui/input";
import { AppTextarea } from "@/core/ui/textarea";
import { sanitizeMultilineInput } from "@/features/common";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { useEffect, useState } from "react";
import { z } from "zod";

const RELEASE_REVIEW_SCHEMA = z.object({
  rating: z
    .number()
    .int()
    .min(1, "Rating must be between 1 and 5.")
    .max(5, "Rating must be between 1 and 5."),
  reviewText: z
    .string()
    .transform(sanitizeMultilineInput)
    .pipe(z.string().max(1000, "Review text must be under 1000 characters.")),
});

type TReleasePaymentInput = {
  rating: number;
  reviewText: string;
};

interface IReleasePaymentDialogProps {
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly jobTitle: string;
  readonly freelancerWallet: string;
  readonly amount: number;
  readonly asset: string;
  readonly errorMessage: string | null;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onConfirm: (input: TReleasePaymentInput) => Promise<void>;
}

export function ReleasePaymentDialog({
  isOpen,
  isSubmitting,
  jobTitle,
  freelancerWallet,
  amount,
  asset,
  errorMessage,
  onOpenChange,
  onConfirm,
}: IReleasePaymentDialogProps) {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setRating(5);
      setReviewText("");
      setValidationError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = RELEASE_REVIEW_SCHEMA.safeParse({
      rating,
      reviewText,
    });

    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Release inputs are invalid.");
      return;
    }

    setValidationError(null);
    await onConfirm(parsed.data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-[#e8e8e8] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#0a0a0a]">Confirm Payment Release</DialogTitle>
          <DialogDescription className="text-[#5f5f5f]">
            Releasing payment is irreversible. Confirm job outcome and review details before sending
            funds.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3 text-sm">
          <p>
            <span className="font-medium text-[#0a0a0a]">Job:</span> {jobTitle}
          </p>
          <p>
            <span className="font-medium text-[#0a0a0a]">Freelancer:</span>{" "}
            {shortenWalletAddress(freelancerWallet)}
          </p>
          <p>
            <span className="font-medium text-[#0a0a0a]">Amount:</span>{" "}
            {formatTokenAmount(amount, formatAssetLabel(asset), stablecoinConfig.decimals)}
          </p>
          <p>
            <span className="font-medium text-[#0a0a0a]">Asset:</span> {formatAssetLabel(asset)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="release-rating" className="grid gap-1 text-sm font-medium text-[#0a0a0a]">
            Rating (1-5 stars)
            <AppInput
              id="release-rating"
              type="number"
              min={1}
              max={5}
              value={rating}
              disabled={isSubmitting}
              onChange={(event) => {
                setRating(Number(event.target.value));
                setValidationError(null);
              }}
              aria-label="Rating for freelancer performance"
            />
          </label>

          <label htmlFor="release-review" className="grid gap-1 text-sm font-medium text-[#0a0a0a]">
            Feedback (optional)
            <AppTextarea
              id="release-review"
              value={reviewText}
              disabled={isSubmitting}
              maxLength={1000}
              rows={4}
              onChange={(event) => {
                setReviewText(event.target.value);
                setValidationError(null);
              }}
              placeholder="Share feedback about the work quality"
              aria-label="Review text for freelancer work"
            />
          </label>

          {validationError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {validationError}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <AppButton
              type="button"
              appVariant="secondary"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </AppButton>
            <AppButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Releasing Payment..." : "Confirm & Release"}
            </AppButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
