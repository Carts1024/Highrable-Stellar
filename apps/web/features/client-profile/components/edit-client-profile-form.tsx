"use client";

import { showErrorToast, showSuccessToast, showWarningToast } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import { useState } from "react";

import type { TClientProfile } from "@/features/client-profile/types";

function validateUrl(value: string, label: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (!trimmedValue.startsWith("http://") && !trimmedValue.startsWith("https://")) {
    return `${label} must start with http:// or https://.`;
  }

  return null;
}

export function EditClientProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  readonly profile: TClientProfile;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}) {
  const updateProfile = useMutation(api.profiles.updateClientProfile);
  const [name, setName] = useState(profile.name ?? "");
  const [companyName, setCompanyName] = useState(profile.companyName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const validationError =
      (name.trim().length > 80 && "Name must be 80 characters or less.") ||
      (companyName.trim().length > 100 && "Company name must be 100 characters or less.") ||
      (bio.trim().length > 500 && "Bio must be 500 characters or less.") ||
      (location.trim().length > 80 && "Location must be 80 characters or less.") ||
      validateUrl(websiteUrl, "Website URL");

    if (typeof validationError === "string") {
      setError(validationError);
      showWarningToast(validationError);
      return;
    }

    setStatus("saving");
    try {
      await updateProfile({
        walletAddress: profile.walletAddress,
        name,
        companyName,
        bio,
        websiteUrl,
        location,
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
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-2xl border border-[#e8e8e8] bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client-name">Name</Label>
          <Input
            id="client-name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-company-name">Company name</Label>
          <Input
            id="client-company-name"
            value={companyName}
            maxLength={100}
            onChange={(event) => setCompanyName(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="client-bio">Bio</Label>
        <Textarea
          id="client-bio"
          value={bio}
          maxLength={500}
          rows={4}
          onChange={(event) => setBio(event.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client-website">Website URL</Label>
          <Input
            id="client-website"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-location">Location</Label>
          <Input
            id="client-location"
            value={location}
            maxLength={80}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <AppButton type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </AppButton>
        <AppButton type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save profile"}
        </AppButton>
      </div>
    </form>
  );
}
