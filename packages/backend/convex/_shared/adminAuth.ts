import { ForbiddenError } from "./errors";
import { normalizeWalletAddress, requireNonEmptyString } from "./input";

function getConfiguredAdminWalletAddress(): string | null {
  const configured = process.env.HIGHRABLE_ADMIN_WALLET_ADDRESS;
  if (!configured) {
    return null;
  }

  return normalizeWalletAddress(configured);
}

function getConfiguredAdminApiSecret(): string | null {
  const configured = process.env.HIGHRABLE_ADMIN_CONVEX_SECRET;
  if (!configured) {
    return null;
  }

  return requireNonEmptyString(configured, "HIGHRABLE_ADMIN_CONVEX_SECRET");
}

export function isConfiguredAdminWallet(walletAddress: string): boolean {
  const configuredAdminWallet = getConfiguredAdminWalletAddress();
  if (!configuredAdminWallet) {
    return false;
  }

  return normalizeWalletAddress(walletAddress) === configuredAdminWallet;
}

export function assertConfiguredAdminWallet(walletAddress: string): string {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
  if (!isConfiguredAdminWallet(normalizedWalletAddress)) {
    throw new ForbiddenError("Admin access is restricted to the configured platform wallet.");
  }

  return normalizedWalletAddress;
}

export function assertAdminApiSecret(secret: string): void {
  const configuredAdminSecret = getConfiguredAdminApiSecret();
  if (!configuredAdminSecret) {
    throw new ForbiddenError("Admin API secret is not configured.");
  }

  const providedSecret = requireNonEmptyString(secret, "adminApiSecret");
  if (providedSecret !== configuredAdminSecret) {
    throw new ForbiddenError("Invalid admin API secret.");
  }
}