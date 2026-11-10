import { createHash } from "node:crypto";

import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { verifyStellarMessageSignature } from "./signature";

describe("external wallet signature acceptance", () => {
  it("accepts raw and Freighter-prefixed Ed25519 signatures in supported encodings", () => {
    const signer = Keypair.random();
    const message = "Highrable acceptance challenge with a unique nonce";
    const prefixed = createHash("sha256").update(`Stellar Signed Message:\n${message}`).digest();
    for (const bytes of [Buffer.from(message), prefixed]) {
      for (const encoding of ["hex", "base64"] as const) {
        expect(
          verifyStellarMessageSignature({
            address: signer.publicKey(),
            message,
            signature: signer.sign(bytes).toString(encoding),
          }),
        ).toBe(true);
      }
    }
  });
  it("rejects another wallet, a changed challenge, malformed keys and malformed signatures", () => {
    const signer = Keypair.random();
    const message = "Highrable acceptance nonce";
    const signature = signer.sign(Buffer.from(message)).toString("base64");
    expect(
      verifyStellarMessageSignature({ address: Keypair.random().publicKey(), message, signature }),
    ).toBe(false);
    expect(
      verifyStellarMessageSignature({
        address: signer.publicKey(),
        message: `${message}-changed`,
        signature,
      }),
    ).toBe(false);
    expect(verifyStellarMessageSignature({ address: "GFORGED", message, signature })).toBe(false);
    expect(
      verifyStellarMessageSignature({
        address: signer.publicKey(),
        message,
        signature: "not-a-signature",
      }),
    ).toBe(false);
  });
});
