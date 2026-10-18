"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { cn } from "@repo/ui/lib/utils";

interface IProfileAvatarProps {
  readonly avatarUrl?: string;
  readonly displayName: string;
  readonly fallbackLabel: string;
  readonly className?: string;
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

export function ProfileAvatar({
  avatarUrl,
  displayName,
  fallbackLabel,
  className,
}: IProfileAvatarProps) {
  const safeAvatarUrl = getSafeAvatarUrl(avatarUrl);

  return (
    <Avatar
      className={cn(
        "h-16 w-16 rounded-xl border-2 border-white bg-highrable-orange-2 shadow-md",
        className,
      )}
    >
      {safeAvatarUrl ? <AvatarImage src={safeAvatarUrl} alt={`${displayName} avatar`} /> : null}
      <AvatarFallback className="rounded-[inherit] bg-highrable-orange-2 text-base font-semibold text-[var(--mode-on)]">
        {getInitials(displayName, fallbackLabel)}
      </AvatarFallback>
    </Avatar>
  );
}
