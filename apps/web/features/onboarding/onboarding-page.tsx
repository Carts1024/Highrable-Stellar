"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import {
  FormStepNav,
  FormStepTabs,
  ProductPageHero,
  showErrorToast,
  showWarningToast,
  TermHint,
} from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { useRegistryRegistration } from "@/features/onboarding/hooks/use-registry-registration";
import { TOnboardingFormSchema, type TOnboardingFormValues } from "@/features/onboarding/types";
import {
  ProfileIdentityFields,
  type TProfileIdentitySection,
} from "@/features/profile/components/profile-identity-fields";
import {
  buildProfileIdentityMutationArgs,
  parseSkillsInput,
  validateAvatarFile,
} from "@/features/profile/lib/profile-identity-form";
import { api, type TConvexStorageId } from "@repo/convex-client";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { IFormStep } from "@/features/common";

const EMPTY_FORM_VALUES: TOnboardingFormValues = {
  firstName: "",
  middleName: "",
  lastName: "",
  publicHandle: "",
  coreSkills: [],
  discordHandle: "",
  xHandle: "",
  githubUsername: "",
};

const ONBOARDING_ID_PREFIX = "onboarding";

const ONBOARDING_STEPS: readonly (IFormStep & {
  readonly sections: readonly TProfileIdentitySection[];
})[] = [
  {
    id: "about",
    title: "About you",
    hint: "Your name and picture, so people know who they are working with.",
    sections: ["name", "avatar"],
  },
  {
    id: "profile",
    title: "Your profile",
    hint: "Pick a username and list what you are good at.",
    sections: ["identity"],
  },
  {
    id: "links",
    title: "Links & finish",
    hint: "Add optional links, then save your profile and register your account.",
    sections: ["social"],
  },
] as const;

