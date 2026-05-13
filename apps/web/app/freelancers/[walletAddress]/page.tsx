import { FreelancerProfilePage } from "@/features/profile";
import { notFound } from "next/navigation";

export default async function FreelancerProfileRoutePage({
  params,
}: {
  params: Promise<{ walletAddress: string }>;
}) {
  const resolvedParams = await params;

  if (!resolvedParams.walletAddress) {
    notFound();
  }

  return <FreelancerProfilePage walletAddress={resolvedParams.walletAddress} />;
}
