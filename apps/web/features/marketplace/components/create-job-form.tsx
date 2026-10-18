"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { parseHumanAmount } from "@/core/stellar/amounts";
import { formatAssetLabel, shortenContractId } from "@/core/stellar/assets";
import { XlmToUsdcTopUpPanel } from "@/core/stellar/components/xlm-to-usdc-top-up-panel";
import { getTokenBalanceOnChain } from "@/core/stellar/escrow-contract";
import { toBytesN32Hash } from "@/core/stellar/hashes";
import { useStablecoinReadiness } from "@/core/stellar/hooks/use-stablecoin-readiness";
import {
  getEscrowAssetByContractId,
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
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { getWalletNetworkMismatchMessage, isWalletOnConfiguredNetwork } from "@/core/wallet/config";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AttachmentUploader } from "@/features/attachments/components";
import {
  FormStepNav,
  FormStepPanel,
  FormStepTabs,
  sanitizeMultilineInput,
  sanitizeSingleLineInput,
  showErrorToast,
  showSuccessToast,
  showWarningToast,
  TermHint,
} from "@/features/common";
import {
  getLocalTimezoneLabel,
  parseDatetimeLocalValue,
  toDatetimeLocalValue,
  validateDeadlineTimestamp,
} from "@/features/deadlines";
import { EscrowActionProgress } from "@/features/marketplace/components/escrow-action-progress";
import { runAtomicOpenEscrowPosting } from "@/features/marketplace/lib/atomic-escrow-posting";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  analyzeJobScamSignals,
  DISALLOWED_JOB_POST_MESSAGE,
} from "@/features/marketplace/lib/scam-signals";
import { api, type TConvexId } from "@repo/convex-client";
import {
  HighrableV2Badge,
  HighrableV2IconNotice,
} from "@repo/ui/components/highrable/v2-marketing";
import { DateTimePicker } from "@repo/ui/components/ui-customs/date-time-picker";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Switch as AppSwitch } from "@repo/ui/components/ui/switch";
import { Textarea as AppTextarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import { Layers, Plus, Trash2, Zap } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import type { TDraftAttachment } from "@/features/attachments/types";
import type { IFormStep } from "@/features/common";
import type {
  TCreateJobFormErrors,
  TCreateJobFormState,
  TCreateMilestoneFormState,
  TJobType,
  TMarketplaceEscrowProgress,
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
    .pipe(z.string().min(3, "Payment currency is required."))
    .pipe(z.string().max(255, "Payment currency is too long.")),
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

function createClientRequestId(action: "create_escrow", jobId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${action}:${jobId}:${uniqueId}`;
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

function parseRevisionPolicy(input: { revisionPolicy: TRevisionPolicy; revisionLimit: string }): {
  revisionPolicy: TRevisionPolicy;
  revisionLimit: number | null;
} {
  if (input.revisionPolicy === "none" || input.revisionPolicy === "unlimited") {
    return { revisionPolicy: input.revisionPolicy, revisionLimit: null };
  }

  const limit = Number.parseInt(input.revisionLimit.trim(), 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new Error("Fixed revisions require a limit between 1 and 25.");
  }

  return { revisionPolicy: "fixed", revisionLimit: limit };
}

function hasPositiveBudget(value: string): boolean {
  try {
    const amount = Number(parseHumanAmount(value || "0"));
    return Number.isFinite(amount) && amount > 0;
  } catch {
    return false;
  }
}

// Step tabs

const CREATE_JOB_ID_PREFIX = "create-job";

const CREATE_JOB_STEPS: readonly IFormStep[] = [
  {
    id: "type",
    title: "Job Type",
    hint: "Choose whether this is one quick task or a bigger project.",
  },
  {
    id: "details",
    title: "Describe the Work",
    hint: "Tell freelancers what you need, so they can decide if it fits them.",
  },
  {
    id: "pay",
    title: "Budget & Payment",
    hint: "Set how much you will pay, when it is due, and in which currency.",
  },
  {
    id: "review",
    title: "Review & Post",
    hint: "Check everything, then decide how to secure the payment.",
  },
] as const;

/** Which step each validation error belongs to, so a failed submit can jump to the right tab. */
function getStepIndexForErrorKey(key: keyof TCreateJobFormErrors): number {
  switch (key) {
    case "title":
    case "description":
    case "revisionPolicy":
    case "revisionLimit":
      return 1;
    case "budget":
    case "asset":
    case "deadlineAt":
    case "milestones":
      return 2;
    default:
      return 3;
  }
}

function getErrorStepIndexes(errors: TCreateJobFormErrors): Set<number> {
  const indexes = new Set<number>();
  for (const key of Object.keys(errors) as (keyof TCreateJobFormErrors)[]) {
    if (errors[key]) {
      indexes.add(getStepIndexForErrorKey(key));
    }
  }
  return indexes;
}

// Sub-components

/** Thin labelled divider used as a section header */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-2 w-2 bg-highrable-text-accent" />
      <span className="font-mono text-sm font-semibold tracking-widest whitespace-nowrap text-highrable-text-accent uppercase">
        {label}
      </span>
    </div>
  );
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
    { value: "none", label: "No Revisions" },
    { value: "fixed", label: "Fixed Revisions" },
    { value: "unlimited", label: "Unlimited Revisions" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onPolicyChange(option.value)}
            className={`rounded-lg border px-4 py-2.5 text-left font-sans text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              revisionPolicy === option.value
                ? "border-highrable-orange-3 bg-highrable-orange-2 text-[var(--mode-on)]"
                : "border-border bg-card text-muted-foreground hover:border-highrable-orange-2/50"
            }`}
            aria-pressed={revisionPolicy === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
      {revisionPolicy === "fixed" ? (
        <div className="max-w-40">
          <Label htmlFor={`${idPrefix}-revision-limit`}>Revision limit</Label>
          <AppInput
            id={`${idPrefix}-revision-limit`}
            type="number"
            min={1}
            max={25}
            step={1}
            value={revisionLimit}
            disabled={disabled}
            className="mt-1.5"
            onChange={(event) => onLimitChange(event.target.value)}
          />
        </div>
      ) : null}
      {revisionPolicy === "unlimited" ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-2 px-4 font-sans text-sm text-amber-800">
          Unlimited revisions can delay completion. Use this only when both parties agree on a
          flexible review process.
        </div>
      ) : null}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
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

// Main component

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
  const selectedEscrowAssetMeta = useMemo(
    () => getEscrowAssetByContractId(formState.asset),
    [formState.asset],
  );
  const [errors, setErrors] = useState<TCreateJobFormErrors>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [draftAttachments, setDraftAttachments] = useState<TDraftAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgressRef = useRef(false);
  const [escrowProgress, setEscrowProgress] = useState<TMarketplaceEscrowProgress | null>(null);
  const progressContextKey = `${walletIdentity.walletAddress ?? ""}:${walletIdentity.walletType ?? ""}:${walletIdentity.isConnected}:${walletIdentity.canSignEscrowTransactions}:${walletState.isTestnet}:${walletState.isFunded}:${walletState.canWriteContracts}`;
  const progressContextRef = useRef(progressContextKey);
  const progressGenerationRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (progressContextRef.current !== progressContextKey) {
      progressGenerationRef.current += 1;
    }
    progressContextRef.current = progressContextKey;
    setEscrowProgress(null);
  }, [progressContextKey]);
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

    return "Enter the digital dollar token contract ID only if you need an off-chain draft before central config is set.";
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
    : "This amount will be held safely after the client pays.";
  const shouldShowStablecoinFundingReadiness =
    !isMilestoneProject &&
    hasPositiveBudget(formState.budget) &&
    selectedEscrowAssetMeta?.kind === "stablecoin" &&
    walletIdentity.isConnected &&
    walletIdentity.canSignEscrowTransactions &&
    (walletIdentity.walletType === "passkey_smart_account" ||
      isWalletOnConfiguredNetwork(walletState));
  const preFundReadiness = useStablecoinReadiness({
    walletAddress: walletIdentity.walletAddress,
    requiredAmount: formState.budget,
    tokenContractId: formState.asset || stablecoinConfig.tokenContractId,
    asset: selectedEscrowAssetMeta ?? undefined,
    enabled: shouldShowStablecoinFundingReadiness,
  });
  const shouldShowXlmToUsdcTopUp =
    !isMilestoneProject &&
    selectedEscrowAssetMeta?.kind === "stablecoin" &&
    shouldShowStablecoinFundingReadiness &&
    (preFundReadiness.hasSufficientBalance === false || preFundReadiness.error !== null);
  const xlmToUsdcMissingAmount = preFundReadiness.deficitDisplay ?? formState.budget;

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

  const updateMilestoneRevisionPolicy = (milestoneId: string, revisionPolicy: TRevisionPolicy) => {
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

  const getFirstFormError = (formErrors: TCreateJobFormErrors): string | null => {
    return (
      Object.values(formErrors).find(
        (formError): formError is string =>
          typeof formError === "string" && formError.trim().length > 0,
      ) ?? null
    );
  };

  const setFormWarning = (formErrors: TCreateJobFormErrors) => {
    setErrors(formErrors);
    const errorSteps = [...getErrorStepIndexes(formErrors)].sort((a, b) => a - b);
    if (errorSteps.length > 0) {
      setStepIndex(errorSteps[0] ?? 0);
    }
    const firstError = getFirstFormError(formErrors);
    if (firstError) {
      showWarningToast(firstError);
    }
  };

  const parseMilestones = (): TParsedMilestonePayload[] | null => {
    const parsedMilestones: TParsedMilestonePayload[] = [];

    if (formState.milestones.length < 1) {
      setFormWarning({ milestones: "At least one milestone is required." });
      return null;
    }

    for (const [index, milestone] of formState.milestones.entries()) {
      const parsed = CREATE_MILESTONE_SCHEMA.safeParse(milestone);
      if (!parsed.success) {
        setFormWarning({
          milestones: `Milestone ${index + 1}: ${parsed.error.issues[0]?.message ?? "Invalid milestone."}`,
        });
        return null;
      }
      const deadlineAt = parseDatetimeLocalValue(parsed.data.deadlineAt);
      const deadlineError = validateDeadlineTimestamp(deadlineAt);
      if (deadlineError) {
        setFormWarning({ milestones: `Milestone ${index + 1}: ${deadlineError}` });
        return null;
      }
      const previousMilestone = parsedMilestones[index - 1];
      const previousDeadlineAt = previousMilestone
        ? parseDatetimeLocalValue(previousMilestone.deadlineAt)
        : null;
      if (previousDeadlineAt !== null && deadlineAt !== null && deadlineAt < previousDeadlineAt) {
        setFormWarning({
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
        setFormWarning({
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
      setFormWarning({ milestones: "Total project budget must be greater than zero." });
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
      const nextError = `Job was created, but attachments could not be linked. ${getReadableErrorMessage(
        error,
        "Please try attaching them again.",
      )}`;
      setErrors({
        submit: nextError,
      });
      showErrorToast(nextError);
      onCreated(jobId);
      return false;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitInProgressRef.current) {
      return;
    }

    if (!walletIdentity.isConnected || !walletIdentity.walletAddress) {
      setFormWarning({ submit: "Connect wallet to create a job." });
      return;
    }

    if (!isStablecoinConfigured && !formState.asset.trim()) {
      setFormWarning({
        asset:
          stablecoinValidation.message ??
          "Payment currency is required until digital dollar configuration is set.",
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
      setFormWarning(validationErrors);
      return;
    }

    if (draftAttachments.some((attachment) => attachment.status === "uploading")) {
      setFormWarning({ submit: "Wait for attachment uploads to finish before creating the job." });
      return;
    }

    const failedAttachment = draftAttachments.find((attachment) => attachment.status === "failed");
    if (failedAttachment) {
      setFormWarning({
        submit: failedAttachment.error ?? "Remove failed attachments before creating the job.",
      });
      return;
    }

    submitInProgressRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    setEscrowProgress(formState.fundEscrowNow ? "preparing" : null);
    const actionContextKey = progressContextRef.current;
    const actionProgressGeneration = progressGenerationRef.current;
    const reportEscrowProgress = (progress: TMarketplaceEscrowProgress | null) => {
      if (
        mountedRef.current &&
        progressContextRef.current === actionContextKey &&
        progressGenerationRef.current === actionProgressGeneration
      ) {
        setEscrowProgress(progress);
      }
    };

    try {
      const parsed = CREATE_JOB_SCHEMA.safeParse({
        ...formState,
        budget: isMilestoneProject ? String(parsedMilestoneTotal) : formState.budget,
      });
      if (!parsed.success) {
        setFormWarning(
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
        setFormWarning({ submit: DISALLOWED_JOB_POST_MESSAGE });
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
        showSuccessToast(`Job "${payload.title}" created.`);
        onCreated(createdJobId);
        return;
      }

      const deadlineAt = parseDatetimeLocalValue(payload.deadlineAt ?? "");
      const deadlineError = validateDeadlineTimestamp(deadlineAt);
      if (deadlineError || deadlineAt === null) {
        setFormWarning({ deadlineAt: deadlineError ?? "Deadline is required." });
        setIsSubmitting(false);
        return;
      }

      let preFundingConfig: ReturnType<typeof getRequiredEscrowActionConfig> | null = null;
      const jobHash = createClientJobHash();
      let jobHashBytes: Uint8Array | null = null;

      if (formState.fundEscrowNow) {
        if (walletIdentity.walletType === "passkey_smart_account") {
          setFormWarning({
            submit:
              "Create the job with your passkey account, then create and fund payment hold from the payment hold action panel.",
          });
          setIsSubmitting(false);
          return;
        }

        if (!walletIdentity.canSignEscrowTransactions || !address || !isConnected) {
          setFormWarning({
            submit: "Connect a Stellar wallet before funding payment hold.",
          });
          setIsSubmitting(false);
          return;
        }

        if (!isWalletOnConfiguredNetwork(walletState)) {
          setFormWarning({
            submit: getWalletNetworkMismatchMessage("funding payment hold"),
          });
          setIsSubmitting(false);
          return;
        }

        if (walletState.isFunded === false) {
          setFormWarning({
            submit: "Fund your Stellar testnet account with Friendbot before funding payment hold.",
          });
          setIsSubmitting(false);
          return;
        }

        if (walletState.canWriteContracts === false) {
          setFormWarning({
            submit:
              "This wallet can view jobs but cannot sign payment hold contract actions right now.",
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
          setFormWarning({
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
        const createEscrowRequestId = createClientRequestId("create_escrow", createdJobId);
        const outcome = await runAtomicOpenEscrowPosting({
          config: preFundingConfig,
          walletAddress: address!,
          jobId: createdJobId,
          clientRequestId: createEscrowRequestId,
          amount: payload.budget,
          asset: selectedEscrowAsset.tokenContractId,
          assetDecimals: selectedEscrowAsset.decimals,
          jobHash: jobHashBytes,
          signTransaction,
          createTransaction,
          updateTransactionStatus,
          createEscrowRecord,
          onProgress: reportEscrowProgress,
        });

        if (outcome.kind !== "success") {
          const nextError =
            outcome.kind === "recovery_failed"
              ? `Job was posted and Stellar confirmed the atomic escrow transaction, but the escrow ID could not be recovered. The local funded escrow record was not saved. Do not submit this transaction again. Transaction: ${outcome.txHash}. ${outcome.message}`
              : outcome.kind === "bookkeeping_failed"
                ? outcome.escrowRecordSaved
                  ? `Job was posted and escrow #${outcome.escrowId} was funded on Stellar, but transaction history could not be updated. Transaction: ${outcome.txHash}. ${outcome.message}`
                  : `Job was posted and escrow #${outcome.escrowId} was created and funded on Stellar, but the local escrow record could not be saved. Transaction: ${outcome.txHash}. ${outcome.message}`
                : outcome.kind === "pending"
                  ? `Job was posted, but the atomic escrow transaction is awaiting confirmation. Do not submit it again while its status is uncertain.${outcome.txHash ? ` Transaction: ${outcome.txHash}.` : ""} ${outcome.message}`
                  : `Job was posted, but atomic escrow creation and funding failed. No escrow was created by this transaction. You can create and fund escrow from the job page. ${outcome.message}`;
          setErrors({ submit: nextError });
          showErrorToast(nextError);
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
      showSuccessToast(`Job "${payload.title}" created.`);
      onCreated(createdJobId);
    } catch (error) {
      const nextError = getReadableErrorMessage(error, "Failed to create job. Please try again.");
      setErrors({ submit: nextError });
      showErrorToast(nextError);
    } finally {
      submitInProgressRef.current = false;
      setIsSubmitting(false);
      reportEscrowProgress(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Card header */}
      <div className="hr-card-head flex flex-wrap items-start justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="space-y-1">
          <h2 className="font-sans text-xl font-bold">Post a Job</h2>
          <p className="max-w-2xl font-sans text-sm opacity-90">
            Answer a few short steps. You can go back and change anything before you post.
          </p>
        </div>

        {/* Status notices */}
        <div className="flex flex-wrap items-center gap-2">
          {!isStablecoinConfigured ? (
            <HighrableV2IconNotice
              label="Digital dollar configuration warning"
              tone="warning"
              message="The digital-dollar payment option is not set up yet. You can still post jobs, but holding the payment is switched off until it is configured."
            />
          ) : null}
          {walletIdentity.walletType === "passkey_smart_account" ? (
            <HighrableV2IconNotice
              label="passkey account connected"
              tone="success"
              message="Your passkey account is connected. After the job is created you will approve the payment hold with your passkey."
            />
          ) : null}
          {walletIdentity.walletType === "external_wallet" &&
          walletState.isTestnet &&
          walletState.isFunded === false ? (
            <HighrableV2IconNotice
              label="Funded account warning"
              tone="warning"
              message="You can post the job, but approving payments later needs a funded practice account (test XLM)."
            />
          ) : null}
        </div>
      </div>

      {/* Wallet gate */}
      {!walletIdentity.isConnected ? (
        <div className="mx-5 mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:mx-6">
          <p className="mb-3">Connect your wallet or passkey to post a job.</p>
          <WalletConnectTrigger className="hr-v2-button-primary rounded-lg px-4 py-2 text-sm font-medium text-white" />
        </div>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        onKeyDown={(event) => {
          // Enter inside a text box should move forward, not post a half-finished job.
          if (
            event.key === "Enter" &&
            stepIndex < CREATE_JOB_STEPS.length - 1 &&
            event.target instanceof HTMLInputElement
          ) {
            event.preventDefault();
            setStepIndex((value) => Math.min(CREATE_JOB_STEPS.length - 1, value + 1));
          }
        }}
        className="space-y-8 p-5 sm:p-6"
        aria-busy={isSubmitting}
      >
        <FormStepTabs
          steps={CREATE_JOB_STEPS.map((step, index) => ({
            ...step,
            hasError: getErrorStepIndexes(errors).has(index),
          }))}
          activeIndex={stepIndex}
          onSelect={setStepIndex}
          idPrefix={CREATE_JOB_ID_PREFIX}
        />

        <FormStepPanel stepId="type" isActive={stepIndex === 0} idPrefix={CREATE_JOB_ID_PREFIX}>
          {/* ── Section: Work mode ── */}
          <section aria-labelledby="section-work-mode">
            <SectionDivider label="What kind of job is this?" />
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => updateJobType("micro_gig")}
                className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                  formState.jobType === "micro_gig"
                    ? "border-highrable-orange-3 bg-accent shadow-[4px_4px_0px_var(--mode-border)]"
                    : "border-border bg-card hover:border-highrable-orange-2/50"
                }`}
                aria-pressed={formState.jobType === "micro_gig"}
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-highrable-orange-2/10 text-highrable-orange-2">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <span className="hr-text-primary block font-sans text-sm font-semibold">
                    Quick Job
                  </span>
                  <span className="hr-text-secondary mt-0.5 block font-sans text-xs">
                    One task, one freelancer, one payment.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateJobType("milestone_project")}
                className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                  formState.jobType === "milestone_project"
                    ? "border-highrable-orange-3 bg-accent shadow-[4px_4px_0px_var(--mode-border)]"
                    : "border-border bg-card hover:border-highrable-orange-2/50"
                }`}
                aria-pressed={formState.jobType === "milestone_project"}
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-highrable-orange-2/10 text-highrable-orange-2">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <span className="hr-text-primary block font-sans text-sm font-semibold">
                    Milestone Project
                  </span>
                  <span className="hr-text-secondary mt-0.5 block font-sans text-xs">
                    A bigger project paid in milestones. Each milestone is paid when it is done.
                  </span>
                </div>
              </button>
            </div>
          </section>
        </FormStepPanel>

        <FormStepPanel stepId="details" isActive={stepIndex === 1} idPrefix={CREATE_JOB_ID_PREFIX}>
          {/* ── Section: Job details ── */}
          <section aria-labelledby="section-job-details">
            <SectionDivider label="Job details" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="marketplace-job-title">Job title</Label>
                <AppInput
                  id="marketplace-job-title"
                  value={formState.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  maxLength={140}
                  placeholder="Build a responsive frontend with Stellar wallet integration"
                />
                {errors.title ? (
                  <p className="font-sans text-xs text-red-600">{errors.title}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="marketplace-job-description">Description</Label>
                <AppTextarea
                  id="marketplace-job-description"
                  value={formState.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="What needs to be done, what you expect to receive, and how you will decide it is finished"
                />
                {errors.description ? (
                  <p className="font-sans text-xs text-red-600">{errors.description}</p>
                ) : null}
              </div>

              {scamAnalysis.signals.length > 0 ? (
                <div className="flex items-center gap-2">
                  <HighrableV2IconNotice
                    label={
                      scamAnalysis.isBlocked
                        ? "Blocked scam language"
                        : "Suspicious job language warning"
                    }
                    tone={scamAnalysis.isBlocked ? "danger" : "warning"}
                    message={
                      <span className="space-y-1">
                        <span className="block">
                          {scamAnalysis.isBlocked
                            ? DISALLOWED_JOB_POST_MESSAGE
                            : "This job post contains language that may look suspicious to freelancers."}
                        </span>
                        {scamAnalysis.signals.map((signal) => (
                          <span key={signal.type} className="block">
                            {signal.message}
                          </span>
                        ))}
                      </span>
                    }
                  />
                  <span className="font-mono text-xs tracking-[0.06em] text-muted-foreground uppercase">
                    Review safety language
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {/* ── Section: Revision policy (micro gig only) ── */}
          {!isMilestoneProject ? (
            <section aria-labelledby="section-revision-policy">
              <SectionDivider label="How many changes can you ask for?" />
              <RevisionPolicyControls
                idPrefix="micro-gig"
                revisionPolicy={formState.revisionPolicy}
                revisionLimit={formState.revisionLimit}
                disabled={isSubmitting}
                error={errors.revisionPolicy ?? errors.revisionLimit}
                onPolicyChange={updateRevisionPolicy}
                onLimitChange={updateRevisionLimit}
              />
            </section>
          ) : null}

          {/* ── Section: Attachments ── */}
          <section aria-labelledby="section-attachments">
            <SectionDivider label="Files (optional)" />
            <AttachmentUploader
              value={draftAttachments}
              onChange={setDraftAttachments}
              disabled={isSubmitting}
            />
          </section>
        </FormStepPanel>

        <FormStepPanel stepId="pay" isActive={stepIndex === 2} idPrefix={CREATE_JOB_ID_PREFIX}>
          {/* ── Section: Budget & deadline ── */}
          {!isMilestoneProject ? (
            <section aria-labelledby="section-budget-deadline">
              <SectionDivider label="How much and by when?" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="marketplace-job-budget">Budget</Label>
                  <AppInput
                    id="marketplace-job-budget"
                    type="text"
                    inputMode="decimal"
                    value={formState.budget}
                    onChange={(event) => updateField("budget", event.target.value)}
                    placeholder="500"
                  />
                  <p className="font-sans text-xs text-muted-foreground">{budgetHelperText}</p>
                  {errors.budget ? (
                    <p className="font-sans text-xs text-red-600">{errors.budget}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="marketplace-job-deadline">Deadline</Label>
                  <DateTimePicker
                    id="marketplace-job-deadline"
                    min={minimumDeadlineInputValue}
                    value={formState.deadlineAt}
                    onValueChange={(value) =>
                      updateField("deadlineAt", clampDeadlineInputValue(value))
                    }
                  />
                  <p className="font-sans text-xs text-muted-foreground">
                    Shown in your local time ({getLocalTimezoneLabel()}).
                  </p>
                  {errors.deadlineAt ? (
                    <p className="font-sans text-xs text-red-600">{errors.deadlineAt}</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {/* ── Section: Payment asset ── */}
          <section aria-labelledby="section-payment-asset">
            <SectionDivider label="Payment currency" />
            {isStablecoinConfigured ? (
              <div className="space-y-3">
                {supportedEscrowAssets.map((asset) => {
                  const isSelected = formState.asset === asset.tokenContractId;
                  const isDisabled = !asset.isConfigured;

                  return (
                    <div
                      key={asset.kind}
                      role="button"
                      tabIndex={isDisabled ? -1 : 0}
                      onClick={() => !isDisabled && updateField("asset", asset.tokenContractId)}
                      onKeyDown={(e) => {
                        if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          updateField("asset", asset.tokenContractId);
                        }
                      }}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                      } ${
                        isSelected
                          ? "border-highrable-orange-3 bg-accent shadow-[4px_4px_0px_var(--mode-border)]"
                          : "border-border bg-card hover:border-highrable-orange-2/50"
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="hr-text-primary font-medium">{asset.displayName}</span>
                        {asset.isPrimary ? (
                          <HighrableV2Badge>Recommended</HighrableV2Badge>
                        ) : (
                          <HighrableV2Badge tone="solid">Advanced</HighrableV2Badge>
                        )}
                        {asset.kind === "native_xlm" && asset.isConfigured ? (
                          <HighrableV2IconNotice
                            label="XLM value warning"
                            tone="warning"
                            message="XLM payment hold is available, but the job value may fluctuate."
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : null}
                      </span>
                      <span className="hr-text-secondary mt-1 block text-sm">
                        {asset.kind === "stablecoin"
                          ? "A digital dollar. The price stays steady, so nobody loses out. Recommended."
                          : asset.isConfigured
                            ? "Advanced. The value of the job can go up or down with the XLM price."
                            : "This currency is not available right now."}
                      </span>
                      {asset.tokenContractId ? (
                        <details className="mt-1" onClick={(event) => event.stopPropagation()}>
                          <summary className="cursor-pointer font-sans text-xs text-muted-foreground">
                            Technical details
                          </summary>
                          <span className="mt-1 block font-mono text-xs break-all text-muted-foreground">
                            {asset.tokenContractId}
                          </span>
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="marketplace-job-asset">Currency code (advanced)</Label>
                <AppInput
                  id="marketplace-job-asset"
                  value={formState.asset}
                  onChange={(event) => updateField("asset", event.target.value)}
                  maxLength={255}
                  placeholder="Paste the currency code provided by your team"
                />
              </div>
            )}
            <p className="mt-2 font-sans text-xs text-muted-foreground">{helperText}</p>
            {errors.asset ? (
              <p className="mt-1 font-sans text-xs text-red-600">{errors.asset}</p>
            ) : null}
          </section>

          {shouldShowXlmToUsdcTopUp ? (
            <XlmToUsdcTopUpPanel
              walletAddress={walletIdentity.walletAddress}
              walletType={walletIdentity.walletType}
              missingUsdcAmount={xlmToUsdcMissingAmount}
              usdcBalance={preFundReadiness.balanceDisplay}
              jobAssetContractId={formState.asset || stablecoinConfig.tokenContractId}
              onRefreshBalance={preFundReadiness.refresh}
            />
          ) : null}

          {/* ── Section: Milestones (milestone project only) ── */}
          {isMilestoneProject ? (
            <section aria-labelledby="section-milestones">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 bg-highrable-text-accent" />
                  <span className="font-mono text-sm font-semibold tracking-widest text-highrable-text-accent uppercase">
                    Milestones
                  </span>
                </div>
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={addMilestone}
                  className="hr-v2-button-secondary w-full text-sm font-semibold sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Add Milestone
                </AppButton>
              </div>

              <p className="mb-4 font-sans text-sm text-muted-foreground">
                Split the project into milestones. Each milestone has its own goal, deadline and
                payment. You pay for a milestone after freelancers apply to it.
              </p>

              <div className="space-y-4">
                {formState.milestones.map((milestone, index) => (
                  <div
                    key={milestone.id}
                    className="space-y-4 rounded-lg border border-border bg-muted/30 p-4"
                  >
                    {/* Milestone header */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Milestone {index + 1}
                      </span>
                      <AppButton
                        type="button"
                        variant="secondary"
                        disabled={formState.milestones.length === 1}
                        onClick={() => removeMilestone(milestone.id)}
                        className="gap-1.5 rounded-lg bg-destructive/10 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
                      >
                        <Trash2 className="h-2 w-2" />
                        Remove
                      </AppButton>
                    </div>

                    {/* Title + amount */}
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                      <div className="space-y-1.5">
                        <Label htmlFor={`milestone-title-${milestone.id}`}>Title</Label>
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
                      <div className="space-y-1.5">
                        <Label htmlFor={`milestone-amount-${milestone.id}`}>Amount</Label>
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

                    {/* Description */}
                    <div className="space-y-1.5">
                      <Label htmlFor={`milestone-description-${milestone.id}`}>Description</Label>
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

                    {/* Deadline */}
                    <div className="space-y-1.5">
                      <Label htmlFor={`milestone-deadline-${milestone.id}`}>Deadline</Label>
                      <DateTimePicker
                        id={`milestone-deadline-${milestone.id}`}
                        min={minimumDeadlineInputValue}
                        value={milestone.deadlineAt}
                        onValueChange={(value) =>
                          updateMilestone(
                            milestone.id,
                            "deadlineAt",
                            clampDeadlineInputValue(value),
                          )
                        }
                      />
                      <p className="font-mono text-xs text-muted-foreground">
                        {getLocalTimezoneLabel()}
                      </p>
                    </div>

                    {/* Revision policy */}
                    <div>
                      <p className="mb-3 font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Revision policy
                      </p>
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

              {/* Milestone total */}
              <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-sm">
                <span className="hr-text-primary font-sans font-medium">Total project budget:</span>{" "}
                <span className="hr-text-secondary font-sans">
                  {parsedMilestoneTotal.toLocaleString(undefined, { maximumFractionDigits: 7 })}{" "}
                  {formatAssetLabel(formState.asset)}
                </span>
              </div>

              {errors.milestones ? (
                <p className="mt-2 text-sm text-red-600">{errors.milestones}</p>
              ) : null}
            </section>
          ) : null}
        </FormStepPanel>

        <FormStepPanel stepId="review" isActive={stepIndex === 3} idPrefix={CREATE_JOB_ID_PREFIX}>
          <section aria-labelledby="section-review-summary">
            <SectionDivider label="Your job at a glance" />
            <dl className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground uppercase">
                  Type
                </dt>
                <dd className="hr-text-primary mt-0.5 font-medium">
                  {isMilestoneProject ? "Milestone project" : "Quick job"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground uppercase">
                  Title
                </dt>
                <dd className="hr-text-primary mt-0.5 font-medium break-words">
                  {formState.title.trim() || "Not filled in yet"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground uppercase">
                  Budget
                </dt>
                <dd className="hr-text-primary mt-0.5 font-medium">
                  {isMilestoneProject
                    ? parsedMilestoneTotal.toLocaleString(undefined, { maximumFractionDigits: 7 })
                    : formState.budget.trim() || "Not filled in yet"}{" "}
                  {formatAssetLabel(formState.asset)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground uppercase">
                  Due
                </dt>
                <dd className="hr-text-primary mt-0.5 font-medium">
                  {isMilestoneProject
                    ? `${formState.milestones.length} milestone${formState.milestones.length === 1 ? "" : "s"}, each with its own deadline`
                    : formState.deadlineAt || "Not filled in yet"}
                </dd>
              </div>
            </dl>
          </section>

          {/* ── Section: Escrow funding (micro gig only) ── */}
          {!isMilestoneProject ? (
            <section aria-labelledby="section-escrow">
              <SectionDivider label="Secure the payment" />
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex gap-1.5">
                      <Label htmlFor="fund-escrow-now" className="text-sm font-semibold">
                        Put the payment on hold now
                      </Label>
                      {walletIdentity.walletType === "passkey_smart_account" ? (
                        <HighrableV2IconNotice
                          label="Passkey payment hold funding notice"
                          tone="warning"
                          message="Passkey accounts create and fund payment hold after posting so role checks use the passkey account address consistently."
                        />
                      ) : (
                        <HighrableV2IconNotice
                          label="Payment Hold funding info"
                          tone="warning"
                          message="Setting the budget aside shows applicants you are serious and demonstrates commitment to applicants and secures the payment for the future freelancer."
                        />
                      )}
                    </div>
                    <p className="hr-text-secondary mt-1 font-sans text-sm">
                      Set the full budget aside in a safe holding account (
                      <TermHint term="escrow">payment hold</TermHint>) while freelancers apply. It
                      is only released to the freelancer when you approve their work.
                    </p>
                    {formState.fundEscrowNow ? (
                      <p className="mt-2 font-sans text-xs text-muted-foreground">
                        After the job is created, your wallet will ask you to approve one payment.
                      </p>
                    ) : null}
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
                    aria-label="Put the payment on hold when posting this job"
                  />
                </div>
              </div>
            </section>
          ) : (
            <div>
              <SectionDivider label="Secure the payment" />
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 px-4 font-sans text-sm text-amber-800">
                Project milestones are not paid upfront. You will choose a freelancer and secure the
                payment for each milestone separately after applications arrive.
              </div>
            </div>
          )}

          {/* Error summary */}
          {errors.submit ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errors.submit}
            </p>
          ) : null}
        </FormStepPanel>

        <FormStepNav
          activeIndex={stepIndex}
          stepCount={CREATE_JOB_STEPS.length}
          onBack={() => setStepIndex((value) => Math.max(0, value - 1))}
          onNext={() => setStepIndex((value) => Math.min(CREATE_JOB_STEPS.length - 1, value + 1))}
          finalAction={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <EscrowActionProgress progress={escrowProgress} />
              <AppButton
                type="submit"
                disabled={isSubmitting || !walletIdentity.isConnected}
                className="hr-v2-button-primary rounded-lg px-6 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? formState.fundEscrowNow
                    ? "Posting and Funding..."
                    : "Submitting..."
                  : formState.fundEscrowNow
                    ? "Post Job and Secure Payment"
                    : isMilestoneProject
                      ? "Create Milestone Project"
                      : "Create Job"}
              </AppButton>
            </div>
          }
        />
      </form>
    </section>
  );
}
