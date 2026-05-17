"use client";

import { getPasskeyReadinessState } from "@/core/passkeys/passkey-readiness";
import { fromTokenUnits } from "@/core/stellar/amounts";
import {
  getSmartAccountNativeBalance,
  getSmartAccountStablecoinBalance,
  type ISmartAccountBalanceResult,
} from "@/core/stellar/smart-account-balances";
import { stablecoinConfig } from "@/core/stellar/stablecoin-config";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Check, Circle, Link2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PASSKEY_ESCROW_DISABLED_REASON =
  "Escrow signing enabled with passkey when the smart account has fee funding or relayer support.";

function formatNativeBalance(balance: bigint | null): string {
  if (balance === null) {
    return "Limited";
  }

  const wholePart = balance / 10_000_000n;
  const fractionalPart = (balance % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return `${wholePart.toString()}${fractionalPart ? `.${fractionalPart}` : ""} XLM`;
}

function formatStablecoinBalance(balance: bigint | null): string {
  if (balance === null) {
    return "Limited";
  }

  return `${fromTokenUnits(balance, stablecoinConfig.decimals)} ${stablecoinConfig.symbol}`;
}

function getBalanceText(
  result: ISmartAccountBalanceResult | null,
  formatter: (balance: bigint | null) => string,
): string {
  if (!result) {
    return "Checking...";
  }

  if (result.status === "readable" || result.status === "not_found") {
    return formatter(result.balance);
  }

  return result.message ?? "Balance reading for passkey smart accounts is limited in this phase.";
}

function getSeverityClass(severity: "success" | "info" | "warning" | "error"): string {
  switch (severity) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-800";
  }
}

