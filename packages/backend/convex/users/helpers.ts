import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { TUserRole, TWalletType } from "./schema";

import { BadRequestError, ConflictError } from "../_shared/errors";
import { isConfiguredAdminWallet } from "../_shared/adminAuth";
import { normalizeWalletAddress, optionalNonEmptyString } from "../_shared/input";

const HANDLE_PATTERN = /^[a-z0-9_-]+$/;
const SOCIAL_HANDLE_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const MAX_SKILLS = 10;
const MAX_SKILL_LENGTH = 40;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type TSanitizedOnboardingProfile = {
  firstName: string;
  middleName?: string;
  lastName: string;
  name: string;
  publicHandle: string;
  normalizedPublicHandle: string;
  coreSkills: string[];
  discordHandle?: string;
  xHandle?: string;
  githubUsername?: string;
  avatarStorageId?: Id<"_storage">;
};

export function sanitizeUserName(name: string | undefined): string | undefined {
  return optionalNonEmptyString(name, "name");
}

export function sanitizeUserWalletAddress(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}

export async function findUserByWallet(ctx: QueryCtx, walletAddress: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", walletAddress))
    .unique();
}

export async function findUserByHandle(ctx: QueryCtx, normalizedPublicHandle: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_normalizedPublicHandle", (q) =>
      q.eq("normalizedPublicHandle", normalizedPublicHandle),
    )
    .unique();
}

function sanitizeRequiredText(value: string, fieldName: string, maxLength: number): string {
  const sanitizedValue = value.trim().replace(/\s+/g, " ");
  if (sanitizedValue.length === 0) {
    throw new BadRequestError(`${fieldName} is required.`);
  }

  if (sanitizedValue.length > maxLength) {
    throw new BadRequestError(`${fieldName} must be ${maxLength} characters or less.`);
  }

  return sanitizedValue;
}

function sanitizeOptionalText(
  value: string | undefined,
  fieldName: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const sanitizedValue = value.trim().replace(/\s+/g, " ");
  if (sanitizedValue.length === 0) {
    return undefined;
  }

  if (sanitizedValue.length > maxLength) {
    throw new BadRequestError(`${fieldName} must be ${maxLength} characters or less.`);
  }

  return sanitizedValue;
}

export function sanitizePublicHandle(publicHandle: string): {
  publicHandle: string;
  normalizedPublicHandle: string;
} {
  const normalizedPublicHandle = publicHandle.trim().toLowerCase();
  if (normalizedPublicHandle.length < 3 || normalizedPublicHandle.length > 32) {
    throw new BadRequestError("Public handle must be between 3 and 32 characters.");
  }

  if (!HANDLE_PATTERN.test(normalizedPublicHandle)) {
    throw new BadRequestError(
      "Public handle may only include letters, numbers, underscores, and hyphens.",
    );
  }

  return {
    publicHandle: normalizedPublicHandle,
    normalizedPublicHandle,
  };
}

function sanitizeCoreSkills(coreSkills: string[]): string[] {
  const dedupedSkills = new Map<string, string>();

  for (const skill of coreSkills) {
    const sanitizedSkill = skill.trim().replace(/\s+/g, " ");
    if (sanitizedSkill.length === 0) {
      continue;
    }

    if (sanitizedSkill.length > MAX_SKILL_LENGTH) {
      throw new BadRequestError(`Each core skill must be ${MAX_SKILL_LENGTH} characters or less.`);
    }

    dedupedSkills.set(sanitizedSkill.toLowerCase(), sanitizedSkill);
  }

  const skills = Array.from(dedupedSkills.values());
  if (skills.length === 0) {
    throw new BadRequestError("Add at least one core skill.");
  }

  if (skills.length > MAX_SKILLS) {
    throw new BadRequestError(`Add ${MAX_SKILLS} core skills or fewer.`);
  }

  return skills;
}

function sanitizeOptionalSocialHandle(
  value: string | undefined,
  fieldName: string,
): string | undefined {
  const sanitizedValue = sanitizeOptionalText(value?.replace(/^@/, ""), fieldName, 40);
  if (sanitizedValue === undefined) {
    return undefined;
  }

  if (!SOCIAL_HANDLE_PATTERN.test(sanitizedValue)) {
    throw new BadRequestError(
      `${fieldName} may only include letters, numbers, underscores, dots, and hyphens.`,
    );
  }

  return sanitizedValue;
}

