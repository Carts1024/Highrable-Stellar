import {
  buildNoIndexMetadata,
  buildPageMetadata,
  parseWalletAddressParam,
  sanitizeSeoText,
} from "@/core/seo";
import { createSeoConvexClient, seoApi } from "@/core/seo/convex";
import { ClientProfilePage } from "@/features/client-profile";
import { notFound } from "next/navigation";

import type { Metadata } from "next";
import type { TClientTrustProfileResponse } from "@/features/client-profile/types";

interface IClientProfileRouteProps {
  readonly params: Promise<{ readonly walletAddress: string }>;
}

const NOT_FOUND_TITLE = "Client Profile Not Found";
const NOT_FOUND_DESCRIPTION = "This Highrable client trust profile could not be found.";

async function getClientProfileForSeo(
  walletAddress: string,
): Promise<TClientTrustProfileResponse | null> {
  try {
    const convex = createSeoConvexClient();
    return await convex.query(seoApi.profiles.getClientTrustProfile, { walletAddress });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: IClientProfileRouteProps): Promise<Metadata> {
  const { walletAddress } = await params;
  const parsedWalletAddress = parseWalletAddressParam(walletAddress);
  const path = `/clients/${encodeURIComponent(parsedWalletAddress ?? "invalid")}`;

  if (!parsedWalletAddress) {
    return buildNoIndexMetadata(NOT_FOUND_TITLE, NOT_FOUND_DESCRIPTION, path);
  }

  const profileData = await getClientProfileForSeo(parsedWalletAddress);

  if (!profileData) {
    return buildNoIndexMetadata(NOT_FOUND_TITLE, NOT_FOUND_DESCRIPTION, path);
  }

  const displayName = sanitizeSeoText(
    profileData.profile.companyName ?? profileData.profile.name,
    `Client ${parsedWalletAddress.slice(0, 8)}`,
  );
  const description = sanitizeSeoText(
    profileData.profile.bio,
    `${displayName} has posted ${profileData.stats.jobsPosted} jobs and completed ${profileData.stats.completedEscrows} Stellar escrow payments on Highrable.`,
  );

  return buildPageMetadata({
    title: `${displayName} Client Trust Profile`,
    description,
    path,
    type: "profile",
  });
}

export default async function ClientProfileRoutePage({
  params,
}: IClientProfileRouteProps) {
  const resolvedParams = await params;
  const parsedWalletAddress = parseWalletAddressParam(resolvedParams.walletAddress);

  if (!parsedWalletAddress) {
    notFound();
  }

  return <ClientProfilePage walletAddress={parsedWalletAddress} />;
}
