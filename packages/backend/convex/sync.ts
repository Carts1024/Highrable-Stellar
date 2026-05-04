import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import { action } from "./_generated/server";
import { requireNonEmptyString } from "./_shared/input";
import { escrowStatusValidator } from "./escrows/schema";
import {
  getCompletionFromContract,
  getEscrowFromContract,
  loadStellarReadConfig,
  normalizeOnChainAddress,
  normalizeOnChainBytes32,
  normalizeOnChainEscrowStatus,
} from "./lib/stellarReads";

export type TSyncResult = {
  ok: boolean;
  changed?: boolean;
  escrowId?: string;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  errorMessage?: string;
};

type TApplyEscrowStatusSyncArgs = {
  escrowId: string;
  onChainStatus: (typeof escrowStatusValidator)["type"];
};

type TCreateReputationRecordFromSyncArgs = {
  escrowId: string;
  clientWallet: string;
  freelancerWallet: string;
  rating: number;
  reviewHash?: string;
};

const applyEscrowStatusSyncRef = makeFunctionReference<
  "mutation",
  TApplyEscrowStatusSyncArgs,
  TSyncResult
>("syncMutations:applyEscrowStatusSync");

const createReputationRecordFromSyncRef = makeFunctionReference<
  "mutation",
  TCreateReputationRecordFromSyncArgs,
  TSyncResult
>("syncMutations:createReputationRecordFromSync");

export const syncEscrowStatus = action({
  args: {
    escrowId: v.string(),
  },
  handler: async (ctx, args): Promise<TSyncResult> => {
    const escrowId = requireNonEmptyString(args.escrowId, "escrowId");

    let config;
    try {
      config = loadStellarReadConfig();
    } catch (error) {
      return {
        ok: false,
        reason: "missing_env_config",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    let onChainEscrow;
    try {
      onChainEscrow = await getEscrowFromContract(config, escrowId);
    } catch (error) {
      return {
        ok: false,
        reason: "onchain_read_failed",
        escrowId,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    const onChainStatus = normalizeOnChainEscrowStatus(onChainEscrow.status);
    if (!onChainStatus) {
      return {
        ok: false,
        reason: "unknown_onchain_status",
        escrowId,
        errorMessage: `Unrecognized on-chain status: ${JSON.stringify(onChainEscrow.status)}`,
      };
    }

    return ctx.runMutation(applyEscrowStatusSyncRef, { escrowId, onChainStatus });
  },
});

export const syncReputationRecord = action({
  args: {
    escrowId: v.string(),
  },
  handler: async (ctx, args): Promise<TSyncResult> => {
    const escrowId = requireNonEmptyString(args.escrowId, "escrowId");

    let config;
    try {
      config = loadStellarReadConfig();
    } catch (error) {
      return {
        ok: false,
        reason: "missing_env_config",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    let onChainCompletion;
    try {
      onChainCompletion = await getCompletionFromContract(config, escrowId);
    } catch (error) {
      return {
        ok: false,
        reason: "onchain_read_failed",
        escrowId,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    if (!onChainCompletion) {
      return { ok: false, reason: "onchain_completion_not_found", escrowId };
    }

    let clientWallet: string;
    let freelancerWallet: string;

    try {
      clientWallet = normalizeOnChainAddress(onChainCompletion.client);
      freelancerWallet = normalizeOnChainAddress(onChainCompletion.freelancer);
    } catch (error) {
      return {
        ok: false,
        reason: "onchain_address_parse_failed",
        escrowId,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    const reviewHash = normalizeOnChainBytes32(onChainCompletion.review_hash);
    const rating = onChainCompletion.rating;

    return ctx.runMutation(createReputationRecordFromSyncRef, {
      escrowId,
      clientWallet,
      freelancerWallet,
      rating,
      ...(reviewHash !== undefined ? { reviewHash } : {}),
    });
  },
});

// TODO: syncWalletTransactions(walletAddress) is post-MVP.
// Will require historical Stellar transaction indexing via Horizon or a dedicated indexer.
