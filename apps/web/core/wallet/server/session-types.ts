export type TAuthSessionRecord = {
  sessionId: string;
  walletAddress: string;
  walletType: "external_wallet" | "passkey_smart_account";
  authMethod: "external_wallet" | "passkey";
  createdAt: number;
  expiresAt: number;
  profile: {
    name: string | null;
    onboardingCompletedAt: number | null;
    role: "client" | "freelancer" | "admin" | null;
  } | null;
};
