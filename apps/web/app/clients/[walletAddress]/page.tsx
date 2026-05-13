import { ClientProfilePage } from "@/features/client-profile";
import { notFound } from "next/navigation";

export default async function ClientProfileRoutePage({
  params,
}: {
  params: Promise<{ walletAddress: string }>;
}) {
  const resolvedParams = await params;

  if (!resolvedParams.walletAddress) {
    notFound();
  }

  return <ClientProfilePage walletAddress={resolvedParams.walletAddress} />;
}
