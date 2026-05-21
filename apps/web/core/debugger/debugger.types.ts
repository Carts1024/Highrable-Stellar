import type { ISmartAccountMainnetReadiness } from "@/core/stellar/mainnet-readiness";
import type { THighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import type { TPasskeySmartAccountState } from "@/core/wallet/passkey-smart-account-context";
import type { TWalletTransactionStatus } from "@/core/wallet/types";
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

export interface IHighrableDebuggerWalletState {
  readonly isConnected: boolean;
  readonly selectedWallet: string | null;
  readonly walletAddress: string | null;
  readonly network: string | null;
  readonly isTestnet: boolean;
  readonly isFunded: boolean | null;
  readonly isCheckingFunding: boolean;
  readonly isFundingWithFriendbot: boolean;
  readonly friendbotError: string | null;
  readonly friendbotSuccess: boolean;
  readonly error: string | null;
  readonly lastTxStatus: TWalletTransactionStatus;
  readonly canWriteContracts: boolean;
  readonly writeRestrictionReason: string | null;
}

export interface IManagedEscrowSyncMetadata {
  readonly lastSyncAt?: number;
  readonly lastSyncOutcome?: string;
  readonly lastSyncedOnChainStatus?: string;
  readonly lastSyncErrorMessage?: string;
}

export type TManagedEscrow = TConvexDoc<"escrows"> & IManagedEscrowSyncMetadata;

export interface IHighrableDebuggerState {
  readonly walletState: IHighrableDebuggerWalletState;
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
