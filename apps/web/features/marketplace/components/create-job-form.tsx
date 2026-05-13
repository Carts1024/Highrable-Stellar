"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { parseHumanAmount, toTokenAmount } from "@/core/stellar/amounts";
import { formatAssetLabel, shortenContractId } from "@/core/stellar/assets";
import {
  createAndFundOpenEscrowOnChain,
  getStablecoinBalanceOnChain,
} from "@/core/stellar/escrow-contract";
import { toBytesN32Hash } from "@/core/stellar/hashes";
import {
  hasStablecoinConfig,
  stablecoinConfig,
  validateStablecoinConfig,
} from "@/core/stellar/stablecoin-config";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { sanitizeMultilineInput, sanitizeSingleLineInput } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  analyzeJobScamSignals,
  DISALLOWED_JOB_POST_MESSAGE,
} from "@/features/marketplace/lib/scam-signals";
import { api } from "@repo/convex-client";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { Switch as AppSwitch } from "@repo/ui/components/ui/switch";
import { Textarea as AppTextarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import type {
  TCreateJobFormErrors,
  TCreateJobFormState,
  TCreateMilestoneFormState,
  TJobType,
} from "@/features/marketplace/types";

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

const CREATE_MILESTONE_SCHEMA = z.object({
  title: z
    .string()
    .transform(sanitizeSingleLineInput)
    .pipe(z.string().min(2, "Milestone title is required."))
    .pipe(z.string().max(120, "Milestone title must be under 120 characters.")),
  description: z
    .string()
    .transform(sanitizeMultilineInput)
    .pipe(z.string().max(1200, "Milestone description must be under 1200 characters.")),
  amount: z
    .string()
    .transform(sanitizeSingleLineInput)
    .pipe(z.string().min(1, "Milestone amount is required."))
    .transform((value) => Number(parseHumanAmount(value)))
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "Milestone amount must be greater than zero.",
    })
    .refine((value) => value <= MAX_HUMAN_BUDGET, {
      message: "Milestone amount exceeds the allowed range.",
    }),
});

type TCreateJobPayload = z.infer<typeof CREATE_JOB_SCHEMA>;
type TCreateMilestonePayload = z.infer<typeof CREATE_MILESTONE_SCHEMA>;

function createClientJobHash(): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `job_${uniqueId}`;
}

function createClientRequestId(jobId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `create_and_fund_open_escrow:${jobId}:${uniqueId}`;
}