export function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const walletIdentity = useHighrableWalletIdentity();
  const onboardingState = useQuery(
    api.users.queries.getOnboardingState,
    walletIdentity.walletAddress ? { walletAddress: walletIdentity.walletAddress } : "skip",
  );
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const saveProfileDraft = useMutation(api.users.saveProfileDraft);
  const registration = useRegistryRegistration();
  const [values, setValues] = useState<TOnboardingFormValues>(EMPTY_FORM_VALUES);
  const [skillsInput, setSkillsInput] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPreparingProfile, setIsPreparingProfile] = useState(false);
  const restoredWalletRef = useRef<string | null>(null);

  const isComplete = Boolean(onboardingState?.isComplete);
  const isLoading = walletIdentity.isConnected && onboardingState === undefined;

  useEffect(() => {
    if (!walletIdentity.walletAddress) {
      restoredWalletRef.current = null;
      return;
    }
    if (
      onboardingState === undefined ||
      restoredWalletRef.current === walletIdentity.walletAddress
    ) {
      return;
    }

    const user = onboardingState.user;
    if (user) {
      const coreSkills = user.coreSkills ?? [];
      setValues({
        firstName: user.firstName ?? "",
        middleName: user.middleName ?? "",
        lastName: user.lastName ?? "",
        publicHandle: user.publicHandle ?? "",
        coreSkills,
        discordHandle: user.discordHandle ?? "",
        xHandle: user.xHandle ?? "",
        githubUsername: user.githubUsername ?? "",
      });
      setSkillsInput(coreSkills.join(", "));
    } else {
      setValues(EMPTY_FORM_VALUES);
      setSkillsInput("");
    }
    setAvatarFile(null);
    setFormError(null);
    registration.clearError();
    restoredWalletRef.current = walletIdentity.walletAddress;
  }, [onboardingState, registration.clearError, walletIdentity.walletAddress]);

  useEffect(() => {
    if (isComplete) {
      router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
    }
  }, [isComplete, nextPath, router]);

  useEffect(() => {
    if (!avatarFile) {
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  const helperText = useMemo(() => {
    if (!walletIdentity.displayAddress) {
      return "Connect your wallet or create a passkey account to begin.";
    }

    return `Signed in as ${walletIdentity.displayAddress}. You can hire people and work for others from the same account.`;
  }, [walletIdentity.displayAddress]);

  const setField = (field: keyof TOnboardingFormValues, value: string) => {
    setValues((currentValue) => ({ ...currentValue, [field]: value }));
    setFormError(null);
    registration.clearError();
  };

  const uploadAvatar = async (): Promise<TConvexStorageId | undefined> => {
    if (!avatarFile || !walletIdentity.walletAddress) {
      return undefined;
    }

    const validationError = validateAvatarFile(avatarFile);
    if (validationError) {
      throw new Error(validationError);
    }

    const uploadUrl = await generateUploadUrl({
      walletAddress: walletIdentity.walletAddress,
      ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
      name: avatarFile.name,
      size: avatarFile.size,
      mimeType: avatarFile.type,
      type: "image",
    });
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": avatarFile.type },
      body: avatarFile,
    });

    if (!response.ok) {
      throw new Error("Avatar upload failed.");
    }

    const body = (await response.json()) as { storageId: TConvexStorageId };
    return body.storageId;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPreparingProfile || registration.isBusy) {
      return;
    }
    setFormError(null);
    registration.clearError();

    if (!walletIdentity.walletAddress) {
      const nextWarning = "Connect a wallet or passkey account before onboarding.";
      setFormError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    const parsed = TOnboardingFormSchema.safeParse({
      ...values,
      coreSkills: parseSkillsInput(skillsInput),
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const issueField = firstIssue?.path[0];
      // Send the person to the tab that holds the field that needs fixing.
      setStepIndex(
        issueField === "publicHandle" || issueField === "coreSkills"
          ? 1
          : issueField === "discordHandle" ||
              issueField === "xHandle" ||
              issueField === "githubUsername"
            ? 2
            : 0,
      );
      const nextWarning = firstIssue?.message ?? "Check your onboarding details.";
      setFormError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setIsPreparingProfile(true);
    try {
      const profileDraft = buildProfileIdentityMutationArgs(parsed.data, undefined);
      await saveProfileDraft({
        walletAddress: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        ...profileDraft,
      });
      const avatarStorageId = await uploadAvatar();
      await registration.register({
        profileDraft: buildProfileIdentityMutationArgs(parsed.data, avatarStorageId),
        completeOnboarding: true,
      });
    } catch (caughtError) {
      const nextError = getReadableErrorMessage(caughtError, "Could not complete onboarding.");
      setFormError(nextError);
      showErrorToast(nextError);
    } finally {
      setIsPreparingProfile(false);
    }
  };

  if (!walletIdentity.isConnected) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <SectionLabel>Create your account</SectionLabel>
          <h1 className="mt-2 text-3xl font-semibold text-[#0a0a0a]">Create your account</h1>
          <p className="mt-3 text-sm text-[#5f5f5f]">{helperText}</p>
        </div>
        <WalletConnectTrigger className="hr-v2-button-primary rounded-none px-5 py-2 text-sm font-medium text-white" />
      </div>
    );
  }

  if (isLoading || isComplete) {
    return <p className="text-sm text-[#5f5f5f]">Loading onboarding...</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-8 lg:pb-10">
        <div className="space-y-5">
          <ProductPageHero
            label="Create your account"
            title={
              <>
                Set up your profile in <span className="hr-mode-text">three short steps</span>.
              </>
            }
            description={helperText}
          />
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-0 divide-y divide-border/60 rounded-xl border border-border/80 bg-card shadow-xs sm:rounded-xl">
          <div className="flex flex-col gap-0.5 px-4 py-3 sm:px-5 sm:py-4">
            <span className="mb-2 font-mono text-xs tracking-[0.08em] text-muted-foreground/80 uppercase">
              About your account
            </span>
            <span className="hr-text-primary text-xs leading-none font-medium sm:text-sm">
              One profile works for everything. Use the Freelancer / Client switch at the top of the
              page to choose whether you are hiring or looking for work.
            </span>
          </div>
        </div>
      </section>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            stepIndex < ONBOARDING_STEPS.length - 1 &&
            event.target instanceof HTMLInputElement
          ) {
            event.preventDefault();
            setStepIndex((value) => Math.min(ONBOARDING_STEPS.length - 1, value + 1));
          }
        }}
        className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
      >
        <FormStepTabs
          steps={ONBOARDING_STEPS}
          activeIndex={stepIndex}
          onSelect={setStepIndex}
          idPrefix={ONBOARDING_ID_PREFIX}
        />

        <div
          role="tabpanel"
          id={`${ONBOARDING_ID_PREFIX}-panel-${ONBOARDING_STEPS[stepIndex]?.id ?? "about"}`}
          aria-labelledby={`${ONBOARDING_ID_PREFIX}-tab-${ONBOARDING_STEPS[stepIndex]?.id ?? "about"}`}
        >
          <ProfileIdentityFields
            visibleSections={ONBOARDING_STEPS[stepIndex]?.sections ?? []}
            values={values}
            skillsInput={skillsInput}
            avatarFile={avatarFile}
            avatarPreviewUrl={avatarPreviewUrl}
            currentAvatarUrl={onboardingState?.avatarUrl ?? undefined}
            displayName={[values.firstName, values.lastName].filter(Boolean).join(" ")}
            onFieldChange={setField}
            onSkillsInputChange={(value) => {
              setSkillsInput(value);
              setFormError(null);
              registration.clearError();
            }}
            onAvatarFileChange={(file, validationError) => {
              setAvatarFile(file);
              setAvatarPreviewUrl(null);
              setFormError(validationError);
              registration.clearError();
            }}
          />
        </div>

        {stepIndex === ONBOARDING_STEPS.length - 1 ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            Good to know: when you finish, your wallet address and the time you registered are saved
            publicly on the <TermHint term="stellar">Stellar network</TermHint>. A small network fee
            may apply.
          </div>
        ) : null}

        {registration.stepLabel ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {registration.stepLabel}…
          </p>
        ) : null}

        {registration.configurationError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {registration.configurationError}
          </p>
        ) : null}

        {(formError ?? registration.error) ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {formError ?? registration.error}
          </p>
        ) : null}

        <FormStepNav
          activeIndex={stepIndex}
          stepCount={ONBOARDING_STEPS.length}
          onBack={() => setStepIndex((value) => Math.max(0, value - 1))}
          onNext={() => setStepIndex((value) => Math.min(ONBOARDING_STEPS.length - 1, value + 1))}
          finalAction={
            <div className="flex flex-wrap justify-end gap-3">
              {registration.hasPendingTransaction ||
              registration.transaction?.status === "success" ? (
                <AppButton
                  type="button"
                  variant="outline"
                  disabled={registration.isBusy || registration.isLoading}
                  onClick={() => void registration.checkRegistration({ completeOnboarding: true })}
                >
                  Check my registration
                </AppButton>
              ) : null}
              <AppButton
                type="submit"
                disabled={isPreparingProfile || registration.isBusy || registration.isLoading}
                className="hr-v2-button-primary rounded-lg"
              >
                {isPreparingProfile && !registration.isBusy
                  ? "Saving profile"
                  : registration.isBusy
                    ? registration.stepLabel || "Working…"
                    : "Save profile and finish"}
              </AppButton>
            </div>
          }
        />
      </form>
    </div>
  );
}
