"use client";

import { STELLAR_NETWORK_PASSPHRASE, STELLAR_RPC_URL } from "@/core/config/stellar-contracts";
import { toTokenUnits } from "@/core/stellar/amounts";
import {
  executeWithPasskeySmartAccount,
  getPasskeyEscrowExecutionReadiness,
} from "@/core/stellar/passkeySmartAccountExecutor";
import { getEscrowAssetBySymbol } from "@/core/stellar/payment-assets";
import { getStablecoinConfigOrThrow } from "@/core/stellar/stablecoin-config";
import { TStellarAddressSchema, TStellarContractIdSchema } from "@/core/wallet/validation";
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";

export type TWalletTransferAsset = "XLM" | "USDC";
export type TWalletTransferRecipientType = "classic_account" | "contract_account";

export type TWalletTransferRequest = {
  readonly fromWalletAddress: string;
  readonly fromWalletType: "passkey_smart_account";
  readonly recipientAddress: string;
  readonly recipientType: TWalletTransferRecipientType;
  readonly asset: TWalletTransferAsset;
  readonly amount: string;
  readonly memo?: string;
};

export interface IPasskeyWalletTransferResult {
  readonly txHash: string;
  readonly status: "success" | "failed";
  readonly errorMessage?: string;
}

export interface IValidatedWalletTransferRequest extends TWalletTransferRequest {
  readonly fromWalletAddress: string;
  readonly recipientAddress: string;
  readonly asset: TWalletTransferAsset;
  readonly amountAtomic: bigint;
  readonly tokenContractId: string;
  readonly assetDecimals: number;
  readonly networkPassphrase: string;
  readonly rpcUrl: string;
}

function addressScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

function i128ScVal(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

function normalizeMemo(value: string | undefined): string | undefined {
  const memo = value?.trim().replace(/\s+/g, " ").slice(0, 120);
  return memo ? memo : undefined;
}

function resolveRecipientType(address: string): TWalletTransferRecipientType {
  return address.startsWith("G") ? "classic_account" : "contract_account";
}

function resolveTransferAsset(asset: TWalletTransferAsset): {
  readonly asset: TWalletTransferAsset;
  readonly tokenContractId: string;
  readonly decimals: number;
} {
  if (asset === "USDC") {
    const stablecoin = getStablecoinConfigOrThrow();
    return {
      asset: "USDC",
      tokenContractId: stablecoin.tokenContractId,
      decimals: stablecoin.decimals,
    };
  }

  const nativeXlmAsset = getEscrowAssetBySymbol("XLM");
  if (!nativeXlmAsset?.isConfigured || !nativeXlmAsset.tokenContractId) {
    throw new Error(
      nativeXlmAsset?.readinessMessage ??
        "XLM transfers from passkey smart accounts are not enabled yet.",
    );
  }

  return {
    asset: "XLM",
    tokenContractId: nativeXlmAsset.tokenContractId,
    decimals: nativeXlmAsset.decimals,
  };
}

export function validateWalletTransferRequest(
  request: TWalletTransferRequest,
): IValidatedWalletTransferRequest {
  if (request.fromWalletType !== "passkey_smart_account") {
    throw new Error("Reconnect your passkey smart account to continue.");
  }

  if (request.asset !== "USDC" && request.asset !== "XLM") {
    throw new Error("This token is not supported for passkey transfers yet.");
  }

  const fromWalletAddress = TStellarContractIdSchema.parse(request.fromWalletAddress);
  const recipientAddressParseResult = TStellarAddressSchema.safeParse(request.recipientAddress);
  if (!recipientAddressParseResult.success) {
    throw new Error("Recipient address is invalid.");
  }

  const recipientAddress = recipientAddressParseResult.data;
  const recipientType = resolveRecipientType(recipientAddress);
  if (recipientType !== request.recipientType) {
    throw new Error("Recipient address is invalid.");
  }

  if (recipientAddress === fromWalletAddress) {
    throw new Error("Self-transfers are not enabled from Wallet Details.");
  }

  const transferAsset = resolveTransferAsset(request.asset);
  const amountAtomic = toTokenUnits(request.amount, transferAsset.decimals);

  return {
    fromWalletAddress,
    fromWalletType: "passkey_smart_account",
    recipientAddress,
    recipientType,
    asset: transferAsset.asset,
    amount: request.amount.trim(),
    amountAtomic,
    tokenContractId: transferAsset.tokenContractId,
    assetDecimals: transferAsset.decimals,
    memo: normalizeMemo(request.memo),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    rpcUrl: STELLAR_RPC_URL,
  };
}

export async function assertPasskeyWalletTransferReadiness(): Promise<{
  readonly usesRelayer: boolean;
  readonly feeSourceAddress: string | null;
}> {
  const readiness = await getPasskeyEscrowExecutionReadiness();
  if (!readiness.canExecute) {
    throw new Error(readiness.reason ?? "Smart account transaction fees are not configured.");
  }

  return {
    usesRelayer: readiness.usesRelayer,
    feeSourceAddress: readiness.feeSourceAddress,
  };
}

export async function sendPasskeySmartWalletTransfer(
  request: TWalletTransferRequest,
): Promise<IPasskeyWalletTransferResult> {
  const validatedRequest = validateWalletTransferRequest(request);
  await assertPasskeyWalletTransferReadiness();

  const result = await executeWithPasskeySmartAccount({
    smartAccountAddress: validatedRequest.fromWalletAddress,
    actionLabel: "wallet_transfer",
    contractId: validatedRequest.tokenContractId,
    method: "transfer",
    args: [
      addressScVal(validatedRequest.fromWalletAddress),
      addressScVal(validatedRequest.recipientAddress),
      i128ScVal(validatedRequest.amountAtomic),
    ],
    rpcUrl: validatedRequest.rpcUrl,
    networkPassphrase: validatedRequest.networkPassphrase,
  });

  if (result.status !== "success") {
    return {
      txHash: result.txHash,
      status: "failed",
      errorMessage:
        result.errorMessage ?? "Transfer failed. Please check the network status and try again.",
    };
  }

  return {
    txHash: result.txHash,
    status: "success",
  };
}
