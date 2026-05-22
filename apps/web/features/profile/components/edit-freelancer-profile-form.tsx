"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { ProfileIdentityFields } from "@/features/profile/components/profile-identity-fields";
import {
  buildProfileIdentityMutationArgs,
  parseSkillsInput,
  TProfileIdentityFormSchema,
  validateAvatarFile,
} from "@/features/profile/lib/profile-identity-form";
import { api, type TConvexStorageId } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation } from "convex/react";
import { useEffect, useMemo, useState } from "react";

import type { TProfileIdentityFormValues } from "@/features/profile/lib/profile-identity-form";
import type { TFreelancerProfile } from "@/features/profile/types";

function buildInitialValues(profile: TFreelancerProfile): TProfileIdentityFormValues {
  const fallbackParts = (profile.name ?? "").trim().split(/\s+/).filter(Boolean);

  return {
    firstName: profile.firstName ?? fallbackParts[0] ?? "",
    middleName: profile.middleName ?? "",
    lastName: profile.lastName ?? fallbackParts.slice(1).join(" "),
    publicHandle: profile.publicHandle ?? "",
    coreSkills: profile.coreSkills,
    discordHandle: profile.discordHandle ?? "",
    xHandle: profile.xHandle ?? "",
    githubUsername: profile.githubUsername ?? "",
  };
}

export function EditFreelancerProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  readonly profile: TFreelancerProfile;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const updateProfile = useMutation(api.profiles.updateFreelancerProfile);
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const initialValues = useMemo(() => buildInitialValues(profile), [profile]);
  const [values, setValues] = useState<TProfileIdentityFormValues>(initialValues);
  const [skillsInput, setSkillsInput] = useState(profile.coreSkills.join(", "));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues);
    setSkillsInput(profile.coreSkills.join(", "));
  }, [initialValues, profile.coreSkills]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  const setField = (field: keyof TProfileIdentityFormValues, value: string) => {
    setValues((currentValue) => ({ ...currentValue, [field]: value }));
    setError(null);
  };

  const uploadAvatar = async (): Promise<TConvexStorageId | undefined> => {
    if (!avatarFile) {
      return undefined;
    }

    const validationError = validateAvatarFile(avatarFile);
    if (validationError) {
      throw new Error(validationError);
    }

    const uploadUrl = await generateUploadUrl({
      walletAddress: profile.walletAddress,
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

    const parsed = TProfileIdentityFormSchema.safeParse({
      ...values,
      coreSkills: parseSkillsInput(skillsInput),
    });

    if (!parsed.success) {
      const nextWarning = parsed.error.issues[0]?.message ?? "Check your profile details.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setStatus("saving");
    try {
      const avatarStorageId = await uploadAvatar();
      await updateProfile({
        walletAddress: profile.walletAddress,
        ...buildProfileIdentityMutationArgs(parsed.data, avatarStorageId),
      });
      setStatus("idle");
      showSuccessToast("Profile updated.");
      onSaved();
    } catch (caughtError) {
      const nextError = getReadableErrorMessage(caughtError, "Profile update failed.");
      setError(nextError);
      showErrorToast(nextError);
      setStatus("idle");
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <ProfileIdentityFields
        values={values}
        skillsInput={skillsInput}
        avatarFile={avatarFile}
        avatarPreviewUrl={avatarPreviewUrl}
        currentAvatarUrl={profile.avatarUrl}
        displayName={profile.name ?? "Unnamed Freelancer"}
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
        <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8e8e8] pt-5">
        <AppButton type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </AppButton>
        <AppButton
          type="submit"
          disabled={status === "saving"}
          className="hr-v2-button-primary rounded-none"
        >
          {status === "saving" ? "Saving..." : "Save profile"}
        </AppButton>
      </div>
    </form>
  );
}
