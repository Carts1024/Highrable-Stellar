"use client";

import { STELLAR_NETWORK } from "@/core/config/stellar-contracts";
import { fromTokenUnits } from "@/core/stellar/amounts";
import { getEscrowAssetBySymbol } from "@/core/stellar/payment-assets";
import { stablecoinConfig } from "@/core/stellar/stablecoin-config";
import { usePasskeySmartWalletTransfer } from "@/features/wallet/hooks/use-passkey-smart-wallet-transfer";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { ArrowRight, ExternalLink, KeyRound, Loader2, Send } from "lucide-react";
import { useEffect } from "react";

interface IPasskeySendTokenPanelProps {
  readonly smartAccountAddress: string;
  readonly isPasskeyConnected: boolean;
  readonly stablecoinBalanceAtomic: bigint | null;
  readonly xlmBalanceAtomic: bigint | null;
  readonly onTransferSettled: () => Promise<void> | void;
  readonly onClose: () => void;
}

function formatAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export function PasskeySendTokenPanel({
  smartAccountAddress,
  isPasskeyConnected,
  stablecoinBalanceAtomic,
  xlmBalanceAtomic,
  onTransferSettled,
  onClose,
}: IPasskeySendTokenPanelProps) {
  const transfer = usePasskeySmartWalletTransfer({
    smartAccountAddress,
    isPasskeyConnected,
    stablecoinBalanceAtomic,
    xlmBalanceAtomic,
    onTransferSettled,
  });

  useEffect(() => {
    void transfer.refreshReadiness();
  }, [transfer.refreshReadiness]);

  const nativeXlmAsset = getEscrowAssetBySymbol("XLM");
  const xlmTransfersEnabled = Boolean(nativeXlmAsset?.isConfigured);
  const selectedAssetSymbol = transfer.draft.asset === "XLM" ? "XLM" : stablecoinConfig.symbol;
  const selectedAssetDecimals =
    transfer.draft.asset === "XLM" ? (nativeXlmAsset?.decimals ?? 7) : stablecoinConfig.decimals;
  const selectedBalanceAtomic =
    transfer.draft.asset === "XLM" ? xlmBalanceAtomic : stablecoinBalanceAtomic;
  const balanceDisplay =
    selectedBalanceAtomic === null
      ? "Unreadable"
      : `${fromTokenUnits(selectedBalanceAtomic, selectedAssetDecimals)} ${selectedAssetSymbol}`;
  const feePath =
    transfer.readiness.usesRelayer === null
      ? "Checking"
      : transfer.readiness.usesRelayer
        ? "Relayer"
        : "Source account";
  const primaryDisabled =
    transfer.step === "submitting" ||
    transfer.readiness.isChecking ||
    !transfer.readiness.canSend ||
    !transfer.validation.isValid;

  if (transfer.step === "confirm") {
    return (
      <section className="overflow-hidden rounded-xl border border-border">
        {/* Header */}
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
            Confirm Transfer
          </p>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            Review before passkey approval.
          </p>
        </div>

        <div className="space-y-5 p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                Asset
              </dt>
              <dd className="mt-2 font-sans text-sm font-semibold text-foreground">
                {selectedAssetSymbol}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                Amount
              </dt>
              <dd className="mt-2 font-sans text-sm font-semibold text-foreground">
                {transfer.draft.amount} {selectedAssetSymbol}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                From
              </dt>
              <dd className="mt-2 font-mono text-xs break-all text-foreground">
                {formatAddress(smartAccountAddress)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                Recipient
              </dt>
              <dd className="mt-2 font-mono text-xs break-all text-foreground">
                {formatAddress(transfer.draft.recipientAddress.trim().toUpperCase())}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                Recipient Type
              </dt>
              <dd className="mt-2 font-sans text-sm text-foreground">
                {transfer.validation.recipientType === "contract_account"
                  ? "Passkey Smart Account"
                  : "External Wallet"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                Network
              </dt>
              <dd className="mt-2 font-sans text-sm text-foreground">{STELLAR_NETWORK}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
                Estimated Fee Path
              </dt>
              <dd className="mt-2 font-sans text-sm text-foreground">
                {feePath}
                {transfer.readiness.feeSourceAddress
                  ? ` (${formatAddress(transfer.readiness.feeSourceAddress)})`
                  : ""}
              </dd>
            </div>
          </dl>

          <Alert className="rounded-lg border-amber-300 bg-amber-50">
            <AlertDescription className="font-sans text-sm leading-relaxed text-amber-900">
              Transfers are irreversible. Only approve if the recipient and amount are correct.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="font-medium"
              onClick={() => transfer.updateDraft({})}
            >
              Back
            </Button>
            <Button
              type="button"
              className="bg-highrable-orange-2 font-medium text-white shadow-sm transition-all hover:bg-highrable-orange-3 hover:shadow-md"
              onClick={() => void transfer.submitTransfer()}
            >
              <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
              Approve with Passkey
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
        <div>
          <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
            Send Token
          </p>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            Passkey smart account transfer
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Close
        </Button>
      </div>

      <div className="space-y-5 p-5">
        {!transfer.readiness.canSend && transfer.readiness.reason ? (
          <Alert className="rounded-lg border-amber-300 bg-amber-50">
            <AlertDescription className="font-sans text-sm leading-relaxed text-amber-900">
              {transfer.readiness.reason}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Asset + Recipient row */}
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <div className="space-y-2">
            <Label
              htmlFor="passkey-transfer-asset"
              className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase"
            >
              Asset
            </Label>
            <Select
              value={transfer.draft.asset}
              onValueChange={(value) =>
                transfer.updateDraft({ asset: value === "XLM" ? "XLM" : "USDC" })
              }
            >
              <SelectTrigger id="passkey-transfer-asset" className="w-full font-sans">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDC">{stablecoinConfig.symbol}</SelectItem>
                <SelectItem value="XLM" disabled={!xlmTransfersEnabled}>
                  XLM
                </SelectItem>
              </SelectContent>
            </Select>
            {!xlmTransfersEnabled ? (
              <p className="font-sans text-xs text-muted-foreground">
                XLM transfers require NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="passkey-transfer-recipient"
              className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase"
            >
              Recipient
            </Label>
            <Input
              id="passkey-transfer-recipient"
              value={transfer.draft.recipientAddress}
              onChange={(event) =>
                transfer.updateDraft({ recipientAddress: event.target.value.trim().toUpperCase() })
              }
              spellCheck={false}
              placeholder="G... or C..."
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Amount + Balance row */}
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <div className="space-y-2">
            <Label
              htmlFor="passkey-transfer-amount"
              className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase"
            >
              Amount
            </Label>
            <Input
              id="passkey-transfer-amount"
              inputMode="decimal"
              value={transfer.draft.amount}
              onChange={(event) => transfer.updateDraft({ amount: event.target.value.trim() })}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
              Balance
            </p>
            <p className="mt-2 font-sans text-sm font-semibold text-foreground">{balanceDisplay}</p>
          </div>
        </div>

        {/* Info bar */}
        <div className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 font-sans text-xs text-muted-foreground sm:grid-cols-3">
          <p className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-highrable-orange-2"
              aria-hidden="true"
            />
            Network: {STELLAR_NETWORK}
          </p>
          <p className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-highrable-orange-2"
              aria-hidden="true"
            />
            Fee: {feePath}
          </p>
          <p className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-highrable-orange-2"
              aria-hidden="true"
            />
            Recipient:{" "}
            {transfer.validation.recipientType === "contract_account"
              ? "Smart account"
              : transfer.validation.recipientType === "classic_account"
                ? "External wallet"
                : "Invalid"}
          </p>
        </div>

        {(transfer.error ?? transfer.validation.message) ? (
          <p className="font-sans text-sm font-medium text-red-600">
            {transfer.error ?? transfer.validation.message}
          </p>
        ) : null}

        {transfer.step === "success" && transfer.txExplorerUrl ? (
          <Alert className="rounded-lg border-emerald-300 bg-emerald-50">
            <AlertDescription className="font-sans text-sm text-emerald-900">
              Transfer submitted.{" "}
              <a
                href={transfer.txExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center font-semibold underline"
              >
                View transaction
                <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
              </a>
            </AlertDescription>
          </Alert>
        ) : null}

        {transfer.step === "submitting" ? (
          <p className="flex items-center gap-2 font-sans text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Waiting for passkey approval and Stellar confirmation.
          </p>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-1">
          <Button
            type="button"
            className="bg-highrable-orange-2 font-medium text-white shadow-sm transition-all hover:bg-highrable-orange-3 hover:shadow-md"
            disabled={primaryDisabled}
            onClick={transfer.prepareConfirmation}
          >
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            Send
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="font-medium"
            onClick={() => void transfer.refreshReadiness()}
          >
            Refresh Readiness
          </Button>
        </div>
      </div>
    </section>
  );
}
