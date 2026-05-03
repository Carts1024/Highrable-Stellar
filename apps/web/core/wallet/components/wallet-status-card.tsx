"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";

function getTransactionStatusCopy(lastTxStatus: "idle" | "pending" | "success" | "failed") {
  switch (lastTxStatus) {
    case "pending":
      return {
        badge: "Transaction pending",
        tone: "border-amber-200 bg-amber-50 text-amber-700",
        description: "A signed transaction is waiting for the next phase to submit it.",
      };
    case "success":
      return {
        badge: "Transaction successful",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
        description: "The last transaction signing flow completed successfully.",
      };
    case "failed":
      return {
        badge: "Transaction failed",
        tone: "border-red-200 bg-red-50 text-red-700",
        description: "The last transaction flow failed. Clear the error and retry when ready.",
      };
    default:
      return {
        badge: "Transaction idle",
        tone: "border-gray-200 bg-gray-50 text-gray-600",
        description: "Transaction feedback will appear here once Phase 3 starts sending XDRs.",
      };
  }
}

export function WalletStatusCard() {
  const {
    walletState,
    disconnectWallet,
    refreshWalletState,
    checkFundingStatus,
    clearWalletError,
  } = useWallet();

  const transactionState = getTransactionStatusCopy(walletState.lastTxStatus);

  if (!walletState.isConnected) {
    return null;
  }

  return (
    <section className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#FF7003]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#FF7003] uppercase">
                {walletState.selectedWallet ?? "Stellar Wallet"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {walletState.network ?? "Unknown network"}
              </span>
              {walletState.isCheckingFunding ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Checking funding...
                </span>
              ) : null}
            </div>

            <div>
              <p className="text-sm text-gray-500">Connected address</p>
              <p className="break-all font-mono text-sm text-gray-900">{walletState.walletAddress}</p>
            </div>

            {!walletState.isTestnet ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Please switch to Stellar Testnet. The app target is Stellar Testnet.
              </div>
            ) : null}

            {walletState.isTestnet && walletState.isFunded === false ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p>This testnet account is not funded yet.</p>
                {/* TODO: Wire this button to Friendbot in Phase 3. */}
                <button
                  type="button"
                  disabled
                  className="mt-3 cursor-not-allowed rounded-lg border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-700 opacity-70"
                >
                  Fund Testnet Account
                </button>
              </div>
            ) : null}

            {walletState.isTestnet && walletState.isFunded === true ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Funded and ready.
              </div>
            ) : null}

            {walletState.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p>{walletState.error}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshWalletState()}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={clearWalletError}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                  >
                    Clear error
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 lg:min-w-[240px]">
            <div className={`rounded-xl border px-4 py-3 text-sm ${transactionState.tone}`}>
              <p className="font-semibold">{transactionState.badge}</p>
              <p className="mt-1">{transactionState.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refreshWalletState()}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void checkFundingStatus()}
                disabled={!walletState.isTestnet || walletState.isCheckingFunding}
                className="rounded-lg border border-[#FF7003]/25 px-4 py-2 text-sm font-medium text-[#FF7003] transition-colors hover:bg-[#FF7003]/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Check funding
              </button>
              <button
                type="button"
                onClick={() => void disconnectWallet()}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
