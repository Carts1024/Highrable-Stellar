"use client";

import { parseHumanAmount } from "@/core/stellar/amounts";
import { formatAssetLabel, shortenContractId } from "@/core/stellar/assets";
import {
  hasStablecoinConfig,
  stablecoinConfig,
  validateStablecoinConfig,
} from "@/core/stellar/stablecoin-config";
import { AppButton } from "@/core/ui/button";
import { AppInput } from "@/core/ui/input";
import { AppTextarea } from "@/core/ui/textarea";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { sanitizeMultilineInput, sanitizeSingleLineInput } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  analyzeJobScamSignals,
  DISALLOWED_JOB_POST_MESSAGE,
} from "@/features/marketplace/lib/scam-signals";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { z } from "zod";

import type { TCreateJobFormErrors, TCreateJobFormState } from "@/features/marketplace/types";

const DEFAULT_STABLECOIN_ASSET = stablecoinConfig.tokenContractId ?? "";
const MAX_HUMAN_BUDGET = 10_000_000;

const CREATE_JOB_SCHEMA = z.object({
  title: z
    .string()
    .transform(sanitizeSingleLineInput)
    .pipe(z.string().min(3, "Job title must be at least 3 characters."))
    .pipe(z.string().max(120, "Job title must be under 120 characters.")),
  description: z
    .string()
    .transform(sanitizeMultilineInput)
    .pipe(z.string().min(20, "Description must be at least 20 characters."))
    .pipe(z.string().max(4000, "Description must be under 4000 characters.")),
  budget: z
    .string()
    .transform(sanitizeSingleLineInput)
    .pipe(z.string().min(1, "Budget is required."))
    .transform((value) => parseHumanAmount(value))
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "Budget must be greater than zero.",
    })
    .refine((value) => value <= MAX_HUMAN_BUDGET, {
      message: "Budget exceeds the allowed range.",
    }),
  asset: z
    .string()
    .transform(sanitizeSingleLineInput)
    .pipe(z.string().min(3, "Payment asset is required."))
    .pipe(z.string().max(255, "Payment asset is too long.")),
});

type TCreateJobPayload = z.infer<typeof CREATE_JOB_SCHEMA>;

function buildCreateJobErrors(formState: TCreateJobFormState): TCreateJobFormErrors {
  const errors: TCreateJobFormErrors = {};
  const parsed = CREATE_JOB_SCHEMA.safeParse(formState);

  if (parsed.success) {
    return errors;
  }

  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "title" || field === "description" || field === "budget" || field === "asset") {
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
  }

  return errors;
}

