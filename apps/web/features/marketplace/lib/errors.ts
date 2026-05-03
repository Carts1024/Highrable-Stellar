type TErrorPayload = {
  message?: unknown;
  code?: unknown;
};

type TConvexLikeError = {
  message?: unknown;
  data?: TErrorPayload;
};

export function getReadableErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "object" && error !== null) {
    const convexError = error as TConvexLikeError;

    if (typeof convexError.data?.message === "string" && convexError.data.message.trim().length > 0) {
      return convexError.data.message.trim();
    }

    if (typeof convexError.message === "string" && convexError.message.trim().length > 0) {
      return convexError.message.trim();
    }
  }

  return fallbackMessage;
}
