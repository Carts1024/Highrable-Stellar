"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
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
import { useEffect, useMemo, useState } from "react";

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
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [values, setValues] = useState<TOnboardingFormValues>({
    firstName: "",
    middleName: "",
    lastName: "",
    publicHandle: "",
    coreSkills: [],
    discordHandle: "",
    xHandle: "",
    githubUsername: "",
  });
  const [skillsInput, setSkillsInput] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const isComplete = Boolean(onboardingState?.isComplete);
  const isLoading = walletIdentity.isConnected && onboardingState === undefined;

  useEffect(() => {
    if (isComplete) {
      router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
    }
  }, [isComplete, nextPath, router]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
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
    setError(null);
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
    setError(null);

    if (!walletIdentity.walletAddress) {
      const nextWarning = "Connect a wallet or passkey account before onboarding.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    const parsed = TOnboardingFormSchema.safeParse({
      ...values,
      coreSkills: parseSkillsInput(skillsInput),
    });

    if (!parsed.success) {
      const nextWarning = parsed.error.issues[0]?.message ?? "Check your onboarding details.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setStatus("saving");
    try {
      const avatarStorageId = await uploadAvatar();
      await completeOnboarding({
        walletAddress: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        ...buildProfileIdentityMutationArgs(parsed.data, avatarStorageId),
      });
      showSuccessToast("Onboarding completed.");
      router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch (caughtError) {
      const nextError = getReadableErrorMessage(caughtError, "Could not complete onboarding.");
      setError(nextError);
      showErrorToast(nextError);
      setStatus("idle");
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
      <section className="grid gap-6 border-b border-[#e8e8e8] pb-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
        <div>
          <SectionLabel>Highrable onboarding</SectionLabel>
          <h1 className="mt-2 max-w-3xl text-4xl leading-tight font-semibold text-[#0a0a0a]">
            Set up one public identity for hiring and freelance work.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f5f5f]">{helperText}</p>
        </div>
        <div className="border-l border-[#e8e8e8] pl-4">
          <p className="hr-label-caps text-[#7f7f7f]">Profile use</p>
          <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">
            Highrable keeps this identity role-neutral. You can hire, apply for work, or do both
            from the same wallet.
          </p>
        </div>
      </section>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5 border border-[#e8e8e8] bg-white p-5 sm:p-6"
      >
        <ProfileIdentityFields
          values={values}
          skillsInput={skillsInput}
          avatarFile={avatarFile}
          avatarPreviewUrl={avatarPreviewUrl}
          displayName={[values.firstName, values.lastName].filter(Boolean).join(" ")}
          onFieldChange={setField}
          onSkillsInputChange={(value) => {
            setSkillsInput(value);
            setError(null);
          }}
          onAvatarFileChange={(file, validationError) => {
            setAvatarFile(file);
            setError(validationError);
          }}
        />

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end border-t border-[#e8e8e8] pt-5">
          <AppButton
            type="submit"
            disabled={status === "saving"}
            className="hr-v2-button-primary rounded-none"
          >
            {status === "saving" ? "Saving..." : "Complete onboarding"}
          </AppButton>
        </div>
      </form>
    </div>
  );
}
