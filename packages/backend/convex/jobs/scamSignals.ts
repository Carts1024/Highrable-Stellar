const HARD_BLOCK_PATTERNS = [
  /\bseed phrase\b/i,
  /\brecovery phrase\b/i,
  /\bprivate key\b/i,
  /\bsend crypto first\b/i,
  /\bsend (?:your )?crypto\b/i,
] as const;

export const DISALLOWED_JOB_POST_MESSAGE =
  "Job posts asking for seed phrases, private keys, or upfront crypto payments are not allowed.";

export function containsDisallowedJobPostLanguage(args: {
  title: string;
  description: string;
}): boolean {
  const content = `${args.title} ${args.description}`;
  return HARD_BLOCK_PATTERNS.some((pattern) => pattern.test(content));
}
