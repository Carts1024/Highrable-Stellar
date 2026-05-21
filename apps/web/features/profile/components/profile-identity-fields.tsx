"use client";

import { ProfileAvatar } from "@/features/common";
import { validateAvatarFile } from "@/features/profile/lib/profile-identity-form";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { ImageUp, X } from "lucide-react";

import type { TProfileIdentityFormValues } from "@/features/profile/lib/profile-identity-form";

interface IProfileIdentityFieldsProps {
  readonly values: TProfileIdentityFormValues;
  readonly skillsInput: string;
  readonly avatarFile: File | null;
  readonly avatarPreviewUrl: string | null;
  readonly currentAvatarUrl?: string;
  readonly displayName: string;
  readonly onFieldChange: (field: keyof TProfileIdentityFormValues, value: string) => void;
  readonly onSkillsInputChange: (value: string) => void;
  readonly onAvatarFileChange: (file: File | null, validationError: string | null) => void;
}

export function ProfileIdentityFields({
  values,
  skillsInput,
  avatarFile,
  avatarPreviewUrl,
  currentAvatarUrl,
  displayName,
  onFieldChange,
  onSkillsInputChange,
  onAvatarFileChange,
}: IProfileIdentityFieldsProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="profile-first-name">First name</Label>
          <Input
            id="profile-first-name"
            value={values.firstName}
            maxLength={60}
            onChange={(event) => onFieldChange("firstName", event.target.value)}
            required
            className="rounded-none border-[#e8e8e8]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-middle-name">Middle name</Label>
          <Input
            id="profile-middle-name"
            value={values.middleName ?? ""}
            maxLength={60}
            onChange={(event) => onFieldChange("middleName", event.target.value)}
            className="rounded-none border-[#e8e8e8]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-last-name">Last name</Label>
          <Input
            id="profile-last-name"
            value={values.lastName}
            maxLength={60}
            onChange={(event) => onFieldChange("lastName", event.target.value)}
            required
            className="rounded-none border-[#e8e8e8]"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-handle">Public handle</Label>
          <Input
            id="profile-handle"
            value={values.publicHandle}
            maxLength={32}
            onChange={(event) => onFieldChange("publicHandle", event.target.value)}
            placeholder="stellar_builder"
            required
            className="rounded-none border-[#e8e8e8]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-skills">Core skills</Label>
          <Input
            id="profile-skills"
            value={skillsInput}
            onChange={(event) => onSkillsInputChange(event.target.value)}
            placeholder="Stellar, React, Smart contracts"
            required
            className="rounded-none border-[#e8e8e8]"
          />
          <p className="text-xs text-[#7f7f7f]">Comma-separated, up to 10 skills.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="profile-discord">Discord</Label>
          <Input
            id="profile-discord"
            value={values.discordHandle ?? ""}
            maxLength={40}
            onChange={(event) => onFieldChange("discordHandle", event.target.value)}
            placeholder="username"
            className="rounded-none border-[#e8e8e8]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-x">X</Label>
          <Input
            id="profile-x"
            value={values.xHandle ?? ""}
            maxLength={40}
            onChange={(event) => onFieldChange("xHandle", event.target.value)}
            placeholder="@handle"
            className="rounded-none border-[#e8e8e8]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-github">GitHub</Label>
          <Input
            id="profile-github"
            value={values.githubUsername ?? ""}
            maxLength={40}
            onChange={(event) => onFieldChange("githubUsername", event.target.value)}
            placeholder="username"
            className="rounded-none border-[#e8e8e8]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-avatar">Avatar</Label>
        <div className="flex flex-wrap items-center gap-3">
          {avatarPreviewUrl ? (
            <img
              src={avatarPreviewUrl}
              alt="Selected avatar preview"
              className="h-16 w-16 rounded-none border border-[#e8e8e8] object-cover"
            />
          ) : currentAvatarUrl ? (
            <ProfileAvatar
              avatarUrl={currentAvatarUrl}
              displayName={displayName}
              fallbackLabel="UF"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center border border-[#e8e8e8] bg-[#f5f5f5] text-[#7f7f7f]">
              <ImageUp className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
          <Input
            id="profile-avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="max-w-sm rounded-none border-[#e8e8e8]"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              const validationError = file ? validateAvatarFile(file) : null;
              onAvatarFileChange(validationError ? null : file, validationError);
            }}
          />
          {avatarFile ? (
            <AppButton type="button" variant="ghost" onClick={() => onAvatarFileChange(null, null)}>
              <X className="mr-2 h-4 w-4" aria-hidden="true" />
              Remove
            </AppButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
