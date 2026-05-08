"use client";

import { STABLECOIN_TOKEN_CONTRACT_ID } from "@/core/config/stellar-contracts";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";

import type { TCreateJobFormErrors, TCreateJobFormState } from "@/features/marketplace/types";

const DEFAULT_STABLECOIN_ASSET = STABLECOIN_TOKEN_CONTRACT_ID ?? "";

function buildCreateJobErrors(formState: TCreateJobFormState): TCreateJobFormErrors {
  const errors: TCreateJobFormErrors = {};
  const parsedBudget = Number.parseFloat(formState.budget);

  if (!formState.title.trim()) {
    errors.title = "Job title is required.";
  }

  if (!formState.description.trim()) {
    errors.description = "Description is required.";
  }

  if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
    errors.budget = "Budget must be greater than zero.";
  }

  if (!formState.asset.trim()) {
    errors.asset = "Payment asset is required.";
  }

  return errors;
}

export function CreateJobForm({ onCreated }: { onCreated: (jobId: string) => void }) {
  const walletIdentity = useHighrableWalletIdentity();
  const createJob = useMutation(api.jobs.createJob);
  const [formState, setFormState] = useState<TCreateJobFormState>({
    title: "",
    description: "",
    budget: "",
    asset: DEFAULT_STABLECOIN_ASSET,
  });
  const [errors, setErrors] = useState<TCreateJobFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const helperText = useMemo(() => {
    if (DEFAULT_STABLECOIN_ASSET) {
      return "Mock USDC / Stablecoin token contract ID is prefilled from config.";
    }

    return "Use the mock USDC token contract ID after deployment.";
  }, []);

  const updateField = (field: keyof TCreateJobFormState, value: string) => {
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
    setErrors((currentValue) => ({ ...currentValue, [field]: undefined, submit: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!walletIdentity.isConnected || !walletIdentity.walletAddress) {
      setErrors({ submit: "Connect wallet to create a job." });
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
      const createdJobId = await createJob({
        title: formState.title.trim(),
        description: formState.description.trim(),
        budget: Number.parseFloat(formState.budget),
        asset: formState.asset.trim(),
        clientWallet: walletIdentity.walletAddress,
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
        Create off-chain job terms now. Smart contract actions will be enabled in the next phase.
      </p>

      {!walletIdentity.isConnected ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-3">Connect wallet to create a job.</p>
          <WalletConnectTrigger className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 font-medium text-white" />
        </div>
      ) : null}

      {walletIdentity.walletType === "external_wallet" &&
      walletIdentity.isTestnet &&
      walletIdentity.isFunded === false ? (
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
          <input
            id="marketplace-job-title"
            value={formState.title}
            onChange={(event) => updateField("title", event.target.value)}
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
          <textarea
            id="marketplace-job-description"
            value={formState.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FF7003] focus:outline-hidden"
            placeholder="Scope, deliverables, and acceptance criteria"
          />
          {errors.description ? (
            <p className="mt-1 text-xs text-red-600">{errors.description}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="marketplace-job-budget"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Budget
            </label>
            <input
              id="marketplace-job-budget"
              type="number"
              min="0"
              step="0.01"
              value={formState.budget}
              onChange={(event) => updateField("budget", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FF7003] focus:outline-hidden"
              placeholder="500"
            />
            {errors.budget ? <p className="mt-1 text-xs text-red-600">{errors.budget}</p> : null}
          </div>

          <div>
            <label
              htmlFor="marketplace-job-asset"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Payment asset
            </label>
            <input
              id="marketplace-job-asset"
              value={formState.asset}
              onChange={(event) => updateField("asset", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FF7003] focus:outline-hidden"
              placeholder="Mock USDC token contract ID"
            />
            <p className="mt-1 text-xs text-gray-500">{helperText}</p>
            {errors.asset ? <p className="mt-1 text-xs text-red-600">{errors.asset}</p> : null}
          </div>
        </div>

        {errors.submit ? <p className="text-sm text-red-600">{errors.submit}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || !walletIdentity.isConnected}
          className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Create Job"}
        </button>
      </form>
    </section>
  );
}
