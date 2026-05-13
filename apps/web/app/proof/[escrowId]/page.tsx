import {
  buildNoIndexMetadata,
  buildPageMetadata,
  parseEscrowIdParam,
  sanitizeSeoText,
} from "@/core/seo";
import { createSeoConvexClient, seoApi } from "@/core/seo/convex";
import { EscrowProofPage } from "@/features/proof";
import { notFound } from "next/navigation";

import type { Metadata } from "next";
import type { TEscrowProof } from "@/features/proof/types";

interface IEscrowProofRouteProps {
  readonly params: Promise<{ readonly escrowId: string }>;
}

const NOT_FOUND_TITLE = "Escrow Proof Not Found";
const NOT_FOUND_DESCRIPTION = "This Highrable escrow proof could not be found.";

async function getEscrowProofForSeo(escrowId: string): Promise<TEscrowProof | null> {
  try {
    const convex = createSeoConvexClient();
    const proof = await convex.query(seoApi.proofs.getEscrowProof, { escrowId });
    return proof as TEscrowProof | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: IEscrowProofRouteProps): Promise<Metadata> {
  const { escrowId } = await params;
  const parsedEscrowId = parseEscrowIdParam(escrowId);
  const path = `/proof/${encodeURIComponent(parsedEscrowId ?? "invalid")}`;

  if (!parsedEscrowId) {
    return buildNoIndexMetadata(NOT_FOUND_TITLE, NOT_FOUND_DESCRIPTION, path);
  }

  const proof = await getEscrowProofForSeo(parsedEscrowId);

  if (!proof) {
    return buildNoIndexMetadata(NOT_FOUND_TITLE, NOT_FOUND_DESCRIPTION, path);
  }

  const title = sanitizeSeoText(proof.job.title, "Highrable Escrow Proof");
  const description = `Verified ${proof.escrow.amount} ${proof.escrow.asset} Stellar escrow proof for a Highrable ${proof.proofType === "milestone" ? "milestone" : "micro gig"}.`;

  return buildPageMetadata({
    title: `${title} Escrow Proof`,
    description,
    path,
    index: proof.escrow.status === "released" || proof.escrow.status === "funded",
  });
}

export default async function EscrowProofRoutePage({
  params,
}: IEscrowProofRouteProps) {
  const resolvedParams = await params;
  const parsedEscrowId = parseEscrowIdParam(resolvedParams.escrowId);

  if (!parsedEscrowId) {
    notFound();
  }

  return <EscrowProofPage escrowId={parsedEscrowId} />;
}