export function CreateJobForm({ onCreated }: { onCreated: (jobId: string) => void }) {
  const { address, isConnected, walletState } = useWallet();
  const createJob = useMutation(api.jobs.createJob);
  const stablecoinValidation = useMemo(() => validateStablecoinConfig(), []);
  const isStablecoinConfigured = useMemo(() => hasStablecoinConfig(), []);
  const [formState, setFormState] = useState<TCreateJobFormState>({
    title: "",
    description: "",
    budget: "",
    asset: DEFAULT_STABLECOIN_ASSET,
  });
  const [errors, setErrors] = useState<TCreateJobFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scamAnalysis = useMemo(
    () =>
      analyzeJobScamSignals({
        title: sanitizeSingleLineInput(formState.title),
        description: sanitizeMultilineInput(formState.description),
      }),
    [formState.description, formState.title],
  );

  const helperText = useMemo(() => {
    if (isStablecoinConfigured && stablecoinConfig.tokenContractId) {
      return `${stablecoinConfig.symbol} is configured for MVP escrow payments (${shortenContractId(
        stablecoinConfig.tokenContractId,
      )}).`;
    }

    return "Enter the stablecoin token contract ID only if you need an off-chain draft before central config is set.";
  }, [isStablecoinConfigured]);

  const budgetHelperText = useMemo(
    () => "This amount will be locked in Stellar escrow after the client funds the contract.",
    [],
  );

  const updateField = (field: keyof TCreateJobFormState, value: string) => {
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
    setErrors((currentValue) => ({ ...currentValue, [field]: undefined, submit: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isConnected || !address) {
      setErrors({ submit: "Connect wallet to create a job." });
      return;
    }

    if (!isStablecoinConfigured && !formState.asset.trim()) {
      setErrors({
        asset:
          stablecoinValidation.message ??
          "Payment asset is required until stablecoin configuration is set.",
      });
      return;
    }

    const validationErrors = buildCreateJobErrors(formState);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const parsed = CREATE_JOB_SCHEMA.safeParse(formState);
      if (!parsed.success) {
        setErrors(buildCreateJobErrors(formState));
        setIsSubmitting(false);
        return;
      }

      const payload: TCreateJobPayload = parsed.data;
      const parsedScamAnalysis = analyzeJobScamSignals({
        title: payload.title,
        description: payload.description,
      });

      if (parsedScamAnalysis.isBlocked) {
        setErrors({ submit: DISALLOWED_JOB_POST_MESSAGE });
        setIsSubmitting(false);
        return;
      }

      const createdJobId = await createJob({
        title: payload.title,
        description: payload.description,
        budget: payload.budget,
        asset: payload.asset,
        clientWallet: address,
      });

      setFormState({
        title: "",
        description: "",
        budget: "",
        asset: DEFAULT_STABLECOIN_ASSET,
      });
      onCreated(createdJobId);
    } catch (error) {
      setErrors({
        submit: getReadableErrorMessage(error, "Failed to create job. Please try again."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Post a freelance job</h2>
      <p className="mt-1 text-sm text-gray-600">
        Define escrow-ready job terms with the configured stablecoin payment asset for the MVP.
      </p>

      {!isStablecoinConfigured ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Stablecoin token is not configured. You can create off-chain jobs, but escrow funding will
          be disabled until NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID is set.
        </p>
      ) : null}

      {!isConnected ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-3">Connect wallet to create a job.</p>
          <WalletConnectTrigger className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 font-medium text-white" />
        </div>
      ) : null}

      {isConnected && walletState.isTestnet && walletState.isFunded === false ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You can create off-chain jobs, but Stellar transactions in later steps require a funded
          testnet account.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="marketplace-job-title"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Job title
          </label>
          <AppInput
            id="marketplace-job-title"
            value={formState.title}
            onChange={(event) => updateField("title", event.target.value)}
            maxLength={140}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FF7003] focus:outline-hidden"
            placeholder="Build a responsive frontend with Stellar wallet integration"
          />
          {errors.title ? <p className="mt-1 text-xs text-red-600">{errors.title}</p> : null}
        </div>

        <div>
          <label
            htmlFor="marketplace-job-description"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Description
          </label>
          <AppTextarea
            id="marketplace-job-description"
            value={formState.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={4}
            maxLength={4000}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FF7003] focus:outline-hidden"
            placeholder="Scope, deliverables, and acceptance criteria"
          />
          {errors.description ? (
            <p className="mt-1 text-xs text-red-600">{errors.description}</p>
          ) : null}
        </div>

        {scamAnalysis.signals.length > 0 ? (
          <div
            className={`rounded-xl border p-3 text-sm ${
              scamAnalysis.isBlocked
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
            role={scamAnalysis.isBlocked ? "alert" : "note"}
          >
            <p className="font-semibold">
              {scamAnalysis.isBlocked
                ? DISALLOWED_JOB_POST_MESSAGE
                : "This job post contains language that may look suspicious to freelancers."}
            </p>
            {!scamAnalysis.isBlocked ? (
              <p className="mt-1">
                This job may look suspicious because it asks users to move off-platform or pay
                upfront.
              </p>
            ) : null}
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {scamAnalysis.signals.map((signal) => (
                <li key={signal.type}>{signal.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="marketplace-job-budget"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Budget
            </label>
            <AppInput
              id="marketplace-job-budget"
              type="text"
              inputMode="decimal"
              value={formState.budget}
              onChange={(event) => updateField("budget", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FF7003] focus:outline-hidden"
              placeholder="500"
            />
            <p className="mt-1 text-xs text-gray-500">{budgetHelperText}</p>
            {errors.budget ? <p className="mt-1 text-xs text-red-600">{errors.budget}</p> : null}
          </div>

          <div>
            <label
              htmlFor="marketplace-job-asset"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Payment asset
            </label>
            {isStablecoinConfigured ? (
              <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                <p className="font-medium text-[#0a0a0a]">
                  Payment asset: {formatAssetLabel(stablecoinConfig.tokenContractId ?? "")}
                </p>
                <p className="mt-1 font-mono text-xs break-all text-[#5f5f5f]">
                  {stablecoinConfig.tokenContractId}
                </p>
              </div>
            ) : (
              <AppInput
                id="marketplace-job-asset"
                value={formState.asset}
                onChange={(event) => updateField("asset", event.target.value)}
                maxLength={255}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FF7003] focus:outline-hidden"
                placeholder="Stablecoin token contract ID"
              />
            )}
            <p className="mt-1 text-xs text-gray-500">{helperText}</p>
            {errors.asset ? <p className="mt-1 text-xs text-red-600">{errors.asset}</p> : null}
          </div>
        </div>

        {errors.submit ? <p className="text-sm text-red-600">{errors.submit}</p> : null}

        <AppButton
          type="submit"
          disabled={isSubmitting || !isConnected}
          className="disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Create Job"}
        </AppButton>
      </form>
    </section>
  );
}
