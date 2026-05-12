import { stablecoinConfig } from "./stablecoin-config";

export const STABLECOIN_DECIMALS = stablecoinConfig.decimals;

function getDecimalScale(decimals: number): bigint {
  return 10n ** BigInt(decimals);
}

function normalizeDecimals(decimals: number = stablecoinConfig.decimals): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Stablecoin decimals must be an integer between 0 and 18.");
  }

  return decimals;
}

function normalizeHumanAmount(value: number | string): string {
  const rawValue = typeof value === "number" ? value.toString() : value;
  const sanitizedValue = rawValue.trim();

  if (!/^\d+(\.\d+)?$/.test(sanitizedValue)) {
    throw new Error("Invalid amount. Please enter a valid stablecoin amount.");
  }

  return sanitizedValue;
}

function formatHumanAmountString(amount: string): string {
  const [wholePart = "0", fractionalPart = ""] = amount.split(".");
  const normalizedWholePart = wholePart.replace(/^0+(?=\d)/, "");
  const trimmedFraction = fractionalPart.replace(/0+$/, "");

  return trimmedFraction
    ? `${normalizedWholePart || "0"}.${trimmedFraction}`
    : normalizedWholePart || "0";
}

// Convex amounts are stored in human stablecoin units.
// Smart-contract calls receive raw integer token units derived from the configured decimals.
export function parseHumanAmount(input: string): string {
  return formatHumanAmountString(normalizeHumanAmount(input));
}

export function toTokenUnits(
  humanAmount: number | string,
  decimals: number = stablecoinConfig.decimals,
): bigint {
  const resolvedDecimals = normalizeDecimals(decimals);
  const normalizedAmount = normalizeHumanAmount(humanAmount);
  const [wholePart = "0", fractionalPart = ""] = normalizedAmount.split(".");

  if (fractionalPart.length > resolvedDecimals) {
    throw new Error(
      `Stablecoin amount supports up to ${resolvedDecimals} decimal places.`,
    );
  }

  const scale = getDecimalScale(resolvedDecimals);
  const normalizedFraction = fractionalPart.padEnd(resolvedDecimals, "0");
  const rawAmount = BigInt(wholePart) * scale + BigInt(normalizedFraction || "0");

  if (rawAmount <= 0n) {
    throw new Error("Escrow amount must be greater than zero.");
  }

  return rawAmount;
}

export function fromTokenUnits(
  rawAmount: bigint | number | string,
  decimals: number = stablecoinConfig.decimals,
): string {
  const resolvedDecimals = normalizeDecimals(decimals);
  const normalizedRawAmount = BigInt(rawAmount);
  const isNegative = normalizedRawAmount < 0n;
  const absoluteRawAmount = isNegative ? normalizedRawAmount * -1n : normalizedRawAmount;
  const scale = getDecimalScale(resolvedDecimals);
  const wholePart = absoluteRawAmount / scale;
  const fractionalPart = absoluteRawAmount % scale;
  const formattedFraction = fractionalPart.toString().padStart(resolvedDecimals, "0");
  const trimmedFraction = formattedFraction.replace(/0+$/, "");
  const humanAmount = trimmedFraction
    ? `${wholePart.toString()}.${trimmedFraction}`
    : wholePart.toString();

  return isNegative ? `-${humanAmount}` : humanAmount;
}

export function formatTokenAmount(
  amount: bigint | number | string,
  symbol: string,
  decimals: number = stablecoinConfig.decimals,
): string {
  const humanAmount =
    typeof amount === "bigint" ? fromTokenUnits(amount, decimals) : formatHumanAmountString(String(amount));

  return `${humanAmount} ${symbol}`;
}

export function toTokenAmount(amount: number | string): bigint {
  return toTokenUnits(amount, stablecoinConfig.decimals);
}

export function fromTokenAmount(amount: bigint | number | string): string {
  return fromTokenUnits(amount, stablecoinConfig.decimals);
}
