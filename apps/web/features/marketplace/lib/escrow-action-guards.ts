import type { TActorRole } from "@/features/marketplace/types";
import type { TConvexDoc } from "@repo/convex-client";

export type TEscrowActionGuardAction =
  | "create_escrow"
  | "fund_escrow"
  | "submit_work"
  | "release_payment"
  | "cancel_escrow"
  | "mark_disputed";

export type TEscrowActionGuardResult = {
  canAct: boolean;
  reason: string | null;
  warning: string | null;
};

type TWalletActionContext = {
  isConnected: boolean;
  isTestnet: boolean;
  isFunded: boolean | null;
  canWriteContracts?: boolean;
  walletType?: "external_wallet" | "passkey_smart_account" | null;
};

type TEscrowActionGuardInput = {
  action: TEscrowActionGuardAction;
  role: TActorRole;
  job: TConvexDoc<"jobs">;
  escrow: TConvexDoc<"escrows"> | null | undefined;
  wallet: TWalletActionContext;
};

function blocked(reason: string, warning: string | null = null): TEscrowActionGuardResult {
  return {
    canAct: false,
    reason,
    warning,
  };
}

function allowed(warning: string | null = null): TEscrowActionGuardResult {
  return {
    canAct: true,
    reason: null,
    warning,
  };
}

function wrongIdentityMessage(input: TEscrowActionGuardInput, fallback: string): string {
  return input.wallet.walletType === "passkey_smart_account"
    ? "This job was created with a different wallet identity."
    : fallback;
}

function getWalletGuardResult(input: TEscrowActionGuardInput): TEscrowActionGuardResult | null {
  if (!input.wallet.isConnected) {
    return blocked("Connect a Stellar wallet to continue.");
  }

  if (input.wallet.canWriteContracts === false) {
    return blocked("This wallet can view jobs but cannot sign escrow contract actions right now.");
  }

  if (!input.wallet.isTestnet) {
    return blocked("Switch your wallet to Stellar Testnet to continue.");
  }

  if (input.wallet.isFunded === false) {
    return blocked("Fund your testnet account with Friendbot before continuing.");
  }

  return null;
}

export function getEscrowActionGuard(input: TEscrowActionGuardInput): TEscrowActionGuardResult {
  const walletGuardResult = getWalletGuardResult(input);
  if (walletGuardResult) {
    return walletGuardResult;
  }

  switch (input.action) {
    case "create_escrow": {
      if (input.role !== "client") {
        return blocked(wrongIdentityMessage(input, "Only the client wallet can create escrow."));
      }

      if (input.escrow) {
        return blocked("Escrow already exists for this job.");
      }

      if (input.job.status !== "selected") {
        return blocked("Escrow can be created only after a freelancer is selected.");
      }

      return allowed();
    }

    case "fund_escrow": {
      if (input.role !== "client") {
        return blocked(wrongIdentityMessage(input, "Only the client wallet can fund escrow."));
      }

      if (!input.escrow || input.escrow.status !== "created") {
        return blocked("Escrow must be in Created state before funding.");
      }

      return allowed("Funding locks payment on Stellar so the freelancer can safely begin work.");
    }

    case "submit_work": {
      if (!input.job.selectedFreelancerWallet) {
        return blocked("A freelancer must be selected before work can be submitted.");
      }

      if (input.role !== "selectedFreelancer") {
        return blocked(
          wrongIdentityMessage(input, "Only the selected freelancer can submit work."),
        );
      }

      if (!input.escrow || input.escrow.status !== "funded") {
        return blocked("Escrow must be Verified Funded before work can be submitted.");
      }

      return allowed();
    }

    case "release_payment": {
      if (!input.job.selectedFreelancerWallet) {
        return blocked("A freelancer must be selected before payment can be released.");
      }

      if (input.role !== "client") {
        return blocked(wrongIdentityMessage(input, "Only the client wallet can release payment."));
      }

      if (!input.escrow || input.escrow.status !== "submitted") {
        return blocked("Payment can be released only after submitted work is reviewed.");
      }

      return allowed();
    }

    case "cancel_escrow": {
      if (input.role !== "client") {
        return blocked(wrongIdentityMessage(input, "Only the client wallet can cancel escrow."));
      }

      if (
        !input.escrow ||
        (input.escrow.status !== "created" && input.escrow.status !== "funded")
      ) {
        return blocked("Escrow can be cancelled only before work is submitted.");
      }

      return allowed();
    }

    case "mark_disputed": {
      if (!input.job.selectedFreelancerWallet) {
        return blocked("A freelancer must be selected before escrow can be disputed.");
      }

      if (input.role !== "client" && input.role !== "selectedFreelancer") {
        return blocked(
          wrongIdentityMessage(
            input,
            "Only the client or selected freelancer can mark escrow disputed.",
          ),
        );
      }

      if (
        !input.escrow ||
        (input.escrow.status !== "funded" && input.escrow.status !== "submitted")
      ) {
        return blocked("Escrow can be disputed only after funding and before payment release.");
      }

      return allowed();
    }

    default: {
      return blocked("Escrow action is not available.");
    }
  }
}
