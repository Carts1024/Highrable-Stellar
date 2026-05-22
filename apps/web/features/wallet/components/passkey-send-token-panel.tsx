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
      <section className="border border-[#0a0a0a] bg-white">
        <div className="border-b border-[#0a0a0a] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#0a0a0a]">Confirm transfer</h3>
          <p className="text-xs text-[#5f5f5f]">Review before passkey approval.</p>
        </div>
        <div className="space-y-4 p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[11px] text-[#777] uppercase">Asset</dt>
              <dd className="text-sm font-semibold text-[#0a0a0a]">{selectedAssetSymbol}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] text-[#777] uppercase">Amount</dt>
              <dd className="text-sm font-semibold text-[#0a0a0a]">
                {transfer.draft.amount} {selectedAssetSymbol}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] text-[#777] uppercase">From</dt>
              <dd className="font-mono text-xs text-[#0a0a0a]">
                {formatAddress(smartAccountAddress)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] text-[#777] uppercase">Recipient</dt>
              <dd className="font-mono text-xs text-[#0a0a0a]">
                {formatAddress(transfer.draft.recipientAddress.trim().toUpperCase())}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] text-[#777] uppercase">Recipient type</dt>
              <dd className="text-sm text-[#0a0a0a]">
                {transfer.validation.recipientType === "contract_account"
                  ? "Passkey Smart Account"
                  : "External Wallet"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] text-[#777] uppercase">Network</dt>
              <dd className="text-sm text-[#0a0a0a]">{STELLAR_NETWORK}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-mono text-[11px] text-[#777] uppercase">Estimated fee path</dt>
              <dd className="text-sm text-[#0a0a0a]">
                {feePath}
                {transfer.readiness.feeSourceAddress
                  ? ` (${formatAddress(transfer.readiness.feeSourceAddress)})`
                  : ""}
              </dd>
            </div>
          </dl>
          <Alert className="rounded-none border-[#f97316] bg-[#fff7ed]">
            <AlertDescription className="text-[#7c2d12]">
              Transfers are irreversible. Only approve if the recipient and amount are correct.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => transfer.updateDraft({})}>
              Back
            </Button>
            <Button
              type="button"
              className="bg-linear-to-r from-[#f97316] to-[#f59e0b] text-white hover:from-[#ea580c] hover:to-[#d97706]"
              onClick={() => void transfer.submitTransfer()}
            >
              <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
              Approve with passkey
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border border-[#d8d8d8] bg-white">
      <div className="flex items-center justify-between border-b border-[#e8e8e8] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0a0a0a]">Send token</h3>
          <p className="text-xs text-[#6f6f6f]">Passkey smart account transfer</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="space-y-4 p-4">
        {!transfer.readiness.canSend && transfer.readiness.reason ? (
          <Alert className="rounded-none border-amber-300 bg-amber-50">
            <AlertDescription className="text-amber-900">
              {transfer.readiness.reason}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <div className="space-y-2">
            <Label htmlFor="passkey-transfer-asset">Asset</Label>
            <Select
              value={transfer.draft.asset}
              onValueChange={(value) =>
                transfer.updateDraft({ asset: value === "XLM" ? "XLM" : "USDC" })
              }
            >
              <SelectTrigger id="passkey-transfer-asset" className="w-full rounded-none">
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
              <p className="text-xs text-[#777]">
                XLM transfers require NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="passkey-transfer-recipient">Recipient</Label>
            <Input
              id="passkey-transfer-recipient"
              value={transfer.draft.recipientAddress}
              onChange={(event) =>
                transfer.updateDraft({ recipientAddress: event.target.value.trim().toUpperCase() })
              }
              spellCheck={false}
              placeholder="G... or C..."
              className="rounded-none font-mono text-xs"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <div className="space-y-2">
            <Label htmlFor="passkey-transfer-amount">Amount</Label>
            <Input
              id="passkey-transfer-amount"
              inputMode="decimal"
              value={transfer.draft.amount}
              onChange={(event) => transfer.updateDraft({ amount: event.target.value.trim() })}
              placeholder="0.00"
              className="rounded-none font-mono"
            />
          </div>
          <div className="border border-[#e8e8e8] px-3 py-2">
            <p className="font-mono text-[11px] text-[#777] uppercase">Balance</p>
            <p className="mt-1 text-sm font-semibold text-[#0a0a0a]">{balanceDisplay}</p>
          </div>
        </div>

        <div className="grid gap-2 border border-[#e8e8e8] bg-[#fafafa] p-3 text-xs text-[#555] sm:grid-cols-3">
          <p>
            <span className="mr-2 inline-block h-1.5 w-1.5 bg-[#f97316]" aria-hidden="true" />
            Network: {STELLAR_NETWORK}
          </p>
          <p>
            <span className="mr-2 inline-block h-1.5 w-1.5 bg-[#f97316]" aria-hidden="true" />
            Fee: {feePath}
          </p>
          <p>
            <span className="mr-2 inline-block h-1.5 w-1.5 bg-[#f97316]" aria-hidden="true" />
            Recipient:{" "}
            {transfer.validation.recipientType === "contract_account"
              ? "Smart account"
              : transfer.validation.recipientType === "classic_account"
                ? "External wallet"
                : "Invalid"}
          </p>
        </div>

        {(transfer.error ?? transfer.validation.message) ? (
          <p className="text-sm text-red-700">{transfer.error ?? transfer.validation.message}</p>
        ) : null}

        {transfer.step === "success" && transfer.txExplorerUrl ? (
          <Alert className="rounded-none border-emerald-300 bg-emerald-50">
            <AlertDescription className="text-emerald-900">
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
          <p className="flex items-center text-sm text-[#555]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Waiting for passkey approval and Stellar confirmation.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-linear-to-r from-[#f97316] to-[#f59e0b] text-white hover:from-[#ea580c] hover:to-[#d97706]"
            disabled={primaryDisabled}
            onClick={transfer.prepareConfirmation}
          >
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            Send
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" onClick={() => void transfer.refreshReadiness()}>
            Refresh readiness
          </Button>
        </div>
      </div>
    </section>
  );
}
