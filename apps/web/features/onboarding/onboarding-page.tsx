"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { ProductPageHero, showErrorToast, showWarningToast } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { useRegistryRegistration } from "@/features/onboarding/hooks/use-registry-registration";
import { TOnboardingFormSchema, type TOnboardingFormValues } from "@/features/onboarding/types";
import { ProfileIdentityFields } from "@/features/profile/components/profile-identity-fields";
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
      return "Connect a Stellar wallet or create a passkey smart account to begin.";
    }

    return `Connected as ${walletIdentity.displayAddress}. You can hire or work from the same account.`;
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
      const nextWarning = parsed.error.issues[0]?.message ?? "Check your onboarding details.";
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
          <SectionLabel>Highrable onboarding</SectionLabel>
          <h1 className="mt-2 text-3xl font-semibold text-[#0a0a0a]">Create your profile</h1>
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
            label="Highrable Onboarding"
            title={
              <>
                Set up one public identity for{" "}
                <span className="text-[#FF7003]">hiring and freelance work</span>.
              </>
            }
            description={helperText}
          />
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-0 divide-y divide-border/60 rounded-xl border border-border/80 bg-card shadow-xs sm:rounded-xl">
          <div className="flex flex-col gap-0.5 px-4 py-3 sm:px-5 sm:py-4">
            <span className="mb-2 font-mono text-xs tracking-[0.08em] text-muted-foreground/80 uppercase">
              Profile use
            </span>
            <span className="hr-text-primary text-xs leading-none font-medium sm:text-sm">
              Highrable keeps this identity role-neutral. You can hire, apply for work, or do both
              from the same wallet.
            </span>
          </div>
        </div>
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 p-5 sm:p-6">
        <ProfileIdentityFields
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

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Before signing, note that your wallet address and registration time will be public on
          Stellar. Transaction fees may apply.
        </div>

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

        <div className="flex flex-wrap justify-end gap-3 border-t border-[#e8e8e8] pt-8">
          {registration.hasPendingTransaction || registration.transaction?.status === "success" ? (
            <AppButton
              type="button"
              variant="outline"
              disabled={registration.isBusy || registration.isLoading}
              onClick={() => void registration.checkRegistration({ completeOnboarding: true })}
            >
              Check registration
            </AppButton>
          ) : null}
          <AppButton
            type="submit"
            disabled={isPreparingProfile || registration.isBusy || registration.isLoading}
            className="hr-v2-button-primary rounded-none"
          >
            {isPreparingProfile && !registration.isBusy
              ? "Saving profile"
              : registration.isBusy
                ? registration.stepLabel || "Working…"
                : "Save profile and register wallet"}
          </AppButton>
        </div>
      </form>
    </div>
  );
}
