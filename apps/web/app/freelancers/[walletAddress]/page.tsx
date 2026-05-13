import {
  buildNoIndexMetadata,
  buildPageMetadata,
  parseWalletAddressParam,
  sanitizeSeoText,
} from "@/core/seo";
import { createSeoConvexClient, seoApi } from "@/core/seo/convex";
import { FreelancerProfilePage } from "@/features/profile";
import { notFound } from "next/navigation";

import type { Metadata } from "next";
import type { TFreelancerProfileResponse } from "@/features/profile/types";

interface IFreelancerProfileRouteProps {
  readonly params: Promise<{ readonly walletAddress: string }>;
}

const NOT_FOUND_TITLE = "Freelancer Profile Not Found";
const NOT_FOUND_DESCRIPTION = "This Highrable freelancer profile could not be found.";

async function getFreelancerProfileForSeo(
  walletAddress: string,
): Promise<TFreelancerProfileResponse | null> {
  try {
    const convex = createSeoConvexClient();
    return await convex.query(seoApi.profiles.getFreelancerProfile, { walletAddress });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: IFreelancerProfileRouteProps): Promise<Metadata> {
  const { walletAddress } = await params;
  const parsedWalletAddress = parseWalletAddressParam(walletAddress);
  const path = `/freelancers/${encodeURIComponent(parsedWalletAddress ?? "invalid")}`;

  if (!parsedWalletAddress) {
    return buildNoIndexMetadata(NOT_FOUND_TITLE, NOT_FOUND_DESCRIPTION, path);
  }

  const profileData = await getFreelancerProfileForSeo(parsedWalletAddress);

  if (!profileData) {
    return buildNoIndexMetadata(NOT_FOUND_TITLE, NOT_FOUND_DESCRIPTION, path);
  }

  const displayName = sanitizeSeoText(
    profileData.profile.name,
    `Freelancer ${parsedWalletAddress.slice(0, 8)}`,
  );
  const skills = profileData.profile.skills.slice(0, 4).join(", ");
  const description = sanitizeSeoText(
    profileData.profile.bio,
    `${displayName} has ${profileData.stats.completedContracts} escrow-verified completed contracts on Highrable.${skills ? ` Skills: ${skills}.` : ""}`,
  );

  return buildPageMetadata({
    title: `${displayName} Freelancer Profile`,
    description,
    path,
    type: "profile",
  });
}

export default async function FreelancerProfileRoutePage({
  params,
}: IFreelancerProfileRouteProps) {
  const resolvedParams = await params;
  const parsedWalletAddress = parseWalletAddressParam(resolvedParams.walletAddress);

  if (!parsedWalletAddress) {
    notFound();
  }

  return <FreelancerProfilePage walletAddress={parsedWalletAddress} />;
}
