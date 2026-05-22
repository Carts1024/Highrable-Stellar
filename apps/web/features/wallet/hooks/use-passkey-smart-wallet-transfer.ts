"use client";

import { isWebAuthnSupported } from "@/core/passkeys/webauthn-support";
import { fromTokenUnits, toTokenUnits } from "@/core/stellar/amounts";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import {
  assertPasskeyWalletTransferReadiness,
  sendPasskeySmartWalletTransfer,
  validateWalletTransferRequest,
  type TWalletTransferAsset,
  type TWalletTransferRecipientType,
  type TWalletTransferRequest,
} from "@/core/stellar/passkey-smart-wallet-transfers";
import { getEscrowAssetBySymbol } from "@/core/stellar/payment-assets";
import { stablecoinConfig, validateStablecoinConfig } from "@/core/stellar/stablecoin-config";
import { TStellarAddressSchema } from "@/core/wallet/validation";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";

export type TPasskeyWalletTransferStep = "form" | "confirm" | "submitting" | "success" | "failed";

export interface IPasskeyWalletTransferDraft {
  readonly asset: TWalletTransferAsset;
  readonly recipientAddress: string;
  readonly amount: string;
  readonly memo: string;
}

export interface IPasskeyWalletTransferValidation {
  readonly isValid: boolean;
  readonly message: string | null;
  readonly recipientType: TWalletTransferRecipientType | null;
  readonly amountAtomic: bigint | null;
}

interface IUsePasskeySmartWalletTransferParams {
  readonly smartAccountAddress: string | null;
  readonly isPasskeyConnected: boolean;
  readonly stablecoinBalanceAtomic: bigint | null;
  readonly xlmBalanceAtomic: bigint | null;
  readonly onTransferSettled?: () => Promise<void> | void;
}

const DEFAULT_DRAFT: IPasskeyWalletTransferDraft = {
  asset: "USDC",
  recipientAddress: "",
  amount: "",
  memo: "",
};

function createClientRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `wallet-transfer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getReadableTransferError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Transfer failed. Please check the network status and try again.";
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("cancel") || normalizedMessage.includes("abort")) {
    return "Passkey approval was cancelled.";
  }

  if (normalizedMessage.includes("fee") || normalizedMessage.includes("source account")) {
    return "Smart account transaction fees are not configured.";
  }

  if (normalizedMessage.includes("unauthorized") || normalizedMessage.includes("auth")) {
    return "This smart account is not authorized for this transfer.";
  }

  if (normalizedMessage.includes("recipient address")) {
    return "Recipient address is invalid.";
  }

  if (normalizedMessage.includes("insufficient")) {
    return "Insufficient balance.";
  }

  if (normalizedMessage.includes("reconnect")) {
    return "Reconnect your passkey smart account to continue.";
  }

  if (message.trim()) {
    return message.trim();
  }

  return "Transfer failed. Please check the network status and try again.";
}

function resolveRecipientType(address: string): TWalletTransferRecipientType | null {
  const parsedAddress = TStellarAddressSchema.safeParse(address);
  if (!parsedAddress.success) {
    return null;
  }

  return parsedAddress.data.startsWith("G") ? "classic_account" : "contract_account";
}

export function usePasskeySmartWalletTransfer({
  smartAccountAddress,
  isPasskeyConnected,
  stablecoinBalanceAtomic,
  xlmBalanceAtomic,
  onTransferSettled,
}: IUsePasskeySmartWalletTransferParams) {
  const [draft, setDraft] = useState<IPasskeyWalletTransferDraft>(DEFAULT_DRAFT);
  const [step, setStep] = useState<TPasskeyWalletTransferStep>("form");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{
    readonly isChecking: boolean;
    readonly canSend: boolean;
    readonly reason: string | null;
    readonly usesRelayer: boolean | null;
    readonly feeSourceAddress: string | null;
  }>({
    isChecking: false,
    canSend: false,
    reason: "Checking smart account transfer readiness.",
    usesRelayer: null,
    feeSourceAddress: null,
  });
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);

  const stablecoinValidation = useMemo(() => validateStablecoinConfig(), []);
  const nativeXlmAsset = useMemo(() => getEscrowAssetBySymbol("XLM"), []);
  const selectedAssetConfig = useMemo(() => {
    if (draft.asset === "XLM") {
      return {
        symbol: "XLM",
        decimals: nativeXlmAsset?.decimals ?? 7,
        isConfigured: Boolean(nativeXlmAsset?.isConfigured),
        readinessMessage:
          nativeXlmAsset?.readinessMessage ??
          "XLM transfers from passkey smart accounts are not enabled yet.",
      };
    }

    return {
      symbol: stablecoinConfig.symbol,
      decimals: stablecoinConfig.decimals,
      isConfigured: stablecoinValidation.isValid,
      readinessMessage: stablecoinValidation.message ?? undefined,
    };
  }, [draft.asset, nativeXlmAsset, stablecoinValidation.isValid, stablecoinValidation.message]);
  const selectedBalanceAtomic = draft.asset === "XLM" ? xlmBalanceAtomic : stablecoinBalanceAtomic;
  const validation = useMemo<IPasskeyWalletTransferValidation>(() => {
    if (!isPasskeyConnected || !smartAccountAddress) {
      return {
        isValid: false,
        message: "Reconnect your passkey smart account to continue.",
        recipientType: null,
        amountAtomic: null,
      };
    }

    if (!selectedAssetConfig?.isConfigured) {
      return {
        isValid: false,
        message:
          selectedAssetConfig?.readinessMessage ??
          "This token is not supported for passkey transfers yet.",
        recipientType: null,
        amountAtomic: null,
      };
    }

    const recipientType = resolveRecipientType(draft.recipientAddress);
    if (!recipientType) {
      return {
        isValid: false,
        message: "Recipient address is invalid.",
        recipientType: null,
        amountAtomic: null,
      };
    }

    if (draft.recipientAddress.trim().toUpperCase() === smartAccountAddress) {
      return {
        isValid: false,
        message: "Self-transfers are not enabled from Wallet Details.",
        recipientType,
        amountAtomic: null,
      };
    }

    let amountAtomic: bigint;
    try {
      amountAtomic = toTokenUnits(draft.amount, selectedAssetConfig.decimals);
    } catch {
      return {
        isValid: false,
        message: "Amount must be greater than zero.",
        recipientType,
        amountAtomic: null,
      };
    }

    if (selectedBalanceAtomic !== null && amountAtomic > selectedBalanceAtomic) {
      return {
        isValid: false,
        message: "Insufficient balance.",
        recipientType,
        amountAtomic,
      };
    }

    return {
      isValid: true,
      message: null,
      recipientType,
      amountAtomic,
    };
  }, [
    draft.amount,
    draft.asset,
    draft.recipientAddress,
    isPasskeyConnected,
    selectedAssetConfig,
    selectedBalanceAtomic,
    smartAccountAddress,
  ]);

  const refreshReadiness = useCallback(async () => {
    setReadiness((currentValue) => ({ ...currentValue, isChecking: true }));

    if (!isWebAuthnSupported()) {
      setReadiness({
        isChecking: false,
        canSend: false,
        reason: "This browser does not support passkey approval.",
        usesRelayer: null,
        feeSourceAddress: null,
      });
      return;
    }

    try {
      const nextReadiness = await assertPasskeyWalletTransferReadiness();
      setReadiness({
        isChecking: false,
        canSend: true,
        reason: null,
        usesRelayer: nextReadiness.usesRelayer,
        feeSourceAddress: nextReadiness.feeSourceAddress,
      });
    } catch (nextError) {
      setReadiness({
        isChecking: false,
        canSend: false,
        reason: getReadableTransferError(nextError),
        usesRelayer: null,
        feeSourceAddress: null,
      });
    }
  }, []);

  const updateDraft = useCallback((patch: Partial<IPasskeyWalletTransferDraft>) => {
    setDraft((currentValue) => ({ ...currentValue, ...patch }));
    setError(null);
    setTxHash(null);
    setStep("form");
  }, []);

  const prepareConfirmation = useCallback(() => {
    if (!validation.isValid) {
      setError(validation.message);
      return;
    }

    if (!readiness.canSend) {
      setError(readiness.reason ?? "Smart account transaction fees are not configured.");
      return;
    }

    setError(null);
    setStep("confirm");
  }, [readiness.canSend, readiness.reason, validation.isValid, validation.message]);

  const submitTransfer = useCallback(async () => {
    if (!smartAccountAddress || !validation.recipientType) {
      setError("Reconnect your passkey smart account to continue.");
      return;
    }

    const request: TWalletTransferRequest = {
      fromWalletAddress: smartAccountAddress,
      fromWalletType: "passkey_smart_account",
      recipientAddress: draft.recipientAddress,
      recipientType: validation.recipientType,
      asset: draft.asset,
      amount: draft.amount,
      memo: draft.memo,
    };
    const clientRequestId = createClientRequestId();

    try {
      const validatedRequest = validateWalletTransferRequest(request);
      setStep("submitting");
      setError(null);

      await createTransaction({
        walletAddress: validatedRequest.fromWalletAddress,
        walletType: "passkey_smart_account",
        type: "wallet_transfer",
        clientRequestId,
        recipientAddress: validatedRequest.recipientAddress,
        recipientType: validatedRequest.recipientType,
        asset: validatedRequest.asset,
        amount: fromTokenUnits(validatedRequest.amountAtomic, validatedRequest.assetDecimals),
        status: "pending",
      });

      const result = await sendPasskeySmartWalletTransfer(validatedRequest);
      if (result.status !== "success") {
        const message =
          result.errorMessage ?? "Transfer failed. Please check the network status and try again.";
        await updateTransactionStatus({
          clientRequestId,
          status: "failed",
          errorMessage: message,
          ...(result.txHash ? { txHash: result.txHash } : {}),
        });
        setError(message);
        setTxHash(result.txHash || null);
        setStep("failed");
        await onTransferSettled?.();
        return;
      }

      await updateTransactionStatus({
        clientRequestId,
        txHash: result.txHash,
        status: "success",
        confirmedAt: Date.now(),
      });

      setTxHash(result.txHash);
      setStep("success");
      await onTransferSettled?.();
    } catch (nextError) {
      const message = getReadableTransferError(nextError);
      const failedTxHash =
        nextError &&
        typeof nextError === "object" &&
        "txHash" in nextError &&
        typeof nextError.txHash === "string"
          ? nextError.txHash
          : undefined;

      await updateTransactionStatus({
        clientRequestId,
        status: "failed",
        errorMessage: message,
        ...(failedTxHash ? { txHash: failedTxHash } : {}),
      }).catch(() => undefined);
      setError(message);
      setTxHash(failedTxHash ?? null);
      setStep("failed");
      await onTransferSettled?.();
    }
  }, [
    createTransaction,
    draft.amount,
    draft.asset,
    draft.memo,
    draft.recipientAddress,
    onTransferSettled,
    smartAccountAddress,
    updateTransactionStatus,
    validation.recipientType,
  ]);

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT);
    setStep("form");
    setError(null);
    setTxHash(null);
  }, []);

  return {
    draft,
    updateDraft,
    validation,
    readiness,
    refreshReadiness,
    prepareConfirmation,
    submitTransfer,
    reset,
    step,
    error,
    txHash,
    txExplorerUrl: txHash ? getTxExplorerUrl(txHash) : null,
  };
}
