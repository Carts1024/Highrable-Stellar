const PUBLIC_ENV = [
  "NEXT_PUBLIC_STELLAR_NETWORK",
  "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE",
  "NEXT_PUBLIC_STELLAR_RPC_URL",
  "NEXT_PUBLIC_STELLAR_HORIZON_URL",
  "NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH",
  "NEXT_PUBLIC_SMART_ACCOUNT_WASM_SHA256",
  "NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID",
  "NEXT_PUBLIC_WEBAUTHN_VERIFIER_WASM_SHA256",
  "NEXT_PUBLIC_APP_DOMAIN",
  "NEXT_PUBLIC_PASSKEY_RP_NAME",
  "NEXT_PUBLIC_SMART_ACCOUNT_FACTORY_CONTRACT_ID",
  "NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_LABEL",
  "NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_VERSION",
  "NEXT_PUBLIC_SMART_ACCOUNT_SOURCE_REPO",
  "NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND",
  "NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL",
  "NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID",
  "NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID",
  "NEXT_PUBLIC_USDC_ASSET_CODE",
  "NEXT_PUBLIC_USDC_ASSET_ISSUER",
  "NEXT_PUBLIC_ESCROW_CONTRACT_ID",
  "NEXT_PUBLIC_REPUTATION_CONTRACT_ID",
] as const;

const PRIVATE_ENV = [
  "SMART_ACCOUNT_RELAYER_PRIVATE_KEY",
  "SMART_ACCOUNT_RELAYER_PUBLIC_KEY",
  "SMART_ACCOUNT_CHANNELS_API_KEY",
  "SMART_ACCOUNT_ALLOWED_TARGET_CONTRACTS",
  "SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_TX",
  "SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_ACCOUNT_DAILY",
  "SMART_ACCOUNT_RELAY_RATE_LIMIT_PER_MINUTE",
] as const;

const SECRET_NAMES = new Set([
  "SMART_ACCOUNT_RELAYER_PRIVATE_KEY",
  "SMART_ACCOUNT_CHANNELS_API_KEY",
]);

function status(name: string): string {
  const value = process.env[name];
  if (!value) {
    return "missing";
  }
  return SECRET_NAMES.has(name) ? "set (secret hidden)" : value;
}

console.log("Required public frontend env vars:");
for (const name of PUBLIC_ENV) {
  console.log(`${name}=${status(name)}`);
}

console.log("");
console.log("Required private backend/relayer env vars:");
for (const name of PRIVATE_ENV) {
  console.log(`${name}=${status(name)}`);
}

for (const name of PRIVATE_ENV) {
  const publicName = `NEXT_PUBLIC_${name}`;
  if (process.env[publicName]) {
    console.warn(
      `WARN: ${publicName} is set. Do not expose private relayer credentials to the browser.`,
    );
  }
}