function createDraftMilestone(): TCreateMilestoneFormState {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id: uniqueId,
    title: "",
    description: "",
    amount: "",
  };
}

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
  const { address, isConnected, signTransaction, walletState } = useWallet();
  const createJob = useMutation(api.jobs.createJob);
  const createMilestoneProject = useMutation(api.milestones.createMilestoneProject);
  const createEscrowRecord = useMutation(api.escrows.createEscrowRecord);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);
  const stablecoinValidation = useMemo(() => validateStablecoinConfig(), []);
  const isStablecoinConfigured = useMemo(() => hasStablecoinConfig(), []);
  const [formState, setFormState] = useState<TCreateJobFormState>({
    title: "",
    description: "",
    budget: "",
    asset: DEFAULT_STABLECOIN_ASSET,
    fundEscrowNow: false,
    jobType: "micro_gig",
    milestones: [
      {
        id: "initial",
        title: "",
        description: "",
        amount: "",
      },
    ],
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

  const isMilestoneProject = formState.jobType === "milestone_project";
  const parsedMilestoneTotal = useMemo(() => {
    return formState.milestones.reduce((total, milestone) => {
      const amount = Number(parseHumanAmount(milestone.amount || "0"));
      return Number.isFinite(amount) ? total + amount : total;
    }, 0);
  }, [formState.milestones]);

  const budgetHelperText = isMilestoneProject
    ? "Project budget is calculated from milestone amounts."
    : "This amount will be locked in Stellar escrow after the client funds the contract.";

  const updateField = (
    field: "title" | "description" | "budget" | "asset",
    value: string,
  ) => {
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
    setErrors((currentValue) => ({ ...currentValue, [field]: undefined, submit: undefined }));
  };

  const updateJobType = (jobType: TJobType) => {
    setFormState((currentValue) => ({
      ...currentValue,
      jobType,
      fundEscrowNow: jobType === "milestone_project" ? false : currentValue.fundEscrowNow,
    }));
    setErrors({});
  };

  const updateFundEscrowNow = (value: boolean) => {
    setFormState((currentValue) => ({ ...currentValue, fundEscrowNow: value }));
    setErrors((currentValue) => ({ ...currentValue, submit: undefined }));
  };

  const updateMilestone = (
    milestoneId: string,
    field: keyof Omit<TCreateMilestoneFormState, "id">,
    value: string,
  ) => {
    setFormState((currentValue) => ({
      ...currentValue,
      milestones: currentValue.milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, [field]: value } : milestone,
      ),
    }));
    setErrors((currentValue) => ({ ...currentValue, milestones: undefined, submit: undefined }));
  };

  const addMilestone = () => {
    setFormState((currentValue) => ({
      ...currentValue,
      milestones: [...currentValue.milestones, createDraftMilestone()],
    }));
  };

  const removeMilestone = (milestoneId: string) => {
    setFormState((currentValue) => ({
      ...currentValue,
      milestones:
        currentValue.milestones.length > 1
          ? currentValue.milestones.filter((milestone) => milestone.id !== milestoneId)
          : currentValue.milestones,
    }));
  };

  const parseMilestones = (): TCreateMilestonePayload[] | null => {
    const parsedMilestones: TCreateMilestonePayload[] = [];

    if (formState.milestones.length < 1) {
      setErrors({ milestones: "At least one milestone is required." });
      return null;
    }

    for (const [index, milestone] of formState.milestones.entries()) {
      const parsed = CREATE_MILESTONE_SCHEMA.safeParse(milestone);
      if (!parsed.success) {
        setErrors({
          milestones: `Milestone ${index + 1}: ${parsed.error.issues[0]?.message ?? "Invalid milestone."}`,
        });
        return null;
      }
      parsedMilestones.push(parsed.data);
    }

    const totalBudget = parsedMilestones.reduce((total, milestone) => total + milestone.amount, 0);
    if (totalBudget <= 0) {
      setErrors({ milestones: "Total project budget must be greater than zero." });
      return null;
    }

    return parsedMilestones;
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

    const validationErrors = buildCreateJobErrors({
      ...formState,
      budget: isMilestoneProject ? String(parsedMilestoneTotal) : formState.budget,
    });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const parsed = CREATE_JOB_SCHEMA.safeParse({
        ...formState,
        budget: isMilestoneProject ? String(parsedMilestoneTotal) : formState.budget,
      });
      if (!parsed.success) {
        setErrors(
          buildCreateJobErrors({
            ...formState,
            budget: isMilestoneProject ? String(parsedMilestoneTotal) : formState.budget,
          }),
        );
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

      if (isMilestoneProject) {
        const milestones = parseMilestones();
        if (!milestones) {
          setIsSubmitting(false);
          return;
        }

        const createdJobId = await createMilestoneProject({
          title: payload.title,
          description: payload.description,
          asset: payload.asset,
          clientWallet: address,
          milestones: milestones.map((milestone) => ({
            title: milestone.title,
            ...(milestone.description ? { description: milestone.description } : {}),
            amount: milestone.amount,
          })),
        });

        setFormState({
          title: "",
          description: "",
          budget: "",
          asset: DEFAULT_STABLECOIN_ASSET,
          fundEscrowNow: false,
          jobType: "micro_gig",
          milestones: [createDraftMilestone()],
        });
        onCreated(createdJobId);
        return;
      }

      let preFundingConfig: ReturnType<typeof getRequiredEscrowActionConfig> | null = null;
      const jobHash = createClientJobHash();
      let jobHashBytes: Uint8Array | null = null;

      if (formState.fundEscrowNow) {
        if (!walletState.isTestnet) {
          setErrors({ submit: "Switch your wallet to Stellar Testnet before funding escrow." });
          setIsSubmitting(false);
          return;
        }

        if (walletState.isFunded === false) {
          setErrors({
            submit: "Fund your Stellar testnet account with Friendbot before funding escrow.",
          });
          setIsSubmitting(false);
          return;
        }

        if (walletState.canWriteContracts === false) {
          setErrors({
            submit: "This wallet can view jobs but cannot sign escrow contract actions right now.",
          });
          setIsSubmitting(false);
          return;
        }

        preFundingConfig = getRequiredEscrowActionConfig();

        if (payload.asset !== preFundingConfig.stablecoinTokenContractId) {
          setErrors({
            submit:
              "This job's payment asset must match the configured stablecoin to pre-fund escrow.",
          });
          setIsSubmitting(false);
          return;
        }

        const requiredBalance = toTokenAmount(payload.budget);
        const stablecoinBalance = await getStablecoinBalanceOnChain({
          rpcUrl: preFundingConfig.rpcUrl,
          networkPassphrase: preFundingConfig.networkPassphrase,
          stablecoinTokenContractId: preFundingConfig.stablecoinTokenContractId,
          sourceAddress: address,
          walletAddress: address,
        });

        if (stablecoinBalance < requiredBalance) {
          setErrors({
            submit: `You do not have enough ${stablecoinConfig.symbol} to pre-fund this escrow.`,
          });
          setIsSubmitting(false);
          return;
        }

        jobHashBytes = await toBytesN32Hash(jobHash);
      }

      const createdJobId = await createJob({
        title: payload.title,
        description: payload.description,
        budget: payload.budget,
        asset: payload.asset,
        clientWallet: address,
        jobHash,
      });

      if (formState.fundEscrowNow && preFundingConfig && jobHashBytes) {
        const clientRequestId = createClientRequestId(createdJobId);
        let confirmedEscrowId: string | null = null;
        let confirmedTxHash: string | null = null;

        await createTransaction({
          walletAddress: address,
          type: "create_escrow",
          clientRequestId,
          jobId: createdJobId,
          status: "pending",
        });

        try {
          const result = await createAndFundOpenEscrowOnChain({
            rpcUrl: preFundingConfig.rpcUrl,
            networkPassphrase: preFundingConfig.networkPassphrase,
            escrowContractId: preFundingConfig.escrowContractId,
            sourceAddress: address,
            signTransaction,
            client: address,
            asset: preFundingConfig.stablecoinTokenContractId,
            amount: payload.budget,
            jobHash: jobHashBytes,
          });
          confirmedEscrowId = result.escrowId;
          confirmedTxHash = result.txHash;

          await createEscrowRecord({
            jobId: createdJobId,
            escrowId: result.escrowId,
            clientWallet: address,
            amount: payload.budget,
            asset: preFundingConfig.stablecoinTokenContractId,
            status: "funded",
            createTxHash: result.txHash,
            fundTxHash: result.txHash,
          });

          await updateTransactionStatus({
            clientRequestId,
            txHash: result.txHash,
            status: "success",
          });
        } catch (error) {
          const errorMessage = normalizeStellarError(error);
          const failedTxHash =
            typeof error === "object" &&
            error !== null &&
            "txHash" in error &&
            typeof error.txHash === "string"
              ? error.txHash
              : confirmedTxHash || undefined;

          await updateTransactionStatus({
            clientRequestId,
            ...(failedTxHash ? { txHash: failedTxHash } : {}),
            status: "failed",
            errorMessage,
          });

          setErrors({
            submit: confirmedEscrowId
              ? `Job was posted and escrow #${confirmedEscrowId} was funded on Stellar, but the local escrow record could not be saved. Transaction: ${confirmedTxHash}. ${errorMessage}`
              : `Job was posted, but escrow funding failed. ${errorMessage}`,
          });
          onCreated(createdJobId);
          return;
        }
      }

      setFormState({
        title: "",
        description: "",
        budget: "",
        asset: DEFAULT_STABLECOIN_ASSET,
        fundEscrowNow: false,
        jobType: "micro_gig",
        milestones: [createDraftMilestone()],
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
        <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
          <p className="text-sm font-semibold text-[#0a0a0a]">Work mode</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => updateJobType("micro_gig")}
              className={`rounded-lg border p-4 text-left transition-colors ${
                formState.jobType === "micro_gig"
                  ? "border-[#FF7003] bg-white"
                  : "border-[#e8e8e8] bg-white hover:border-[#FF7003]/50"
              }`}
              aria-pressed={formState.jobType === "micro_gig"}
            >
              <span className="block text-sm font-semibold text-[#0a0a0a]">Micro Gig</span>
              <span className="mt-1 block text-sm text-[#5f5f5f]">
                Best for small tasks with one freelancer and one payout.
              </span>
            </button>
            <button
              type="button"
              onClick={() => updateJobType("milestone_project")}
              className={`rounded-lg border p-4 text-left transition-colors ${
                formState.jobType === "milestone_project"
                  ? "border-[#FF7003] bg-white"
                  : "border-[#e8e8e8] bg-white hover:border-[#FF7003]/50"
              }`}
              aria-pressed={formState.jobType === "milestone_project"}
            >
              <span className="block text-sm font-semibold text-[#0a0a0a]">
                Milestone Project
              </span>
              <span className="mt-1 block text-sm text-[#5f5f5f]">
                Best for larger projects split into separate deliverables and payments.
              </span>
            </button>
          </div>
        </div>

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
          <Alert
            variant={scamAnalysis.isBlocked ? "destructive" : "default"}
            className={`rounded-xl border p-3 text-sm ${
              scamAnalysis.isBlocked
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
            role={scamAnalysis.isBlocked ? "alert" : "note"}
          >
            <AlertTitle>
              {scamAnalysis.isBlocked
                ? DISALLOWED_JOB_POST_MESSAGE
                : "This job post contains language that may look suspicious to freelancers."}
            </AlertTitle>
            <AlertDescription>
              {!scamAnalysis.isBlocked ? (
                <p>
                  This job may look suspicious because it asks users to move off-platform or pay
                  upfront.
                </p>
              ) : null}
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {scamAnalysis.signals.map((signal) => (
                  <li key={signal.type}>{signal.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className={`grid gap-4 ${isMilestoneProject ? "" : "sm:grid-cols-2"}`}>
          {!isMilestoneProject ? (
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
          ) : null}

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

        {isMilestoneProject ? (
          <div className="space-y-4 rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0a0a0a]">Milestones</h3>
                <p className="mt-1 text-sm text-[#5f5f5f]">
                  Define each deliverable and payment. Funding happens later per assigned
                  milestone.
                </p>
              </div>
              <AppButton type="button" variant="secondary" onClick={addMilestone} className="gap-2">
                <Plus className="h-4 w-4" />
                Add milestone
              </AppButton>
            </div>

            <div className="space-y-4">
              {formState.milestones.map((milestone, index) => (
                <div key={milestone.id} className="rounded-lg border border-[#e8e8e8] bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#0a0a0a]">Milestone {index + 1}</p>
                    <AppButton
                      type="button"
                      variant="secondary"
                      disabled={formState.milestones.length === 1}
                      onClick={() => removeMilestone(milestone.id)}
                      className="h-8 gap-2 px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </AppButton>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <div>
                      <label
                        htmlFor={`milestone-title-${milestone.id}`}
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Title
                      </label>
                      <AppInput
                        id={`milestone-title-${milestone.id}`}
                        value={milestone.title}
                        maxLength={140}
                        onChange={(event) =>
                          updateMilestone(milestone.id, "title", event.target.value)
                        }
                        placeholder="Design landing page"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`milestone-amount-${milestone.id}`}
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Amount
                      </label>
                      <AppInput
                        id={`milestone-amount-${milestone.id}`}
                        value={milestone.amount}
                        type="text"
                        inputMode="decimal"
                        onChange={(event) =>
                          updateMilestone(milestone.id, "amount", event.target.value)
                        }
                        placeholder="50"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label
                      htmlFor={`milestone-description-${milestone.id}`}
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Description
                    </label>
                    <AppTextarea
                      id={`milestone-description-${milestone.id}`}
                      value={milestone.description}
                      rows={3}
                      maxLength={1200}
                      onChange={(event) =>
                        updateMilestone(milestone.id, "description", event.target.value)
                      }
                      placeholder="Deliverable details and acceptance criteria"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-[#e8e8e8] bg-white p-3 text-sm">
              <span className="font-medium text-[#0a0a0a]">Total project budget:</span>{" "}
              {parsedMilestoneTotal.toLocaleString(undefined, {
                maximumFractionDigits: 7,
              })}{" "}
              {formatAssetLabel(formState.asset)}
            </div>
            {errors.milestones ? (
              <p className="text-sm text-red-600">{errors.milestones}</p>
            ) : null}
          </div>
        ) : null}

        {!isMilestoneProject ? (
          <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <label
                htmlFor="fund-escrow-now"
                className="block text-sm font-semibold text-[#0a0a0a]"
              >
                Create and fund escrow now
              </label>
              <p className="mt-1 text-sm text-[#5f5f5f]">
                Lock the full budget in Stellar escrow while the job is still open for applicants.
              </p>
            </div>
            <AppSwitch
              id="fund-escrow-now"
              checked={formState.fundEscrowNow}
              onCheckedChange={updateFundEscrowNow}
              disabled={!isStablecoinConfigured || !isConnected || isSubmitting}
              aria-label="Create and fund escrow when posting this job"
            />
          </div>
          {formState.fundEscrowNow ? (
            <p className="mt-3 text-xs text-[#5f5f5f]">
              Your wallet will sign one atomic Soroban transaction after the job is created.
            </p>
          ) : null}
        </div>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Milestone projects are not funded upfront. Assign and fund each milestone separately
            after applications arrive.
          </p>
        )}

        {errors.submit ? <p className="text-sm text-red-600">{errors.submit}</p> : null}

        <AppButton
          type="submit"
          disabled={isSubmitting || !isConnected}
          className="disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? formState.fundEscrowNow
              ? "Posting and Funding..."
              : "Submitting..."
            : formState.fundEscrowNow
              ? "Create Job and Fund Escrow"
              : isMilestoneProject
                ? "Create Milestone Project"
                : "Create Job"}
        </AppButton>
      </form>
    </section>
  );
}
