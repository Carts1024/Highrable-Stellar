import type { IWaitlistConfirmationEmailProps } from "./types";

import {
  buildBodyText,
  buildEyebrow,
  buildFeatureList,
  buildDisclaimerText,
  buildInfoCard,
  buildPrimaryButton,
  buildSectionHeading,
  buildSocialLinks,
  escapeEmailHtml,
} from "./components";
import { buildEmailLayout } from "./layout";
import { EMAIL_COLORS, EMAIL_SOCIAL_LINKS } from "./tokens";

function resolveLogoUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/logo/highrable-icon.jpg`;
}

export function getWaitlistConfirmationEmail(props: IWaitlistConfirmationEmailProps): string {
  const escapedEmail = escapeEmailHtml(props.email);

  const content = [
    buildEyebrow("Waitlist confirmed"),
    buildSectionHeading("You're on the Highrable waitlist"),
    buildBodyText(
      `We saved <strong style="color: ${EMAIL_COLORS.text.primary};">${escapedEmail}</strong> for early access to Highrable, the freelance marketplace built around escrow-ready work and Stellar smart contracts.`,
    ),
    buildBodyText(
      "You'll get product updates, private launch notes, and invite details as access opens for freelancers and clients.",
    ),
    buildInfoCard([
      { label: "Platform", value: "Highrable", accentColor: EMAIL_COLORS.text.primary },
      {
        label: "Built for",
        value: "Freelancers, clients, and escrow-backed milestones",
        accentColor: EMAIL_COLORS.brand.orange4,
      },
      {
        label: "Network",
        value: "Stellar smart contracts",
        accentColor: EMAIL_COLORS.brand.stellar,
      },
    ]),
    buildFeatureList([
      "Zero payment risk through escrow-first job flows.",
      "On-chain reputation signals for verified work history.",
      "USDC-ready payments designed for global freelance teams.",
    ]),
    buildPrimaryButton("Visit Highrable", props.siteUrl),
    buildSocialLinks(EMAIL_SOCIAL_LINKS),
    buildDisclaimerText("If you didn't join the waitlist, you can safely ignore this email."),
  ].join("");

  return buildEmailLayout({
    title: "You're on the Highrable waitlist",
    previewText: "You're on the Highrable waitlist. We'll reach out when access opens.",
    content,
    logoUrl: resolveLogoUrl(props.siteUrl),
  });
}
