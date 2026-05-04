export const STABLECOIN_DECIMALS = 7;

const DECIMAL_SCALE = BigInt(10 ** STABLECOIN_DECIMALS);

export function toTokenAmount(amount: number | string): bigint {
  const rawAmount = String(amount).trim();

  if (!/^\d+(\.\d+)?$/.test(rawAmount)) {
    throw new Error("Enter a valid stablecoin amount.");
  }

  const [wholePart = "0", fractionalPart = ""] = rawAmount.split(".");
  const normalizedFraction = fractionalPart.padEnd(STABLECOIN_DECIMALS, "0");

  if (fractionalPart.length > STABLECOIN_DECIMALS) {
    throw new Error(`Stablecoin amount supports up to ${STABLECOIN_DECIMALS} decimal places.`);
  }

  const tokenAmount =
    BigInt(wholePart) * DECIMAL_SCALE + BigInt(normalizedFraction.slice(0, STABLECOIN_DECIMALS));

  if (tokenAmount <= 0n) {
    throw new Error("Escrow amount must be greater than zero.");
  }

  return tokenAmount;
}

export function fromTokenAmount(amount: bigint | string): string {
  const tokenAmount = BigInt(amount);
  const wholePart = tokenAmount / DECIMAL_SCALE;
  const fractionalPart = tokenAmount % DECIMAL_SCALE;
  const formattedFraction = fractionalPart.toString().padStart(STABLECOIN_DECIMALS, "0");
  const trimmedFraction = formattedFraction.replace(/0+$/, "");

  return trimmedFraction ? `${wholePart.toString()}.${trimmedFraction}` : wholePart.toString();
}
