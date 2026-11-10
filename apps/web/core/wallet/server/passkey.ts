import { env } from "@/core/config/env";
import { readDefaultContextRule } from "@/core/stellar/smart-account-context-rules";

const CONTRACT_ACCOUNT_PATTERN = /^C[A-Z2-7]{55}$/;
const SECP256R1_PUBLIC_KEY_SIZE = 65;

function normalizeCredentialId(value: string): string {
  return value.trim().replace(/=+$/u, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function getRpId(): string {
  const domain = env.NEXT_PUBLIC_APP_DOMAIN.trim();
  return new URL(domain.includes("://") ? domain : `https://${domain}`).hostname;
}

export function getPasskeyWebAuthnConfig(): { rpID: string; expectedOrigin: string } {
  const expectedOrigin = env.NEXT_PUBLIC_APP_DOMAIN.trim();
  const rpID = getRpId();
  if (!expectedOrigin || !rpID) {
    throw new Error("Passkey relying-party configuration is missing.");
  }
  return { rpID, expectedOrigin };
}

export async function resolveOnChainPasskeyCredential(input: {
  address: string;
  credentialId?: string;
}): Promise<{ credentialId: string; publicKey: Uint8Array; verifierAddress: string }> {
  const address = input.address.trim().toUpperCase();
  if (!CONTRACT_ACCOUNT_PATTERN.test(address)) {
    throw new Error("Passkey authentication requires a deployed smart account address.");
  }
  const verifierAddress = env.NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID?.trim().toUpperCase();
  const sourceAccount = env.STELLAR_READ_SOURCE_ACCOUNT?.trim();
  if (!verifierAddress || !sourceAccount) {
    throw new Error("Passkey server verification is not configured.");
  }

  const rule = await readDefaultContextRule({
    rpcUrl: env.NEXT_PUBLIC_STELLAR_RPC_URL,
    networkPassphrase: env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    contractId: address,
    sourceAccount,
  });
  if (!rule || rule.context_type.tag !== "Default") {
    throw new Error("The smart account does not have a default passkey signer rule.");
  }
  const externalSigners = rule.signers.filter((signer) => signer.tag === "External");
  const requestedCredentialId = input.credentialId
    ? normalizeCredentialId(input.credentialId)
    : null;
  const signer = externalSigners.find((candidate) => {
    const keyData = candidate.values[1];
    const candidateCredentialId = normalizeCredentialId(
      Buffer.from(keyData.subarray(SECP256R1_PUBLIC_KEY_SIZE)).toString("base64url"),
    );
    return requestedCredentialId === null || candidateCredentialId === requestedCredentialId;
  });
  if (!signer) {
    throw new Error("The selected passkey is not an active signer on this smart account.");
  }

  if (signer.values[0].trim().toUpperCase() !== verifierAddress) {
    throw new Error("This smart account does not use the configured WebAuthn verifier.");
  }

  const keyData = signer.values[1];
  if (keyData.length <= SECP256R1_PUBLIC_KEY_SIZE) {
    throw new Error("The smart account signer does not contain a WebAuthn credential.");
  }

  return {
    credentialId: normalizeCredentialId(
      Buffer.from(keyData.subarray(SECP256R1_PUBLIC_KEY_SIZE)).toString("base64url"),
    ),
    publicKey: keyData.subarray(0, SECP256R1_PUBLIC_KEY_SIZE),
    verifierAddress,
  };
}
