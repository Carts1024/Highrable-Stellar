import type { ISmartAccountMainnetReadiness } from "@/core/stellar/mainnet-readiness";
import type { THighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import type { TPasskeySmartAccountState } from "@/core/wallet/passkey-smart-account-context";
import type { TConvexDoc } from "@repo/convex-client";

export interface IHighrableDebuggerEscrowSyncStatus {
  readonly latestEscrowId: string | null;
  readonly convexStatus: string | null;
  readonly lastSyncedOnChainStatus: string | null;
  readonly lastSyncOutcome: string | null;
  readonly lastSyncAt: number | null;
  readonly lastSyncErrorMessage: string | null;
}

export interface IHighrableDebuggerEscrowOverview {
  readonly total: number;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly syncErrorCount: number;
}

export interface IManagedEscrowSyncMetadata {
  readonly lastSyncAt?: number;
  readonly lastSyncOutcome?: string;
  readonly lastSyncedOnChainStatus?: string;
  readonly lastSyncErrorMessage?: string;
}

export type TManagedEscrow = TConvexDoc<"escrows"> & IManagedEscrowSyncMetadata;

export interface IHighrableDebuggerState {
  readonly passkeySmartAccountReadiness: TPasskeySmartAccountState & {
    readonly hasConfig: boolean;
    readonly isSupported: boolean;
  };
  readonly mainnetSmartAccountReadiness: ISmartAccountMainnetReadiness;
  readonly productionHardeningWarnings: readonly string[];
  readonly activeHighrableIdentity: THighrableWalletIdentity;
  readonly usePasskeySmartAccount: boolean;
  readonly escrowManagement: IHighrableDebuggerEscrowOverview;
  readonly escrowSyncStatus: IHighrableDebuggerEscrowSyncStatus;
}
