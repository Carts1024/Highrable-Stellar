"use client";

import { STELLAR_NETWORK } from "@/core/config/stellar-contracts";
import { fromTokenUnits } from "@/core/stellar/amounts";
import {
  getPasskeyEscrowExecutionReadiness,
  type IPasskeyEscrowExecutionReadiness,
} from "@/core/stellar/passkeySmartAccountExecutor";
import {
  getSmartAccountNativeBalance,
  getSmartAccountStablecoinBalance,
  type ISmartAccountBalanceResult,
} from "@/core/stellar/smart-account-balances";
import { stablecoinConfig } from "@/core/stellar/stablecoin-config";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { PasskeySendTokenPanel } from "@/features/wallet/components/passkey-send-token-panel";
import { WalletTransferActivity } from "@/features/wallet/components/wallet-transfer-activity";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Check,
  Copy,
  KeyRound,
  LogOut,
  MoreVertical,
  RefreshCw,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const EMPTY_BALANCE_RESULT: ISmartAccountBalanceResult = {
  status: "limited",
  balance: null,
  message: "Balance has not been checked yet.",
};

function formatSmartBalance(
  result: ISmartAccountBalanceResult,
  symbol: string,
  decimals: number,
): string {
  if (result.balance === null) {
    return result.message ?? "Unreadable";
  }

  return `${fromTokenUnits(result.balance, decimals)} ${symbol}`;
}

function formatNativeBalance(result: ISmartAccountBalanceResult): string {
  if (result.balance === null) {
    return result.message ?? "Unreadable";
  }

  return `${fromTokenUnits(result.balance, 7)} XLM`;
}

function formatFeePath(readiness: IPasskeyEscrowExecutionReadiness | null): string {
  if (!readiness) {
    return "Checking";
  }

  if (readiness.feePath === "relayer") {
    return "Relayer configured";
  }

  if (readiness.feePath === "classic_source_account") {
    return "Using funded classic source account";
  }

  return "Missing fee path";
}

function getReadinessCopy(readiness: IPasskeyEscrowExecutionReadiness | null): string {
  if (!readiness) {
    return "Checking passkey escrow execution readiness.";
  }

  if (readiness.canExecute && readiness.feePath === "classic_source_account") {
    return "Passkey escrow is ready. Network fees will be paid by the configured classic source account.";
  }

  if (readiness.canExecute && readiness.feePath === "relayer") {
    return "Passkey escrow is ready. Network fees will be paid by the configured relayer.";
  }

  if (readiness.missingReasons.length > 0) {
    return readiness.missingReasons[0]!;
  }

  return "Smart account transaction fees are not configured. Add a relayer URL or fund the classic SDK source account on mainnet.";
}

