import { toast } from "@repo/ui/toast";

import { sanitizeSingleLineInput } from "./sanitize";

const MAX_TOAST_MESSAGE_LENGTH = 240;
const DEFAULT_SUCCESS_MESSAGE = "Action completed.";
const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";
const DEFAULT_WARNING_MESSAGE = "Check this before continuing.";

export interface IAppToastOptions {
  readonly description?: string;
  readonly id?: string;
  readonly duration?: number;
}

function sanitizeToastText(value: string, fallback: string): string {
  const sanitizedValue = sanitizeSingleLineInput(value).slice(0, MAX_TOAST_MESSAGE_LENGTH);
  return sanitizedValue.length > 0 ? sanitizedValue : fallback;
}

function sanitizeToastOptions(options?: IAppToastOptions): IAppToastOptions | undefined {
  if (!options) {
    return undefined;
  }

  return {
    ...options,
    ...(options.description
      ? { description: sanitizeToastText(options.description, DEFAULT_ERROR_MESSAGE) }
      : {}),
  };
}

export function showSuccessToast(message: string, options?: IAppToastOptions): void {
  toast.success(sanitizeToastText(message, DEFAULT_SUCCESS_MESSAGE), sanitizeToastOptions(options));
}

export function showErrorToast(message: string, options?: IAppToastOptions): void {
  toast.error(sanitizeToastText(message, DEFAULT_ERROR_MESSAGE), sanitizeToastOptions(options));
}

export function showWarningToast(message: string, options?: IAppToastOptions): void {
  toast.warning(sanitizeToastText(message, DEFAULT_WARNING_MESSAGE), sanitizeToastOptions(options));
}
