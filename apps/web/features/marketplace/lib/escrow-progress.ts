import type { TStellarExecutionPhase } from "@/core/stellar/transaction";
import type { TMarketplaceEscrowProgress } from "@/features/marketplace/types";

export type TMarketplaceEscrowExecutionPhase = TStellarExecutionPhase | "recovering_escrow_id";

export function mapStellarPhaseToMarketplaceProgress(
  phase: TMarketplaceEscrowExecutionPhase,
): TMarketplaceEscrowProgress {
  const progressByPhase: Record<TMarketplaceEscrowExecutionPhase, TMarketplaceEscrowProgress> = {
    simulation: "simulating",
    signing: "awaiting_signature",
    submission: "submitting",
    confirmation: "confirming",
    recovering_escrow_id: "recovering_escrow_id",
  };

  return progressByPhase[phase];
}
