import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import { action } from "./_generated/server";
import { requireNonEmptyString } from "./_shared/input";
import { escrowStatusValidator } from "./escrows/schema";
import {
  getRegistrationFromRegistry,
  isRegisteredInRegistry,
  loadRegistryReadConfig,
} from "./lib/registryReads";
import {
  getCompletionFromContract,
  getEscrowFromContract,
  loadStellarReadConfig,
  loadStellarReadScope,
  normalizeOnChainAddress,
  normalizeOnChainBytes32,
  normalizeOnChainEscrowStatus,
} from "./lib/stellarReads";
import { getConfiguredRegistryScope, sanitizeRegistryWalletAddress } from "./registry/helpers";

type TApplyVerifiedRegistrationArgs = {
  network: string;
  registryContractId: string;
  walletAddress: string;
  registeredAt: number;
  verifiedAt: number;
};

export type TSyncUserRegistrationResult = {
  ok: boolean;
  isRegistered: boolean;
  network?: string;
  registryContractId?: string;
  registeredAt?: number;
  reason?: string;
  errorMessage?: string;
};

const applyVerifiedRegistrationRef = makeFunctionReference<
  "mutation",
  TApplyVerifiedRegistrationArgs,
  string
>("registry/mutations:applyVerifiedRegistration");

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

type TRecordEscrowSyncFailureArgs = {
  escrowId: string;
  onChainStatus?: (typeof escrowStatusValidator)["type"];
  errorMessage: string;
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

const recordEscrowSyncFailureRef = makeFunctionReference<
  "mutation",
  TRecordEscrowSyncFailureArgs,
  TSyncResult
>("syncMutations:recordEscrowSyncFailure");

export const syncEscrowStatus = action({
  args: {
    escrowId: v.string(),
    expectedEscrowContractId: v.string(),
    expectedNetworkPassphrase: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    changed: v.optional(v.boolean()),
    escrowId: v.optional(v.string()),
    previousStatus: v.optional(v.string()),
    newStatus: v.optional(v.string()),
    reason: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<TSyncResult> => {
    const escrowId = requireNonEmptyString(args.escrowId, "escrowId");

    let scope;
    try {
      scope = loadStellarReadScope();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(recordEscrowSyncFailureRef, {
        escrowId,
        errorMessage,
      });
      return {
        ok: false,
        reason: "missing_env_config",
        escrowId,
        errorMessage,
      };
    }

    const expectedEscrowContractId = args.expectedEscrowContractId.trim().toUpperCase();
    const configuredEscrowContractId = scope.escrowContractId.trim().toUpperCase();
    const expectedNetworkPassphrase = args.expectedNetworkPassphrase.trim();

    if (
      expectedEscrowContractId !== configuredEscrowContractId ||
      expectedNetworkPassphrase !== scope.networkPassphrase
    ) {
      return {
        ok: false,
        reason: "contract_config_mismatch",
        escrowId,
        errorMessage: "Web and Convex escrow contract and network settings must match.",
      };
    }

    let config;
    try {
      config = loadStellarReadConfig();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(recordEscrowSyncFailureRef, {
        escrowId,
        errorMessage,
      });
      return {
        ok: false,
        reason: "missing_env_config",
        escrowId,
        errorMessage,
      };
    }

    let onChainEscrow;
    try {
      onChainEscrow = await getEscrowFromContract(config, escrowId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(recordEscrowSyncFailureRef, {
        escrowId,
        errorMessage,
      });
      return {
        ok: false,
        reason: "onchain_read_failed",
        escrowId,
        errorMessage,
      };
    }

    const onChainStatus = normalizeOnChainEscrowStatus(onChainEscrow.status);
    if (!onChainStatus) {
      const errorMessage = `Unrecognized on-chain status: ${JSON.stringify(onChainEscrow.status)}`;
      await ctx.runMutation(recordEscrowSyncFailureRef, {
        escrowId,
        errorMessage,
      });
      return {
        ok: false,
        reason: "unknown_onchain_status",
        escrowId,
        errorMessage,
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

export const syncUserRegistration = action({
  args: {
    walletAddress: v.string(),
    expectedNetwork: v.string(),
    expectedRegistryContractId: v.string(),
  },
  handler: async (ctx, args): Promise<TSyncUserRegistrationResult> => {
    let walletAddress: string;
    let config;
    try {
      walletAddress = sanitizeRegistryWalletAddress(args.walletAddress);
      config = loadRegistryReadConfig();
    } catch (error) {
      return {
        ok: false,
        isRegistered: false,
        reason: "missing_or_invalid_config",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    let expectedScope;
    try {
      expectedScope = getConfiguredRegistryScope();
    } catch (error) {
      return {
        ok: false,
        isRegistered: false,
        reason: "missing_or_invalid_config",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    if (
      args.expectedNetwork.trim().toLowerCase() !== expectedScope.network ||
      args.expectedRegistryContractId.trim().toUpperCase() !== expectedScope.registryContractId
    ) {
      return {
        ok: false,
        isRegistered: false,
        reason: "registry_scope_mismatch",
        errorMessage: "Web and Convex registry network and contract settings must match.",
      };
    }

    let registration;
    let registeredFlag: boolean;
    try {
      [registration, registeredFlag] = await Promise.all([
        getRegistrationFromRegistry(config, walletAddress),
        isRegisteredInRegistry(config, walletAddress),
      ]);
    } catch (error) {
      return {
        ok: false,
        isRegistered: false,
        network: config.network,
        registryContractId: config.registryContractId,
        reason: "registry_read_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    if ((registration !== null) !== registeredFlag) {
      return {
        ok: false,
        isRegistered: false,
        network: config.network,
        registryContractId: config.registryContractId,
        reason: "registry_record_mismatch",
        errorMessage: "Registry membership and registration record disagree.",
      };
    }

    if (!registration) {
      return {
        ok: true,
        isRegistered: false,
        network: config.network,
        registryContractId: config.registryContractId,
        reason: "registration_not_found",
      };
    }

    try {
      await ctx.runMutation(applyVerifiedRegistrationRef, {
        network: config.network,
        registryContractId: config.registryContractId,
        walletAddress,
        registeredAt: registration.registeredAt,
        verifiedAt: Date.now(),
      });
    } catch (error) {
      return {
        ok: false,
        isRegistered: false,
        network: config.network,
        registryContractId: config.registryContractId,
        registeredAt: registration.registeredAt,
        reason: "registry_mirror_update_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      ok: true,
      isRegistered: true,
      network: config.network,
      registryContractId: config.registryContractId,
      registeredAt: registration.registeredAt,
    };
  },
});

// TODO: syncWalletTransactions(walletAddress) is post-MVP.
// Will require historical Stellar transaction indexing via Horizon or a dedicated indexer.
