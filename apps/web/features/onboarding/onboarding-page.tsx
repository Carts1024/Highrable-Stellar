"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  TOnboardingFormSchema,
  type TOnboardingFormValues,
} from "@/features/onboarding/types";
import { api, type TConvexStorageId } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import { ImageUp, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function parseSkills(skills: string): string[] {
  return skills
    .split(",")
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0);
}

function getOptionalValue(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function validateAvatarFile(file: File): string | null {
  if (!AVATAR_MIME_TYPES.has(file.type)) {
    return "Avatar must be a JPEG, PNG, WebP, or GIF image.";
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return "Avatar image must be 2 MB or smaller.";
  }

  return null;
}

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
      setError("Connect a wallet or passkey account before onboarding.");
      return;
    }

    const parsed = TOnboardingFormSchema.safeParse({
      ...values,
      coreSkills: parseSkills(skillsInput),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your onboarding details.");
      return;
    }

    setStatus("saving");
    try {
      const avatarStorageId = await uploadAvatar();
      await completeOnboarding({
        walletAddress: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        firstName: parsed.data.firstName,
        ...(getOptionalValue(parsed.data.middleName) ? { middleName: parsed.data.middleName } : {}),
        lastName: parsed.data.lastName,
        publicHandle: parsed.data.publicHandle,
        coreSkills: parsed.data.coreSkills,
        ...(getOptionalValue(parsed.data.discordHandle)
          ? { discordHandle: parsed.data.discordHandle }
          : {}),
        ...(getOptionalValue(parsed.data.xHandle) ? { xHandle: parsed.data.xHandle } : {}),
        ...(getOptionalValue(parsed.data.githubUsername)
          ? { githubUsername: parsed.data.githubUsername }
          : {}),
        ...(avatarStorageId ? { avatarStorageId } : {}),
      });
      router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch (caughtError) {
      setError(getReadableErrorMessage(caughtError, "Could not complete onboarding."));
      setStatus("idle");
    }
  };

  if (!walletIdentity.isConnected) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <p className="font-mono text-xs tracking-[0.08em] text-[#FF7003] uppercase">
            Highrable onboarding
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0a0a0a]">Create your profile</h1>
          <p className="mt-3 text-sm text-[#5f5f5f]">{helperText}</p>
        </div>
        <WalletConnectTrigger className="rounded-lg bg-[#FF7003] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#e76502]" />
      </div>
    );
  }

  if (isLoading || isComplete) {
    return <p className="text-sm text-[#5f5f5f]">Loading onboarding...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.08em] text-[#FF7003] uppercase">
          Highrable onboarding
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0a0a0a]">Create your public profile</h1>
        <p className="mt-3 text-sm text-[#5f5f5f]">{helperText}</p>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5 rounded-xl border border-[#e8e8e8] bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="onboarding-first-name">First name</Label>
            <Input
              id="onboarding-first-name"
              value={values.firstName}
              maxLength={60}
              onChange={(event) => setField("firstName", event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onboarding-middle-name">Middle name</Label>
            <Input
              id="onboarding-middle-name"
              value={values.middleName ?? ""}
              maxLength={60}
              onChange={(event) => setField("middleName", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onboarding-last-name">Last name</Label>
            <Input
              id="onboarding-last-name"
              value={values.lastName}
              maxLength={60}
              onChange={(event) => setField("lastName", event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="onboarding-handle">Public handle</Label>
            <Input
              id="onboarding-handle"
              value={values.publicHandle}
              maxLength={32}
              onChange={(event) => setField("publicHandle", event.target.value)}
              placeholder="stellar_builder"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onboarding-skills">Core skills</Label>
            <Input
              id="onboarding-skills"
              value={skillsInput}
              onChange={(event) => {
                setSkillsInput(event.target.value);
                setError(null);
              }}
              placeholder="Stellar, React, Smart contracts"
              required
            />
            <p className="text-xs text-[#7f7f7f]">Comma-separated, up to 10 skills.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="onboarding-discord">Discord</Label>
            <Input
              id="onboarding-discord"
              value={values.discordHandle ?? ""}
              maxLength={40}
              onChange={(event) => setField("discordHandle", event.target.value)}
              placeholder="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onboarding-x">X</Label>
            <Input
              id="onboarding-x"
              value={values.xHandle ?? ""}
              maxLength={40}
              onChange={(event) => setField("xHandle", event.target.value)}
              placeholder="@handle"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onboarding-github">GitHub</Label>
            <Input
              id="onboarding-github"
              value={values.githubUsername ?? ""}
              maxLength={40}
              onChange={(event) => setField("githubUsername", event.target.value)}
              placeholder="username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboarding-avatar">Avatar</Label>
          <div className="flex flex-wrap items-center gap-3">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="Selected avatar preview"
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f5f5] text-[#7f7f7f]">
                <ImageUp className="h-5 w-5" aria-hidden="true" />
              </div>
            )}
            <Input
              id="onboarding-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="max-w-sm"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                const validationError = file ? validateAvatarFile(file) : null;
                setAvatarFile(validationError ? null : file);
                setError(validationError);
              }}
            />
            {avatarFile ? (
              <AppButton type="button" variant="ghost" onClick={() => setAvatarFile(null)}>
                <X className="mr-2 h-4 w-4" aria-hidden="true" />
                Remove
              </AppButton>
            ) : null}
          </div>
        </div>

        <p className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3 text-sm text-[#5f5f5f]">
          Highrable does not lock you into a client or freelancer role. Use this same profile to
          hire talent, apply for work, or both. Platform admin is the only permanent role.
        </p>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <AppButton type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Saving..." : "Complete onboarding"}
          </AppButton>
        </div>
      </form>
    </div>
  );
}
