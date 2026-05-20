"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { parseHumanAmount } from "@/core/stellar/amounts";
import { formatAssetLabel, shortenContractId } from "@/core/stellar/assets";
import {
  createAndFundOpenEscrowOnChain,
  getTokenBalanceOnChain,
} from "@/core/stellar/escrow-contract";
import { toBytesN32Hash } from "@/core/stellar/hashes";
import {
  getPrimaryEscrowAsset,
  getSupportedEscrowAssets,
  isSupportedEscrowAsset,
  parseEscrowAssetAmount,
  requireSupportedEscrowAsset,
} from "@/core/stellar/payment-assets";
import {
  hasStablecoinConfig,
  stablecoinConfig,
  validateStablecoinConfig,
} from "@/core/stellar/stablecoin-config";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AttachmentUploader } from "@/features/attachments/components";
import { sanitizeMultilineInput, sanitizeSingleLineInput } from "@/features/common";
import {
  getLocalTimezoneLabel,
  parseDatetimeLocalValue,
  toDatetimeLocalValue,
  validateDeadlineTimestamp,
} from "@/features/deadlines";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  analyzeJobScamSignals,
  DISALLOWED_JOB_POST_MESSAGE,
} from "@/features/marketplace/lib/scam-signals";
import { api, type TConvexId } from "@repo/convex-client";
import { DateTimePicker } from "@repo/ui/components/ui-customs/date-time-picker";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { Switch as AppSwitch } from "@repo/ui/components/ui/switch";
import { Textarea as AppTextarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import type { TDraftAttachment } from "@/features/attachments/types";
import type {
  TCreateJobFormErrors,
  TCreateJobFormState,
  TCreateMilestoneFormState,
  TJobType,
  TRevisionPolicy,
} from "@/features/marketplace/types";

const DEFAULT_STABLECOIN_ASSET = getPrimaryEscrowAsset().tokenContractId;
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
  deadlineAt: z.string().transform(sanitizeSingleLineInput).optional(),
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
  deadlineAt: z
    .string()
    .transform(sanitizeSingleLineInput)
    .pipe(z.string().min(1, "Milestone deadline is required.")),
});

type TCreateJobPayload = z.infer<typeof CREATE_JOB_SCHEMA>;
type TCreateMilestonePayload = z.infer<typeof CREATE_MILESTONE_SCHEMA>;
type TParsedMilestonePayload = TCreateMilestonePayload & {
  revisionPolicy: TRevisionPolicy;
  revisionLimit: string;
};

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
    deadlineAt: "",
    revisionPolicy: "fixed",
    revisionLimit: "2",
  };
}

function parseRevisionPolicy(input: {
  revisionPolicy: TRevisionPolicy;
  revisionLimit: string;
}): { revisionPolicy: TRevisionPolicy; revisionLimit: number | null } {
  if (input.revisionPolicy === "none" || input.revisionPolicy === "unlimited") {
    return { revisionPolicy: input.revisionPolicy, revisionLimit: null };
  }

  const limit = Number.parseInt(input.revisionLimit.trim(), 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new Error("Fixed revisions require a limit between 1 and 25.");
  }

  return { revisionPolicy: "fixed", revisionLimit: limit };
}

