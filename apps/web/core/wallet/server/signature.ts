import { createPublicKey, verify } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0x0000;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let index = 0; index < 8; index += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

function decodeBase32(input: string): Uint8Array {
  const normalized = input.replace(/=+$/u, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error("Invalid base32 character.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Uint8Array.from(output);
}

function decodeStellarPublicKey(publicKey: string): Uint8Array {
  const decoded = decodeBase32(publicKey);
  if (decoded.length !== 35) {
    throw new Error("Invalid Stellar key length.");
  }

  const version = decoded[0];
  if (version !== 6 << 3) {
    throw new Error("Invalid Stellar account version byte.");
  }

  const payload = decoded.slice(0, 33);
  const checksumBytes = decoded.slice(33);
  const checksumLow = checksumBytes.at(0);
  const checksumHigh = checksumBytes.at(1);
  if (checksumLow === undefined || checksumHigh === undefined) {
    throw new Error("Invalid Stellar key checksum bytes.");
  }
  const checksum = checksumLow | (checksumHigh << 8);
  const expectedChecksum = crc16Xmodem(payload);

  if (checksum !== expectedChecksum) {
    throw new Error("Invalid Stellar key checksum.");
  }

  return payload.slice(1);
}

function normalizeSignature(signature: string): Buffer {
  const trimmed = signature.trim();

  if (/^[0-9a-fA-F]+$/u.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, "hex");
  }

  return Buffer.from(trimmed, "base64");
}

function toSpki(publicKeyRaw: Uint8Array): Buffer {
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return Buffer.concat([prefix, Buffer.from(publicKeyRaw)]);
}

export function verifyStellarMessageSignature(input: {
  address: string;
  message: string;
  signature: string;
}): boolean {
  try {
    const publicKeyRaw = decodeStellarPublicKey(input.address);
    const spki = toSpki(publicKeyRaw);
    const key = createPublicKey({ key: spki, format: "der", type: "spki" });
    const messageBytes = Buffer.from(input.message, "utf8");
    const signature = normalizeSignature(input.signature);

    // Ed25519 signatures in Node must be verified with a null algorithm parameter.
    return verify(null, messageBytes, key, signature);
  } catch {
    return false;
  }
}
