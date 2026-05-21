import { z } from "zod";

import type { TConvexStorageId } from "@repo/convex-client";

const HANDLE_PATTERN = /^[a-z0-9_-]+$/;
const SOCIAL_HANDLE_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function optionalHandleSchema(label: string) {
  return z
    .string()
    .transform((value) => value.trim().replace(/^@/, ""))
    .pipe(
      z
        .string()
        .max(40, `${label} must be 40 characters or less.`)
        .refine(
          (value) => value.length === 0 || SOCIAL_HANDLE_PATTERN.test(value),
          `${label} may only include letters, numbers, underscores, dots, and hyphens.`,
        ),
    )
    .optional();
}

export const TProfileIdentityFormSchema = z.object({
  firstName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(1, "First name is required.").max(60, "First name is too long.")),
  middleName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().max(60, "Middle name is too long."))
    .optional(),
  lastName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(1, "Last name is required.").max(60, "Last name is too long.")),
  publicHandle: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(3, "Public handle must be at least 3 characters.")
        .max(32, "Public handle must be 32 characters or less.")
        .refine(
          (value) => HANDLE_PATTERN.test(value),
          "Use letters, numbers, underscores, and hyphens only.",
        ),
    ),
  coreSkills: z
    .array(z.string().transform(normalizeText))
    .transform((skills) => {
      const deduped = new Map<string, string>();
      for (const skill of skills) {
        if (skill.length > 0) {
          deduped.set(skill.toLowerCase(), skill);
        }
      }
      return Array.from(deduped.values());
    })
    .pipe(
      z
        .array(z.string().min(1).max(40, "Each skill must be 40 characters or less."))
        .min(1, "Add at least one core skill.")
        .max(10, "Add 10 core skills or fewer."),
    ),
  discordHandle: optionalHandleSchema("Discord"),
  xHandle: optionalHandleSchema("X"),
  githubUsername: optionalHandleSchema("GitHub"),
});

export type TProfileIdentityFormValues = z.input<typeof TProfileIdentityFormSchema>;
export type TSanitizedProfileIdentityFormValues = z.output<typeof TProfileIdentityFormSchema>;

export function parseSkillsInput(skills: string): string[] {
  return skills
    .split(",")
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0);
}

export function getOptionalProfileValue(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_MIME_TYPES.has(file.type)) {
    return "Avatar must be a JPEG, PNG, WebP, or GIF image.";
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return "Avatar image must be 2 MB or smaller.";
  }

  return null;
}

export function buildProfileIdentityMutationArgs(
  values: TSanitizedProfileIdentityFormValues,
  avatarStorageId: TConvexStorageId | undefined,
) {
  return {
    firstName: values.firstName,
    ...(getOptionalProfileValue(values.middleName) ? { middleName: values.middleName } : {}),
    lastName: values.lastName,
    publicHandle: values.publicHandle,
    coreSkills: values.coreSkills,
    ...(getOptionalProfileValue(values.discordHandle)
      ? { discordHandle: values.discordHandle }
      : {}),
    ...(getOptionalProfileValue(values.xHandle) ? { xHandle: values.xHandle } : {}),
    ...(getOptionalProfileValue(values.githubUsername)
      ? { githubUsername: values.githubUsername }
      : {}),
    ...(avatarStorageId ? { avatarStorageId } : {}),
  };
}
