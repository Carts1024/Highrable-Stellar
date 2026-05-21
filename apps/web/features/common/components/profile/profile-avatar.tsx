"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";

interface IProfileAvatarProps {
  readonly avatarUrl?: string;
  readonly displayName: string;
  readonly fallbackLabel: string;
}

function getInitials(displayName: string, fallbackLabel: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || fallbackLabel;
}

function getSafeAvatarUrl(avatarUrl: string | undefined): string | undefined {
  const sanitizedUrl = avatarUrl?.trim();

  if (!sanitizedUrl) {
    return undefined;
  }

  if (sanitizedUrl.startsWith("/")) {
    return sanitizedUrl;
  }

  try {
    const parsedUrl = new URL(sanitizedUrl);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
      ? parsedUrl.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function ProfileAvatar({ avatarUrl, displayName, fallbackLabel }: IProfileAvatarProps) {
  const safeAvatarUrl = getSafeAvatarUrl(avatarUrl);

  return (
    <Avatar className="h-16 w-16 rounded-none border border-[#e8e8e8] bg-[#0a0a0a]">
      {safeAvatarUrl ? <AvatarImage src={safeAvatarUrl} alt={`${displayName} avatar`} /> : null}
      <AvatarFallback className="rounded-none bg-[#0a0a0a] text-xl font-semibold text-white">
        {getInitials(displayName, fallbackLabel)}
      </AvatarFallback>
    </Avatar>
  );
}
