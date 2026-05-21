import { z } from "zod";

const HANDLE_PATTERN = /^[a-z0-9_-]+$/;
const SOCIAL_HANDLE_PATTERN = /^[a-zA-Z0-9_.-]+$/;

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

export const TOnboardingFormSchema = z.object({
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

export type TOnboardingFormValues = z.input<typeof TOnboardingFormSchema>;
export type TSanitizedOnboardingFormValues = z.output<typeof TOnboardingFormSchema>;

