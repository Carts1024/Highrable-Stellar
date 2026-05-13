export function formatProofDate(timestamp: number | undefined): string {
  if (timestamp === undefined || !Number.isFinite(timestamp)) {
    return "Timestamp not stored";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function sanitizeEscrowIdParam(escrowId: string): string | null {
  const sanitizedEscrowId = escrowId.trim();

  if (!sanitizedEscrowId || sanitizedEscrowId.length > 128) {
    return null;
  }

  return sanitizedEscrowId;
}