function RevisionPolicyControls({
  idPrefix,
  revisionPolicy,
  revisionLimit,
  disabled,
  error,
  onPolicyChange,
  onLimitChange,
}: {
  idPrefix: string;
  revisionPolicy: TRevisionPolicy;
  revisionLimit: string;
  disabled?: boolean;
  error?: string;
  onPolicyChange: (policy: TRevisionPolicy) => void;
  onLimitChange: (limit: string) => void;
}) {
  const options: Array<{ value: TRevisionPolicy; label: string }> = [
    { value: "none", label: "No revisions" },
    { value: "fixed", label: "Fixed revisions" },
    { value: "unlimited", label: "Unlimited revisions" },
  ];

  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
      <p className="text-sm font-semibold text-[#0a0a0a]">Revision policy</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onPolicyChange(option.value)}
            className={`rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              revisionPolicy === option.value
                ? "border-[#FF7003] bg-white text-[#0a0a0a]"
                : "border-[#e8e8e8] bg-white text-[#5f5f5f] hover:border-[#FF7003]/50"
            }`}
            aria-pressed={revisionPolicy === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
      {revisionPolicy === "fixed" ? (
        <div className="mt-3 max-w-48">
          <label
            htmlFor={`${idPrefix}-revision-limit`}
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Revision limit
          </label>
          <AppInput
            id={`${idPrefix}-revision-limit`}
            type="number"
            min={1}
            max={25}
            step={1}
            value={revisionLimit}
            disabled={disabled}
            onChange={(event) => onLimitChange(event.target.value)}
          />
        </div>
      ) : null}
      {revisionPolicy === "unlimited" ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Unlimited revisions can delay completion. Use this only when both parties agree on a
          flexible review process.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function buildCreateJobErrors(formState: TCreateJobFormState): TCreateJobFormErrors {
  const errors: TCreateJobFormErrors = {};
  const parsed = CREATE_JOB_SCHEMA.safeParse(formState);

  if (parsed.success) {
    const deadlineAt = parseDatetimeLocalValue(formState.deadlineAt);
    const deadlineError = validateDeadlineTimestamp(deadlineAt);
    if (deadlineError) {
      errors.deadlineAt = deadlineError;
    }
    return errors;
  }

  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (
      field === "title" ||
      field === "description" ||
      field === "budget" ||
      field === "asset" ||
      field === "deadlineAt"
    ) {
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
  }

  return errors;
}

export function CreateJobForm({ onCreated }: { onCreated: (jobId: string) => void }) {
  const { address, isConnected, signTransaction, walletState } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();
  const createJob = useMutation(api.jobs.createJob);
  const createMilestoneProject = useMutation(api.milestones.createMilestoneProject);
  const attachFilesToParent = useMutation(api.attachments.attachFilesToParent);
  const createEscrowRecord = useMutation(api.escrows.createEscrowRecord);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);
  const stablecoinValidation = useMemo(() => validateStablecoinConfig(), []);
  const isStablecoinConfigured = useMemo(() => hasStablecoinConfig(), []);
  const supportedEscrowAssets = useMemo(() => getSupportedEscrowAssets(), []);
  const [formState, setFormState] = useState<TCreateJobFormState>({
    title: "",
    description: "",
    budget: "",
    asset: DEFAULT_STABLECOIN_ASSET,
    deadlineAt: "",
    fundEscrowNow: false,
    jobType: "micro_gig",
    revisionPolicy: "fixed",
    revisionLimit: "2",
    milestones: [
      {
        id: "initial",
        title: "",
        description: "",
        amount: "",
        deadlineAt: "",
        revisionPolicy: "fixed",
        revisionLimit: "2",
      },
    ],
  });
  const isSelectedEscrowAssetSupported = isSupportedEscrowAsset(formState.asset);
  const [errors, setErrors] = useState<TCreateJobFormErrors>({});
  const [draftAttachments, setDraftAttachments] = useState<TDraftAttachment[]>([]);
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
      return `${stablecoinConfig.symbol} escrow is recommended because the job value stays stable (${shortenContractId(
        stablecoinConfig.tokenContractId,
      )}).`;
    }

    return "Enter the stablecoin token contract ID only if you need an off-chain draft before central config is set.";
  }, [isStablecoinConfigured]);

  const isMilestoneProject = formState.jobType === "milestone_project";
  const minimumDeadlineInputValue = toDatetimeLocalValue(Date.now() + 30 * 60 * 1000);
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
    field: "title" | "description" | "budget" | "asset" | "deadlineAt",
    value: string,
  ) => {
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
    setErrors((currentValue) => ({ ...currentValue, [field]: undefined, submit: undefined }));
  };

  const clampDeadlineInputValue = (value: string): string => {
    const timestamp = parseDatetimeLocalValue(value);
    const minimumTimestamp = Date.now() + 30 * 60 * 1000;

    if (timestamp !== null && timestamp < minimumTimestamp) {
      return toDatetimeLocalValue(minimumTimestamp);
    }

    return value;
  };

  const updateJobType = (jobType: TJobType) => {
    setFormState((currentValue) => ({
      ...currentValue,
      jobType,
      fundEscrowNow: jobType === "milestone_project" ? false : currentValue.fundEscrowNow,
    }));
    setErrors({});
  };

  const updateRevisionPolicy = (revisionPolicy: TRevisionPolicy) => {
    setFormState((currentValue) => ({
      ...currentValue,
      revisionPolicy,
      revisionLimit: revisionPolicy === "fixed" ? currentValue.revisionLimit || "2" : "",
    }));
    setErrors((currentValue) => ({
      ...currentValue,
      revisionPolicy: undefined,
      revisionLimit: undefined,
      submit: undefined,
    }));
  };

  const updateRevisionLimit = (revisionLimit: string) => {
    setFormState((currentValue) => ({ ...currentValue, revisionLimit }));
    setErrors((currentValue) => ({ ...currentValue, revisionLimit: undefined, submit: undefined }));
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

  const updateMilestoneRevisionPolicy = (
    milestoneId: string,
    revisionPolicy: TRevisionPolicy,
  ) => {
    setFormState((currentValue) => ({
      ...currentValue,
      milestones: currentValue.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              revisionPolicy,
              revisionLimit: revisionPolicy === "fixed" ? milestone.revisionLimit || "2" : "",
            }
          : milestone,
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

  const parseMilestones = (): TParsedMilestonePayload[] | null => {
    const parsedMilestones: TParsedMilestonePayload[] = [];

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
      const deadlineAt = parseDatetimeLocalValue(parsed.data.deadlineAt);
      const deadlineError = validateDeadlineTimestamp(deadlineAt);
      if (deadlineError) {
        setErrors({ milestones: `Milestone ${index + 1}: ${deadlineError}` });
        return null;
      }
      const previousMilestone = parsedMilestones[index - 1];
      const previousDeadlineAt = previousMilestone
        ? parseDatetimeLocalValue(previousMilestone.deadlineAt)
        : null;
      if (previousDeadlineAt !== null && deadlineAt !== null && deadlineAt < previousDeadlineAt) {
        setErrors({
          milestones: `Milestone ${index + 1} cannot be due before Milestone ${index}.`,
        });
        return null;
      }
      try {
        parseRevisionPolicy({
          revisionPolicy: milestone.revisionPolicy,
          revisionLimit: milestone.revisionLimit,
        });
      } catch (error) {
        setErrors({
          milestones: `Milestone ${index + 1}: ${
            error instanceof Error ? error.message : "Invalid revision policy."
          }`,
        });
        return null;
      }
      parsedMilestones.push({
        ...parsed.data,
        revisionPolicy: milestone.revisionPolicy,
        revisionLimit: milestone.revisionLimit,
      });
    }

    const totalBudget = parsedMilestones.reduce((total, milestone) => total + milestone.amount, 0);
    if (totalBudget <= 0) {
      setErrors({ milestones: "Total project budget must be greater than zero." });
      return null;
    }

    return parsedMilestones;
  };

  const attachDraftAttachmentsToJob = async (jobId: string) => {
    if (!walletIdentity.walletAddress) {
      throw new Error("Missing wallet identity.");
    }

    const attachmentIds = draftAttachments
      .filter((attachment) => attachment.status === "ready")
      .map((attachment) => attachment.id as TConvexId<"attachments">);

    if (attachmentIds.length === 0) {
      return;
    }

    await attachFilesToParent({
      attachmentIds,
      walletAddress: walletIdentity.walletAddress,
      parentType: "job",
      parentId: jobId,
      visibility: "public",
    });
  };

  const attachDraftAttachmentsOrReport = async (jobId: string): Promise<boolean> => {
    try {
      await attachDraftAttachmentsToJob(jobId);
      return true;
    } catch (error) {
      setErrors({
        submit: `Job was created, but attachments could not be linked. ${getReadableErrorMessage(
          error,
          "Please try attaching them again.",
        )}`,
      });
      onCreated(jobId);
      return false;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!walletIdentity.isConnected || !walletIdentity.walletAddress) {
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

    const validationErrors = isMilestoneProject
      ? buildCreateJobErrors({
          ...formState,
          budget: String(parsedMilestoneTotal),
          deadlineAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
      : buildCreateJobErrors(formState);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (draftAttachments.some((attachment) => attachment.status === "uploading")) {
      setErrors({ submit: "Wait for attachment uploads to finish before creating the job." });
      return;
    }

    const failedAttachment = draftAttachments.find((attachment) => attachment.status === "failed");
    if (failedAttachment) {
      setErrors({
        submit: failedAttachment.error ?? "Remove failed attachments before creating the job.",
      });
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
      const selectedEscrowAsset = requireSupportedEscrowAsset(payload.asset);
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
          clientWallet: walletIdentity.walletAddress,
          ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
          milestones: milestones.map((milestone) => ({
            title: milestone.title,
            ...(milestone.description ? { description: milestone.description } : {}),
            requiredOutput: milestone.description || milestone.title,
            amount: milestone.amount,
            deadlineAt: parseDatetimeLocalValue(milestone.deadlineAt)!,
            ...parseRevisionPolicy({
              revisionPolicy: milestone.revisionPolicy,
              revisionLimit: milestone.revisionLimit,
            }),
          })),
        });
        const attachmentsLinked = await attachDraftAttachmentsOrReport(createdJobId);
        if (!attachmentsLinked) {
          return;
        }

        setFormState({
          title: "",
          description: "",
          budget: "",
          asset: DEFAULT_STABLECOIN_ASSET,
          deadlineAt: "",
          fundEscrowNow: false,
          jobType: "micro_gig",
          revisionPolicy: "fixed",
          revisionLimit: "2",
          milestones: [createDraftMilestone()],
        });
        setDraftAttachments([]);
        onCreated(createdJobId);
        return;
      }

      const deadlineAt = parseDatetimeLocalValue(payload.deadlineAt ?? "");
      const deadlineError = validateDeadlineTimestamp(deadlineAt);
      if (deadlineError || deadlineAt === null) {
        setErrors({ deadlineAt: deadlineError ?? "Deadline is required." });
        setIsSubmitting(false);
        return;
      }

      let preFundingConfig: ReturnType<typeof getRequiredEscrowActionConfig> | null = null;
      const jobHash = createClientJobHash();
      let jobHashBytes: Uint8Array | null = null;

      if (formState.fundEscrowNow) {
        if (walletIdentity.walletType === "passkey_smart_account") {
          setErrors({
            submit:
              "Create the job with your passkey smart account, then create and fund escrow from the escrow action panel.",
          });
          setIsSubmitting(false);
          return;
        }

        if (!walletIdentity.canSignEscrowTransactions || !address || !isConnected) {
          setErrors({
            submit: "Connect a Stellar wallet before funding escrow.",
          });
          setIsSubmitting(false);
          return;
        }

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

        const requiredBalance = parseEscrowAssetAmount(selectedEscrowAsset, payload.budget);
        const escrowTokenBalance = await getTokenBalanceOnChain({
          rpcUrl: preFundingConfig.rpcUrl,
          networkPassphrase: preFundingConfig.networkPassphrase,
          tokenContractId: selectedEscrowAsset.tokenContractId,
          sourceAddress: address,
          walletAddress: address,
        });

        if (escrowTokenBalance < requiredBalance) {
          setErrors({
            submit: `You do not have enough ${selectedEscrowAsset.symbol} to pre-fund this escrow.`,
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
        deadlineAt,
        clientWallet: walletIdentity.walletAddress,
        ...parseRevisionPolicy({
          revisionPolicy: formState.revisionPolicy,
          revisionLimit: formState.revisionLimit,
        }),
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        jobHash,
      });
      const attachmentsLinked = await attachDraftAttachmentsOrReport(createdJobId);
      if (!attachmentsLinked) {
        return;
      }

      if (formState.fundEscrowNow && preFundingConfig && jobHashBytes) {
        const clientRequestId = createClientRequestId(createdJobId);
        let confirmedEscrowId: string | null = null;
        let confirmedTxHash: string | null = null;

        await createTransaction({
          walletAddress: address!,
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
            sourceAddress: address!,
            signTransaction,
            client: address!,
            asset: selectedEscrowAsset.tokenContractId,
            amount: payload.budget,
            assetDecimals: selectedEscrowAsset.decimals,
            jobHash: jobHashBytes,
          });
          confirmedEscrowId = result.escrowId;
          confirmedTxHash = result.txHash;

          await createEscrowRecord({
            jobId: createdJobId,
            escrowId: result.escrowId,
            clientWallet: address!,
            amount: payload.budget,
            asset: selectedEscrowAsset.tokenContractId,
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
        deadlineAt: "",
        fundEscrowNow: false,
        jobType: "micro_gig",
        revisionPolicy: "fixed",
        revisionLimit: "2",
        milestones: [createDraftMilestone()],
      });
      setDraftAttachments([]);
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

      {!walletIdentity.isConnected ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-3">
            Connect an external wallet or passkey smart account to create a job.
          </p>
          <WalletConnectTrigger className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 font-medium text-white" />
        </div>
      ) : null}

      {walletIdentity.walletType === "passkey_smart_account" ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Passkey smart account connected. Escrow signing is enabled with passkey from the escrow
          action panel after the job is created.
        </p>
      ) : null}

      {walletIdentity.walletType === "external_wallet" &&
      walletState.isTestnet &&
      walletState.isFunded === false ? (
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
              <span className="block text-sm font-semibold text-[#0a0a0a]">Milestone Project</span>
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

          {!isMilestoneProject ? (
            <div>
              <label
                htmlFor="marketplace-job-deadline"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Deadline
              </label>
              <DateTimePicker
                id="marketplace-job-deadline"
                min={minimumDeadlineInputValue}
                value={formState.deadlineAt}
                onValueChange={(value) => updateField("deadlineAt", clampDeadlineInputValue(value))}
              />
              <p className="mt-1 font-mono text-xs text-gray-500">
                Stored in UTC. Displayed in {getLocalTimezoneLabel()}.
              </p>
              {errors.deadlineAt ? (
                <p className="mt-1 text-xs text-red-600">{errors.deadlineAt}</p>
              ) : null}
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
              <div className="space-y-3">
                <div className="grid gap-3">
                  {supportedEscrowAssets.map((asset) => {
                    const isSelected = formState.asset === asset.tokenContractId;
                    const isDisabled = !asset.isConfigured;

                    return (
                      <button
                        key={asset.kind}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => updateField("asset", asset.tokenContractId)}
                        className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          isSelected
                            ? "border-[#FF7003] bg-white"
                            : "border-gray-300 bg-gray-50 hover:border-[#FF7003]/50"
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[#0a0a0a]">{asset.displayName}</span>
                          {asset.isPrimary ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              Recommended
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Advanced
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-sm text-[#5f5f5f]">
                          {asset.kind === "stablecoin"
                            ? "Recommended. Stable job value for freelance escrow."
                            : asset.isConfigured
                              ? "Advanced. Job value may fluctuate with XLM market price."
                              : "XLM escrow is not configured for this deployment."}
                        </span>
                        {asset.kind === "native_xlm" && asset.isConfigured ? (
                          <span className="mt-1 block text-xs text-amber-800">
                            XLM escrow is available, but the job value may fluctuate.
                          </span>
                        ) : null}
                        {asset.tokenContractId ? (
                          <span className="mt-1 block font-mono text-xs break-all text-[#5f5f5f]">
                            {asset.tokenContractId}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
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

        {!isMilestoneProject ? (
          <RevisionPolicyControls
            idPrefix="micro-gig"
            revisionPolicy={formState.revisionPolicy}
            revisionLimit={formState.revisionLimit}
            disabled={isSubmitting}
            error={errors.revisionPolicy ?? errors.revisionLimit}
            onPolicyChange={updateRevisionPolicy}
            onLimitChange={updateRevisionLimit}
          />
        ) : null}

        <AttachmentUploader
          value={draftAttachments}
          onChange={setDraftAttachments}
          disabled={isSubmitting}
        />

        {isMilestoneProject ? (
          <div className="space-y-4 rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0a0a0a]">Milestones</h3>
                <p className="mt-1 text-sm text-[#5f5f5f]">
                  Define each deliverable and payment. Funding happens later per assigned milestone.
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
                  <div className="mt-3">
                    <label
                      htmlFor={`milestone-deadline-${milestone.id}`}
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Deadline
                    </label>
                    <DateTimePicker
                      id={`milestone-deadline-${milestone.id}`}
                      min={minimumDeadlineInputValue}
                      value={milestone.deadlineAt}
                      onValueChange={(value) =>
                        updateMilestone(milestone.id, "deadlineAt", clampDeadlineInputValue(value))
                      }
                    />
                    <p className="mt-1 font-mono text-xs text-gray-500">
                      {getLocalTimezoneLabel()}
                    </p>
                  </div>
                  <div className="mt-3">
                    <RevisionPolicyControls
                      idPrefix={`milestone-${milestone.id}`}
                      revisionPolicy={milestone.revisionPolicy}
                      revisionLimit={milestone.revisionLimit}
                      disabled={isSubmitting}
                      onPolicyChange={(policy) =>
                        updateMilestoneRevisionPolicy(milestone.id, policy)
                      }
                      onLimitChange={(limit) =>
                        updateMilestone(milestone.id, "revisionLimit", limit)
                      }
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
            {errors.milestones ? <p className="text-sm text-red-600">{errors.milestones}</p> : null}
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
                disabled={
                  !isSelectedEscrowAssetSupported ||
                  !walletIdentity.canSignEscrowTransactions ||
                  walletIdentity.walletType === "passkey_smart_account" ||
                  isSubmitting
                }
                aria-label="Create and fund escrow when posting this job"
              />
            </div>
            {walletIdentity.walletType === "passkey_smart_account" ? (
              <p className="mt-3 text-xs text-amber-700">
                Passkey smart accounts create and fund escrow after posting so role checks use the
                smart account address consistently.
              </p>
            ) : null}
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
          disabled={isSubmitting || !walletIdentity.isConnected}
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