export function PasskeyReadinessPanel() {
  const {
    smartAccountAddress,
    isPasskeyConnected,
    isSupported,
    hasConfig,
    sessionStatus,
    isRestoring,
  } = usePasskeySmartAccount();
  const upsertUser = useMutation(api.users.upsertUser);
  const requestIdRef = useRef(0);
  const [nativeBalance, setNativeBalance] = useState<ISmartAccountBalanceResult | null>(null);
  const [stablecoinBalance, setStablecoinBalance] = useState<ISmartAccountBalanceResult | null>(
    null,
  );
  const [isCheckingBalances, setIsCheckingBalances] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const linkedUser = useQuery(
    api.users.queries.getUserByWallet,
    isPasskeyConnected && smartAccountAddress ? { walletAddress: smartAccountAddress } : "skip",
  );

  const refreshBalances = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!smartAccountAddress || !isPasskeyConnected) {
      setNativeBalance(null);
      setStablecoinBalance(null);
      return;
    }

    setIsCheckingBalances(true);

    try {
      const [nativeResult, stablecoinResult] = await Promise.all([
        getSmartAccountNativeBalance(smartAccountAddress),
        stablecoinConfig.tokenContractId
          ? getSmartAccountStablecoinBalance(smartAccountAddress, stablecoinConfig.tokenContractId)
          : Promise.resolve<ISmartAccountBalanceResult>({
              status: "limited",
              balance: null,
              message: "Stablecoin token contract is not configured.",
            }),
      ]);

      if (requestIdRef.current !== requestId) {
        return;
      }

      setNativeBalance(nativeResult);
      setStablecoinBalance(stablecoinResult);
    } finally {
      if (requestIdRef.current === requestId) {
        setIsCheckingBalances(false);
      }
    }
  }, [isPasskeyConnected, smartAccountAddress]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  const readinessState = useMemo(
    () =>
      getPasskeyReadinessState({
        isSupported,
        hasConfig,
        isConnected: isPasskeyConnected,
        smartAccountAddress,
        nativeBalance: nativeBalance?.balance ?? null,
        stablecoinBalance: stablecoinBalance?.balance ?? null,
        canSignEscrowTransactions: false,
        isSessionRestored: sessionStatus === "restored",
        isConvexUserLinked: linkedUser !== null && linkedUser !== undefined,
      }),
    [
      hasConfig,
      isPasskeyConnected,
      isSupported,
      linkedUser,
      nativeBalance?.balance,
      sessionStatus,
      smartAccountAddress,
      stablecoinBalance?.balance,
    ],
  );

  const handleLinkProfile = async (role: "client" | "freelancer") => {
    if (!smartAccountAddress) {
      return;
    }

    setLinkError(null);

    try {
      await upsertUser({
        walletAddress: smartAccountAddress,
        role,
        walletType: "passkey_smart_account",
      });
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : "Could not link passkey profile.");
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Passkey Smart Account Readiness</p>
          <p className="mt-1 text-sm text-gray-600">
            Your passkey smart account can be used as your Highrable identity and for escrow signing
            when funding and relayer readiness pass.
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getSeverityClass(
            readinessState.severity,
          )}`}
        >
          {readinessState.label}
        </span>
      </div>

      <div
        className={`mt-4 rounded-xl border p-3 text-sm ${getSeverityClass(readinessState.severity)}`}
      >
        <p className="font-medium">{readinessState.description}</p>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <dt className="text-xs font-medium text-gray-500">Passkey supported</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">{isSupported ? "Yes" : "No"}</dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <dt className="text-xs font-medium text-gray-500">Smart account config</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">
            {hasConfig ? "Configured" : "Missing"}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <dt className="text-xs font-medium text-gray-500">Session</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">
            {isRestoring
              ? "Restoring"
              : isPasskeyConnected
                ? sessionStatus === "restored"
                  ? "Restored"
                  : "Connected"
                : "Not connected"}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <dt className="text-xs font-medium text-gray-500">Wallet type</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">Passkey Smart Account</dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 sm:col-span-2">
          <dt className="text-xs font-medium text-gray-500">Smart account address</dt>
          <dd className="mt-1 font-mono text-sm break-all text-gray-900">
            {smartAccountAddress ? shortenWalletAddress(smartAccountAddress) : "Not connected"}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <dt className="text-xs font-medium text-gray-500">Native balance</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">
            {isCheckingBalances
              ? "Checking..."
              : getBalanceText(nativeBalance, formatNativeBalance)}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <dt className="text-xs font-medium text-gray-500">Stablecoin balance</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">
            {isCheckingBalances
              ? "Checking..."
              : getBalanceText(stablecoinBalance, formatStablecoinBalance)}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <dt className="text-xs font-medium text-gray-500">Identity readiness</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">
            {isPasskeyConnected && smartAccountAddress ? "Ready" : "Not ready"}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <dt className="text-xs font-medium text-gray-500">Escrow transaction readiness</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">Not enabled yet</dd>
        </div>
      </dl>

      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Friendbot funds external Stellar testnet accounts. Passkey smart account funding is handled
        separately and will be improved before escrow execution.
      </p>

      <div className="mt-4 space-y-2">
        {readinessState.checklist.map((item) => (
          <div key={item.label} className="flex items-start gap-2 text-sm">
            {item.passed ? (
              <Check className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : item.label === "Escrow write transactions enabled" ? (
              <Circle className="mt-0.5 h-4 w-4 text-gray-400" aria-hidden="true" />
            ) : (
              <X className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden="true" />
            )}
            <div>
              <p className="font-medium text-gray-800">{item.label}</p>
              {item.description ? (
                <p className="text-xs text-gray-500">{item.description}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {isPasskeyConnected && smartAccountAddress && linkedUser === null ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <div>
              <p className="font-semibold">No linked Highrable user record found.</p>
              <p className="mt-1">
                Link this passkey smart account to a client or freelancer profile before using it as
                your active identity.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AppButton type="button" size="sm" onClick={() => void handleLinkProfile("client")}>
                  <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Link as client
                </AppButton>
                <AppButton
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleLinkProfile("freelancer")}
                >
                  <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Link as freelancer
                </AppButton>
              </div>
              {linkError ? <p className="mt-2 text-sm text-red-700">{linkError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {isPasskeyConnected && smartAccountAddress && linkedUser ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-semibold">Linked user record found</p>
          <p className="mt-1">
            walletType = {linkedUser.walletType ?? "not set"}
            {linkedUser.role ? `, role = ${linkedUser.role}` : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <AppButton
          type="button"
          variant="outline"
          onClick={() => void refreshBalances()}
          disabled={!isPasskeyConnected || isCheckingBalances}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh readiness
        </AppButton>
      </div>

      <p className="mt-3 text-xs text-gray-500">{PASSKEY_ESCROW_DISABLED_REASON}</p>
    </section>
  );
}
