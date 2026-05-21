export function normalizeWalletAddress(walletAddress: string | null | undefined): string {
  return walletAddress?.trim().toUpperCase() ?? "";
}

export function isSameWallet(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeWalletAddress(left);
  const normalizedRight = normalizeWalletAddress(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function shortenWalletAddress(walletAddress: string | null | undefined): string {
  if (!walletAddress) {
    return "-";
  }

  const trimmedAddress = walletAddress.trim();
  if (trimmedAddress.length <= 12) {
    return trimmedAddress;
  }

  return `${trimmedAddress.slice(0, 6)}...${trimmedAddress.slice(-4)}`;
}
