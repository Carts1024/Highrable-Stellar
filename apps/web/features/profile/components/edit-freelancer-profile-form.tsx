"use client";

import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { normalizeSkillsInput } from "@/features/profile/lib/profile-format";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import { useState } from "react";

import type { TFreelancerProfile } from "@/features/profile/types";

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

export function EditFreelancerProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  readonly profile: TFreelancerProfile;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}) {
  const updateProfile = useMutation(api.profiles.updateFreelancerProfile);
  const [name, setName] = useState(profile.name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [portfolioUrl, setPortfolioUrl] = useState(profile.portfolioUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedSkills = normalizeSkillsInput(skills);
    const validationError =
      (name.trim().length > 80 && "Name must be 80 characters or less.") ||
      (bio.trim().length > 500 && "Bio must be 500 characters or less.") ||
      (location.trim().length > 80 && "Location must be 80 characters or less.") ||
      (normalizedSkills.length > 10 && "Use 10 skills or fewer.") ||
      normalizedSkills.find((skill) => skill.length > 40) !== undefined ||
      validateUrl(portfolioUrl, "Portfolio URL") ||
      validateUrl(websiteUrl, "Website URL");

    if (validationError === true) {
      setError("Each skill must be 40 characters or less.");
      return;
    }

    if (typeof validationError === "string") {
      setError(validationError);
      return;
    }

    setStatus("saving");
    try {
      await updateProfile({
        walletAddress: profile.walletAddress,
        name,
        bio,
        skills: normalizedSkills,
        portfolioUrl,
        websiteUrl,
        location,
      });
      setStatus("saved");
      onSaved();
    } catch (caughtError) {
      setError(getReadableErrorMessage(caughtError, "Profile update failed."));
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
          <Label htmlFor="freelancer-name">Name</Label>
          <Input
            id="freelancer-name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="freelancer-location">Location</Label>
          <Input
            id="freelancer-location"
            value={location}
            maxLength={80}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="freelancer-bio">Bio</Label>
        <Textarea
          id="freelancer-bio"
          value={bio}
          maxLength={500}
          rows={4}
          onChange={(event) => setBio(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="freelancer-skills">Skills</Label>
        <Input
          id="freelancer-skills"
          value={skills}
          onChange={(event) => setSkills(event.target.value)}
          placeholder="Stellar, React, Smart contracts"
        />
        <p className="text-xs text-[#7f7f7f]">Comma-separated, up to 10 skills.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="freelancer-portfolio">Portfolio URL</Label>
          <Input
            id="freelancer-portfolio"
            value={portfolioUrl}
            onChange={(event) => setPortfolioUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="freelancer-website">Website URL</Label>
          <Input
            id="freelancer-website"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {status === "saved" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Profile updated.
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