export function PasskeySmartAccountCard() {
  const {
    smartAccountAddress,
    isPasskeyConnected,
    isCreating,
    isReconnecting,
    isRestoring,
    discoveredContracts,
    error,
    isSupported,
    hasConfig,
    isContractPickerOpen,
    createPasskeyAccount,
    reconnectPasskeyAccount,
    selectDiscoveredPasskeyContract,
    dismissContractPicker,
    disconnectPasskeyAccount,
    clearLocalPasskeySession,
    clearPasskeyError,
    activeWalletMode,
    setActiveWalletMode,
  } = usePasskeySmartAccount();
  const { walletState } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [nativeBalance, setNativeBalance] =
    useState<ISmartAccountBalanceResult>(EMPTY_BALANCE_RESULT);
  const [stablecoinBalance, setStablecoinBalance] =
    useState<ISmartAccountBalanceResult>(EMPTY_BALANCE_RESULT);
  const [feeReadiness, setFeeReadiness] = useState<IPasskeyEscrowExecutionReadiness | null>(null);
  const [isRefreshingWalletDetails, setIsRefreshingWalletDetails] = useState(false);

  const runPasskeyUiAction = async (action: () => Promise<unknown>): Promise<void> => {
    try {
      await action();
    } catch {
      // The provider stores the user-facing error. Swallow here so cancelled
      // WebAuthn prompts do not become unhandled Next.js runtime errors.
    }
  };

  const handleCopy = async () => {
    if (!smartAccountAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(smartAccountAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const refreshWalletDetails = useCallback(async () => {
    if (!isPasskeyConnected || !smartAccountAddress) {
      setNativeBalance(EMPTY_BALANCE_RESULT);
      setStablecoinBalance(EMPTY_BALANCE_RESULT);
      setFeeReadiness(null);
      return;
    }

    setIsRefreshingWalletDetails(true);
    try {
      const [nextNativeBalance, nextStablecoinBalance, nextFeeReadiness] = await Promise.all([
        getSmartAccountNativeBalance(smartAccountAddress),
        getSmartAccountStablecoinBalance(
          smartAccountAddress,
          stablecoinConfig.tokenContractId ?? "",
        ),
        getPasskeyEscrowExecutionReadiness(),
      ]);

      setNativeBalance(nextNativeBalance);
      setStablecoinBalance(nextStablecoinBalance);
      setFeeReadiness(nextFeeReadiness);
    } finally {
      setIsRefreshingWalletDetails(false);
    }
  }, [isPasskeyConnected, smartAccountAddress]);

  useEffect(() => {
    void refreshWalletDetails();
  }, [refreshWalletDetails]);

  if (!isSupported) {
    return (
      <section className="w-full rounded-2xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-6 shadow-md">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-xl bg-amber-100 p-3 text-amber-600">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Passkeys Not Supported</p>
            <p className="mt-2 text-sm text-gray-600">
              Passkeys are not supported on this browser or device. Please use a compatible browser
              with WebAuthn support.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!hasConfig) {
    return (
      <section className="w-full rounded-2xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-6 shadow-md">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-xl bg-red-100 p-3 text-red-600">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Configuration Missing</p>
            <p className="mt-2 text-sm text-gray-600">
              Passkey account setup is not configured. Please contact support to enable this
              feature.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-border p-6 shadow-md transition-shadow hover:shadow-lg">
      <div className="flex w-full flex-col items-start gap-5">
        <div className="flex w-full items-center gap-3">
          <div className="shrink-0 rounded-xl bg-highrable-orange-2/20 p-3 text-highrable-orange-2">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <p className="font-sans text-lg font-bold text-foreground">Passkey Smart Account</p>
            <p className="font-sans text-xs text-muted-foreground/80">
              Secure device-backed account
            </p>
          </div>
        </div>

        <div className="w-full min-w-0">
          {isPasskeyConnected && smartAccountAddress ? (
            <div className="w-full space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-lg border-transparent bg-gray-900 px-3 py-1 font-mono text-xs font-semibold text-white">
                  Smart Account
                </Badge>
                <Badge variant="outline" className="rounded-lg px-3 py-1 font-mono text-xs">
                  {STELLAR_NETWORK}
                </Badge>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <div className="border-b border-gray-200 px-4 py-4">
                  <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                    Account Address
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <p className="min-w-0 flex-1 font-sans text-sm font-medium break-all text-gray-900">
                      {smartAccountAddress}
                    </p>
                    <AppButton
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void handleCopy()}
                      aria-label="Copy passkey account address"
                      className="h-9 w-9 shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </AppButton>
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-gray-200">
                  <div className="p-4">
                    <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                      XLM Balance
                    </p>
                    <p className="mt-3 font-sans text-base font-bold wrap-break-word text-gray-900">
                      {formatNativeBalance(nativeBalance)}
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                      {stablecoinConfig.symbol} balance
                    </p>
                    <p className="mt-3 font-sans text-base font-bold wrap-break-word text-gray-900">
                      {formatSmartBalance(
                        stablecoinBalance,
                        stablecoinConfig.symbol,
                        stablecoinConfig.decimals,
                      )}
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                      Fee Readiness
                    </p>
                    <p className="mt-3 text-base font-bold wrap-break-word text-gray-900">
                      {formatFeePath(feeReadiness)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                      Passkey Execution Status
                    </p>
                    <p className="mt-2 font-sans text-sm font-semibold text-gray-900">
                      {feeReadiness?.canExecute ? "Ready to execute escrow" : "Not ready"}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-3 rounded-full px-2 py-1 ${feeReadiness?.canExecute ? "bg-emerald-100" : "bg-amber-100"}`}
                  >
                    <span
                      className={`font-sans text-xs font-medium ${
                        feeReadiness?.canExecute ? "text-emerald-500" : "text-amber-500"
                      }`}
                    >
                      {feeReadiness?.canExecute ? "✓ Ready" : "○ Pending"}
                    </span>
                  </div>
                </div>
                <div className="grid gap-0 divide-y divide-gray-200 text-sm md:grid-cols-2 md:divide-x md:divide-y-0">
                  <div className="space-y-4 p-5">
                    <div>
                      <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                        Wallet Mode
                      </p>
                      <p className="mt-2 font-sans font-medium text-gray-900">{activeWalletMode}</p>
                    </div>
                    <div>
                      <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                        Type
                      </p>
                      <p className="mt-2 font-sans font-medium text-gray-900">
                        Passkey Smart Account
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                        Network
                      </p>
                      <p className="mt-2 font-sans font-medium text-gray-900">
                        {feeReadiness?.network ?? STELLAR_NETWORK}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                        Classic Source
                      </p>
                      <p className="mt-2 font-sans text-xs font-medium break-all text-gray-900">
                        {feeReadiness?.classicSourceAddress ?? "Not available"}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                        Funded
                      </p>
                      <p className="mt-2 font-sans font-medium text-gray-900">
                        {feeReadiness?.classicSourceIsFunded ? (
                          <span className="text-emerald-600">✓ Funded</span>
                        ) : (
                          <span className="text-red-600">✗ Not funded</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                        Stablecoin readiness
                      </p>
                      <p className="mt-2 font-sans font-medium text-gray-900">
                        {stablecoinBalance.balance === null
                          ? "Balance unreadable. Funding actions will check balance when possible."
                          : `${fromTokenUnits(
                              stablecoinBalance.balance,
                              stablecoinConfig.decimals,
                            )} ${stablecoinConfig.symbol}`}
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className={`border-t px-5 py-4 font-sans text-sm font-medium ${
                    feeReadiness?.canExecute
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  <p className="leading-relaxed wrap-break-word">
                    {getReadinessCopy(feeReadiness)}
                  </p>
                  {feeReadiness?.network === "mainnet" && feeReadiness.feePath === "missing" ? (
                    <p className="mt-2">
                      Friendbot is not available on mainnet. Ensure the classic source account has
                      XLM for fees.
                    </p>
                  ) : null}
                  {feeReadiness?.missingReasons.slice(1).map((reason) => (
                    <p key={reason} className="mt-2">
                      {reason}
                    </p>
                  ))}
                </div>
              </div>

              {feeReadiness && !feeReadiness.canExecute ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
                  <p className="font-semibold text-amber-900">Cannot send at this time</p>
                  <p className="mt-2 wrap-break-word text-amber-800">{feeReadiness.reason}</p>
                </div>
              ) : null}

              <div className="space-y-3 pt-2">
                {/* Primary Action */}
                <AppButton
                  type="button"
                  className="h-10 w-full bg-highrable-orange-2 font-medium text-white shadow-sm transition-all hover:bg-highrable-orange-3 hover:shadow-md"
                  onClick={() => setShowSendPanel((currentValue) => !currentValue)}
                  disabled={Boolean(feeReadiness && !feeReadiness.canExecute)}
                >
                  <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                  Send Funds
                </AppButton>

                {/* Utility Actions */}
                <div className="flex gap-2">
                  <AppButton
                    type="button"
                    variant="outline"
                    className="flex-1 font-medium"
                    onClick={() => void refreshWalletDetails()}
                    disabled={isRefreshingWalletDetails}
                    title="Refresh balances and status"
                  >
                    <RefreshCw
                      className={`mr-1.5 h-4 w-4 ${isRefreshingWalletDetails ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">
                      {isRefreshingWalletDetails ? "Refreshing..." : "Refresh"}
                    </span>
                    <span className="sm:hidden">
                      {isRefreshingWalletDetails ? "..." : "Refresh"}
                    </span>
                  </AppButton>

                  <AppButton
                    type="button"
                    variant="outline"
                    className="flex-1 font-medium"
                    onClick={() => void runPasskeyUiAction(reconnectPasskeyAccount)}
                    disabled={isCreating || isReconnecting || isRestoring}
                    title="Switch to another passkey account"
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    <span>Switch</span>
                  </AppButton>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <AppButton type="button" size="icon" variant="outline" title="More options">
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      </AppButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-48">
                      {walletState.isConnected && walletState.walletAddress ? (
                        <DropdownMenuItem onClick={() => setActiveWalletMode("external_wallet")}>
                          <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
                          <span>Use External Wallet</span>
                        </DropdownMenuItem>
                      ) : null}

                      <DropdownMenuItem
                        onClick={() => void disconnectPasskeyAccount()}
                        className="text-xs text-red-600 focus:text-red-600"
                      >
                        <LogOut className="mr-2 h-3 w-3 text-red-600" aria-hidden="true" />
                        <span>Disconnect Account</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => void clearLocalPasskeySession()}
                        className="text-xs text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-3 w-3 text-red-600" aria-hidden="true" />
                        <span>Clear Session</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {showSendPanel ? (
                <PasskeySendTokenPanel
                  smartAccountAddress={smartAccountAddress}
                  isPasskeyConnected={isPasskeyConnected}
                  stablecoinBalanceAtomic={stablecoinBalance.balance}
                  xlmBalanceAtomic={nativeBalance.balance}
                  onTransferSettled={refreshWalletDetails}
                  onClose={() => setShowSendPanel(false)}
                />
              ) : null}

              <WalletTransferActivity walletAddress={smartAccountAddress} />
            </div>
          ) : (
            <div className="w-full space-y-4">
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                Secure your account with your device's biometric or PIN. No seed phrases needed.
              </p>
              {isCreating ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
                  <p className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                    Creating account... Follow your device prompt.
                  </p>
                </div>
              ) : null}
              {isReconnecting ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 font-sans text-sm font-medium text-blue-800">
                  <p className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                    Reconnecting... Follow your device prompt.
                  </p>
                </div>
              ) : null}
              {isRestoring ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
                  <p className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                    Restoring your session...
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3 pt-2">
                <AppButton
                  type="button"
                  onClick={() => void runPasskeyUiAction(createPasskeyAccount)}
                  disabled={isCreating || isReconnecting || isRestoring}
                  className="min-w-max flex-1 bg-highrable-orange-2 font-medium shadow-sm transition-all hover:bg-highrable-orange-3 hover:shadow-md"
                >
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                  Create Account
                </AppButton>
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => void runPasskeyUiAction(reconnectPasskeyAccount)}
                  disabled={isCreating || isReconnecting || isRestoring}
                  className="min-w-max flex-1 font-medium"
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reconnect
                </AppButton>
              </div>
              {error ? (
                <AppButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void clearLocalPasskeySession()}
                  disabled={isCreating || isReconnecting || isRestoring}
                  className="w-full font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Clear Session & Retry
                </AppButton>
              ) : null}
            </div>
          )}

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
              <p className="font-semibold text-red-900">{error}</p>
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearPasskeyError}
                className="mt-3 font-medium text-red-600 hover:bg-red-100 hover:text-red-700"
              >
                Clear
              </AppButton>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={isContractPickerOpen} onOpenChange={(open) => !open && dismissContractPicker()}>
        <DialogContent className="max-w-2xl border-gray-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Select Passkey Account</DialogTitle>
            <DialogDescription className="text-sm">
              This passkey can connect to multiple accounts. Choose the one you want to use.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
              Fee Path
            </p>
            <p className="mt-3 text-base font-bold wrap-break-word text-gray-900">
              {formatFeePath(feeReadiness)}
            </p>
          </div>
          {/* Contract selection list */}
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {discoveredContracts.map((contract) => (
              <button
                key={contract.contract_id}
                type="button"
                className="w-full rounded-xl border border-gray-300 bg-white p-4 text-left transition-all hover:border-[#FF7003]/40 hover:bg-[#FF7003]/5 hover:shadow-md focus:ring-2 focus:ring-[#FF7003]/30 focus:outline-none"
                aria-label={`Select contract ${contract.contract_id}`}
                onClick={() =>
                  void runPasskeyUiAction(() =>
                    selectDiscoveredPasskeyContract(contract.contract_id),
                  )
                }
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold break-all text-gray-900">
                      {contract.contract_id}
                    </p>
                    <p className="mt-2 text-xs text-gray-600">
                      {contract.context_rule_count} rule
                      {contract.context_rule_count === 1 ? "" : "s"} •{" "}
                      {contract.external_signer_count + contract.delegated_signer_count} signer
                      {contract.external_signer_count + contract.delegated_signer_count === 1
                        ? ""
                        : "s"}{" "}
                      • Ledger {contract.last_seen_ledger}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter showCloseButton>
            <span className="text-xs text-gray-500">
              Current: {smartAccountAddress ? shortenWalletAddress(smartAccountAddress) : "none"}
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
