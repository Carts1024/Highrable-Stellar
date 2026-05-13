import { EscrowProofPage } from "@/features/proof";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Highrable Escrow Proof",
  description: "Verified Stellar escrow proof for a Highrable micro gig or milestone.",
};

export default async function EscrowProofRoutePage({
  params,
}: {
  params: Promise<{ escrowId: string }>;
}) {
  const resolvedParams = await params;

  return <EscrowProofPage escrowId={resolvedParams.escrowId ?? ""} />;
}
