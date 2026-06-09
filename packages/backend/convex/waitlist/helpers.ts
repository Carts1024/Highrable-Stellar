import sanitizeHtml from "sanitize-html";

import { BadRequestError } from "../_shared/errors";

const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeWaitlistEmail(value: string): string {
  const email = sanitizeHtml(value, {
    allowedAttributes: {},
    allowedTags: [],
  }).trim();

  if (email.length === 0) {
    throw new BadRequestError("Email is required.");
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    throw new BadRequestError("Email must be 254 characters or fewer.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new BadRequestError("Please enter a valid email address.");
  }

  return email;
}

export function normalizeWaitlistEmail(email: string): string {
  return email.toLowerCase();
}

export function requireWaitlistEmailFrom(): string {
  const from = process.env.HIGHRABLE_WAITLIST_EMAIL_FROM?.trim();

  if (!from) {
    throw new Error("Missing required Convex environment variable: HIGHRABLE_WAITLIST_EMAIL_FROM");
  }

  return from;
}

export function resolveHighrableAppUrl(): string {
  return process.env.HIGHRABLE_APP_URL?.trim() || "https://highrable.work";
}
