const HEX_32_BYTES_PATTERN = /^(?:0x)?[0-9a-fA-F]{64}$/;

function hexToBytes(hex: string): Uint8Array {
  const normalizedHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalizedHex.length / 2);

  for (let index = 0; index < normalizedHex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalizedHex.slice(index, index + 2), 16);
  }

  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function toBytesN32Hash(value: string): Promise<Uint8Array> {
  const trimmedValue = value.trim();

  if (HEX_32_BYTES_PATTERN.test(trimmedValue)) {
    return hexToBytes(trimmedValue);
  }

  const encodedValue = new TextEncoder().encode(trimmedValue);
  const digest = await crypto.subtle.digest("SHA-256", encodedValue);
  return new Uint8Array(digest);
}

export function createMilestoneHash({
  jobId,
  milestoneId,
  order,
  title,
}: {
  jobId: string;
  milestoneId: string;
  order: number;
  title: string;
}): string {
  return `milestone:${jobId}:${milestoneId}:${order}:${title.trim()}`;
}
