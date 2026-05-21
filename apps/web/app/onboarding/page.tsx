import { buildNoIndexMetadata } from "@/core/seo";
import { OnboardingPage } from "@/features/onboarding";

import type { Metadata } from "next";

export const metadata: Metadata = buildNoIndexMetadata(
  "Complete onboarding | Highrable",
  "Complete your Highrable profile after connecting a wallet or passkey account.",
  "/onboarding",
);

export default function OnboardingRoutePage() {
  return <OnboardingPage />;
}