export async function sanitizeOnboardingProfile(
  ctx: QueryCtx,
  args: {
    firstName: string;
    middleName?: string;
    lastName: string;
    publicHandle: string;
    coreSkills: string[];
    discordHandle?: string;
    xHandle?: string;
    githubUsername?: string;
    avatarStorageId?: Id<"_storage">;
  },
): Promise<TSanitizedOnboardingProfile> {
  const firstName = sanitizeRequiredText(args.firstName, "firstName", 60);
  const middleName = sanitizeOptionalText(args.middleName, "middleName", 60);
  const lastName = sanitizeRequiredText(args.lastName, "lastName", 60);
  const handle = sanitizePublicHandle(args.publicHandle);
  const avatarStorageId = await validateAvatarStorage(ctx, args.avatarStorageId);
  const discordHandle = sanitizeOptionalSocialHandle(args.discordHandle, "discordHandle");
  const xHandle = sanitizeOptionalSocialHandle(args.xHandle, "xHandle");
  const githubUsername = sanitizeOptionalSocialHandle(args.githubUsername, "githubUsername");

  return {
    firstName,
    ...(middleName !== undefined ? { middleName } : {}),
    lastName,
    name: [firstName, middleName, lastName].filter(Boolean).join(" "),
    ...handle,
    coreSkills: sanitizeCoreSkills(args.coreSkills),
    ...(discordHandle !== undefined ? { discordHandle } : {}),
    ...(xHandle !== undefined ? { xHandle } : {}),
    ...(githubUsername !== undefined ? { githubUsername } : {}),
    ...(avatarStorageId !== undefined ? { avatarStorageId } : {}),
  };
}

async function validateAvatarStorage(
  ctx: QueryCtx,
  avatarStorageId: Id<"_storage"> | undefined,
): Promise<Id<"_storage"> | undefined> {
  if (avatarStorageId === undefined) {
    return undefined;
  }

  const storageMetadata = await ctx.db.system.get("_storage", avatarStorageId);
  if (!storageMetadata) {
    throw new BadRequestError("Avatar upload was not found.");
  }

  if (storageMetadata.size > MAX_AVATAR_BYTES) {
    throw new BadRequestError("Avatar image must be 2 MB or smaller.");
  }

  if (!storageMetadata.contentType || !ALLOWED_AVATAR_MIME_TYPES.has(storageMetadata.contentType)) {
    throw new BadRequestError("Avatar must be a JPEG, PNG, WebP, or GIF image.");
  }

  return avatarStorageId;
}

export async function assertPublicHandleAvailable(
  ctx: QueryCtx,
  normalizedPublicHandle: string,
  currentUserId: Id<"users"> | undefined,
): Promise<void> {
  const existingHandleOwner = await findUserByHandle(ctx, normalizedPublicHandle);
  if (existingHandleOwner && existingHandleOwner._id !== currentUserId) {
    throw new ConflictError("Public handle is already taken.");
  }
}

export async function ensureUserIdentity(
  ctx: MutationCtx,
  walletAddress: string,
  walletType?: TWalletType,
) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
  const existingUser = await findUserByWallet(ctx, normalizedWalletAddress);
  const adminRolePatch: { role?: TUserRole } = isConfiguredAdminWallet(normalizedWalletAddress)
    ? { role: "admin" }
    : {};

  if (existingUser) {
    const patch = {
      ...adminRolePatch,
      ...(walletType !== undefined && existingUser.walletType !== walletType ? { walletType } : {}),
      updatedAt: Date.now(),
    };

    if (Object.keys(patch).length > 1) {
      await ctx.db.patch(existingUser._id, patch);
    }

    return existingUser._id;
  }

  return await ctx.db.insert("users", {
    walletAddress: normalizedWalletAddress,
    ...adminRolePatch,
    ...(walletType !== undefined ? { walletType } : {}),
    createdAt: Date.now(),
  });
}

export async function ensureOnboardedUser(
  ctx: MutationCtx,
  walletAddress: string,
  walletType?: TWalletType,
) {
  const userId = await ensureUserIdentity(ctx, walletAddress, walletType);
  const user = await ctx.db.get(userId);
  if (!user?.onboardingCompletedAt) {
    throw new BadRequestError("Complete onboarding before using this action.");
  }

  return userId;
}

export async function resolveAvatarUrl(
  ctx: QueryCtx,
  user: { avatarStorageId?: Id<"_storage">; avatarUrl?: string } | null,
): Promise<string | undefined> {
  if (!user) {
    return undefined;
  }

  if (user.avatarStorageId) {
    return (await ctx.storage.getUrl(user.avatarStorageId)) ?? undefined;
  }

  return user.avatarUrl;
}
