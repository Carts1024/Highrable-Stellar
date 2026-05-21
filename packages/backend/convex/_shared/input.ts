export function requireNonEmptyString(value: string, fieldName: string): string {
  const sanitizedValue = value.trim();
  if (sanitizedValue.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return sanitizedValue;
}

export function optionalNonEmptyString(
  value: string | undefined,
  fieldName: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const sanitizedValue = value.trim();
  if (sanitizedValue.length === 0) {
    throw new Error(`${fieldName} cannot be empty when provided.`);
  }

  return sanitizedValue;
}

export function normalizeWalletAddress(walletAddress: string): string {
  return requireNonEmptyString(walletAddress, "walletAddress").toUpperCase();
}

export function requirePositiveNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number.`);
  }

  return value;
}

export function requireRangeNumber(
  value: number,
  fieldName: string,
  minInclusive: number,
  maxInclusive: number,
): number {
  if (!Number.isFinite(value) || value < minInclusive || value > maxInclusive) {
    throw new Error(`${fieldName} must be between ${minInclusive} and ${maxInclusive}.`);
  }

  return value;
}
