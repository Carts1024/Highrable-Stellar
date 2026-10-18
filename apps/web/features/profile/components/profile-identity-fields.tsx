"use client";

import { ProfileAvatar } from "@/features/common";
import { validateAvatarFile } from "@/features/profile/lib/profile-identity-form";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { ImageUp, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

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
  /** Limits which sections are shown (used by stepped forms). Hidden sections stay mounted. */
  readonly visibleSections?: readonly TProfileIdentitySection[];
}

export type TProfileIdentitySection = "name" | "identity" | "social" | "avatar";

// Sub-components

/** Thin labelled divider used as a section header */
function SectionDivider({ label }: { label: string }) {
  return <h3 className="hr-text-primary mb-3 font-sans text-sm font-semibold">{label}</h3>;
}

/** Input with a fixed prefix slot (e.g. "@" or "discord.gg/") */
function PrefixInput({
  prefix,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  prefix: string;
  id: string;
}) {
  return (
    <div className="flex h-9 overflow-hidden rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <span className="flex items-center border-r border-input bg-muted px-3 text-sm text-muted-foreground select-none">
        {prefix}
      </span>
      <input
        id={id}
        className="min-w-0 flex-1 bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
    </div>
  );
}

// Main component
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
  visibleSections,
}: IProfileIdentityFieldsProps) {
  const isVisible = (section: TProfileIdentitySection) =>
    !visibleSections || visibleSections.includes(section);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live handle hint
  const [handleFocused, setHandleFocused] = useState(false);
  const handleHint =
    handleFocused && values.publicHandle
      ? `Shown on your profile as @${values.publicHandle.trim().toLowerCase()}`
      : "3–32 characters: letters, numbers, underscores or hyphens.";

  // Parsed skill badges
  const skillBadges = skillsInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  // Avatar change handler
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    const validationError = file ? validateAvatarFile(file) : null;
    onAvatarFileChange(validationError ? null : file, validationError);
  }

  return (
    <div className="space-y-10">
      {/* Name */}
      <section aria-labelledby="section-name" hidden={!isVisible("name")}>
        <SectionDivider label="About You" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="profile-first-name">First name</Label>
            <Input
              id="profile-first-name"
              value={values.firstName}
              maxLength={60}
              placeholder="First name"
              required
              onChange={(e) => onFieldChange("firstName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-middle-name">
              Middle name{" "}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="profile-middle-name"
              value={values.middleName ?? ""}
              maxLength={60}
              placeholder="Middle name"
              onChange={(e) => onFieldChange("middleName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-last-name">Last name</Label>
            <Input
              id="profile-last-name"
              value={values.lastName}
              maxLength={60}
              placeholder="Last name"
              required
              onChange={(e) => onFieldChange("lastName", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Identity & skills */}
      <section aria-labelledby="section-identity" hidden={!isVisible("identity")}>
        <SectionDivider label="Username and skills" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-handle">Username</Label>
            <PrefixInput
              id="profile-handle"
              prefix="@"
              value={values.publicHandle}
              maxLength={32}
              placeholder="Username"
              required
              onChange={(e) => onFieldChange("publicHandle", e.target.value)}
              onFocus={() => setHandleFocused(true)}
              onBlur={() => setHandleFocused(false)}
            />
            <p className="text-xs text-muted-foreground">{handleHint}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-skills">Skills</Label>
            <Input
              id="profile-skills"
              value={skillsInput}
              placeholder="e.g. Web design, Copywriting, React"
              required
              onChange={(e) => onSkillsInputChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Separate skills with commas. Up to 10.</p>
            {skillBadges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {skillBadges.map((skill) => (
                  <Badge key={skill} variant="secondary" className="bg-highrable-orange-1/20">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Social links */}
      <section aria-labelledby="section-social" hidden={!isVisible("social")}>
        <SectionDivider label="Social links (optional)" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="profile-discord">Discord</Label>
            <Input
              id="profile-discord"
              value={values.discordHandle ?? ""}
              maxLength={40}
              placeholder="Discord username"
              onChange={(e) => onFieldChange("discordHandle", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-x">X</Label>
            <PrefixInput
              id="profile-x"
              prefix="@"
              value={values.xHandle ?? ""}
              maxLength={40}
              placeholder="X username"
              onChange={(e) => onFieldChange("xHandle", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-github">GitHub</Label>
            <Input
              id="profile-github"
              value={values.githubUsername ?? ""}
              maxLength={40}
              placeholder="GitHub username"
              onChange={(e) => onFieldChange("githubUsername", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Avatar */}
      <section aria-labelledby="section-avatar" hidden={!isVisible("avatar")}>
        <SectionDivider label="Profile picture (optional)" />
        <div className="flex flex-wrap items-center gap-4">
          {/* Preview */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
            ) : currentAvatarUrl ? (
              <ProfileAvatar
                avatarUrl={currentAvatarUrl}
                displayName={displayName}
                fallbackLabel="UF"
              />
            ) : (
              <ImageUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </div>

          {/* Info + actions */}
          <div className="space-y-1">
            <Label htmlFor="upload-avatar">
              Photo{" "}
              <span className="text-xs font-normal text-muted-foreground">
                JPEG, PNG, WebP or GIF, up to 5 MB
              </span>
            </Label>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Choose file
              </Button>

              {avatarFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    onAvatarFileChange(null, null);
                  }}
                  className="text-xs text-destructive"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Hidden file input */}
          <input
            id="upload-avatar"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Upload avatar photo"
          />
        </div>
      </section>
    </div>
  );
}
