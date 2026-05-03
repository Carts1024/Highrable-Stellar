import { z } from "zod";

export const TStellarPublicKeySchema = z
  .string()
  .trim()
  .regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key format");

export const TSignatureSchema = z
  .string()
  .trim()
  .min(16, "Signature is too short")
  .max(4096, "Signature is too long");

export const TNonceSchema = z
  .string()
  .trim()
  .min(16, "Nonce is too short")
  .max(256, "Nonce is too long");

export const TMessageSchema = z
  .string()
  .trim()
  .min(16, "Message is too short")
  .max(4096, "Message is too long");

export const TTransactionXdrSchema = z
  .string()
  .trim()
  .min(32, "Transaction XDR is too short")
  .max(200000, "Transaction XDR is too long");

export const TChallengeRequestSchema = z.object({
  address: TStellarPublicKeySchema,
});

export const TVerifyRequestSchema = z.object({
  address: TStellarPublicKeySchema,
  signature: TSignatureSchema,
  message: TMessageSchema,
  nonce: TNonceSchema,
});
