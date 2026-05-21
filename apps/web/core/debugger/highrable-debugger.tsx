"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { toast } from "@repo/ui/toast";
import { useMemo, useState } from "react";

import type { IHighrableDebuggerState } from "./debugger.types";

import { isHighrableDebuggerEnabled } from "./highrable-debugger-visibility";
import { useHighrableDebuggerState } from "./use-highrable-debugger-state";

type TDebuggerRowValue = string | number | boolean | null | undefined;

function formatValue(value: TDebuggerRowValue): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toString();
  }

  return value ?? "Unavailable";
}

function formatWarnings(warnings: readonly string[]): string {
  return warnings.length > 0 ? warnings.join(" | ") : "None";
}

function formatEscrowStatusSummary(statusCounts: Readonly<Record<string, number>>): string {
  const entries = Object.entries(statusCounts);

  if (entries.length === 0) {
    return "No payment hold records";
  }

  return entries.map(([status, count]) => `${status}:${count}`).join(" | ");
}

function formatSyncTime(timestamp: number | null): string {
  return timestamp ? new Date(timestamp).toLocaleString() : "Never";
}

function formatTransactionStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildDebuggerSummary(state: IHighrableDebuggerState): string {
  return [
    "Highrable Debugger",
    `Wallet diagnostics: ${state.walletState.isConnected ? "Connected" : "Disconnected"}`,
    `Passkey Smart Account Readiness: ${state.passkeySmartAccountReadiness.isPasskeyConnected ? "Connected" : "Not connected"}`,
    `Mainnet Smart Account Readiness: ${state.mainnetSmartAccountReadiness.capabilities.canExecuteMainnetPasskeyEscrow ? "Ready" : "Blocked"}`,
    `Production hardening warnings: ${formatWarnings(state.productionHardeningWarnings)}`,
    `Active Highrable identity: ${formatValue(state.activeHighrableIdentity.displayAddress)}`,
    `Use Passkey Smart Account: ${formatValue(state.usePasskeySmartAccount)}`,
    `Escrow Management: ${formatEscrowStatusSummary(state.escrowManagement.byStatus)}`,
    `Escrow Sync Status: ${formatValue(state.escrowSyncStatus.lastSyncOutcome)}`,
  ].join("\n");
}

function DebuggerRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: TDebuggerRowValue;
}) {
  return (
    <div className="grid gap-1 border-b border-border/70 py-2 last:border-b-0">
      <span className="hr-label-caps hr-text-muted">{label}</span>
      <span className="font-mono text-xs leading-5 wrap-break-word text-foreground">
        {formatValue(value)}
      </span>
    </div>
  );
}

function DebuggerSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="hr-panel p-3">
      <h2 className="hr-label-caps hr-square-dot hr-text-accent">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Renders a small floating diagnostics panel for internal Highrable development use. */
export function HighrableDebugger() {
  if (!isHighrableDebuggerEnabled()) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const state = useHighrableDebuggerState();
  const debuggerSummary = useMemo(() => buildDebuggerSummary(state), [state]);

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(debuggerSummary);
      toast.success("Debugger summary copied.");
    } catch {
      toast.error("Could not copy debugger summary.");
    }
  };

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-70 flex max-w-[24rem] flex-col items-end gap-3">
      {isOpen ? (
        <div className="hr-hard-shadow pointer-events-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-3 text-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <p className="hr-label-caps hr-text-accent">Highrable Debugger</p>
              <p className="mt-1 text-xs text-muted-foreground">Internal diagnostics only</p>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void handleCopySummary()}
            >
              Copy
            </Button>
          </div>

          <div className="mt-3 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <DebuggerSection title="Passkey Smart Account Readiness">
              <DebuggerRow
                label="Supported"
                value={state.passkeySmartAccountReadiness.isSupported}
              />
              <DebuggerRow
                label="Configured"
                value={state.passkeySmartAccountReadiness.hasConfig}
              />
              <DebuggerRow
                label="Connected"
                value={state.passkeySmartAccountReadiness.isPasskeyConnected}
              />
              <DebuggerRow
                label="Session"
                value={state.passkeySmartAccountReadiness.sessionStatus}
              />
              <DebuggerRow
                label="Address"
                value={state.passkeySmartAccountReadiness.smartAccountAddress}
              />
            </DebuggerSection>

            <DebuggerSection title="Mainnet Smart Account Readiness">
              <DebuggerRow label="Network" value={state.mainnetSmartAccountReadiness.network} />
              <DebuggerRow
                label="Passkey account creation"
                value={state.mainnetSmartAccountReadiness.capabilities.canCreatePasskeyAccount}
              />
              <DebuggerRow
                label="Passkey escrow execution"
                value={
                  state.mainnetSmartAccountReadiness.capabilities.canExecuteMainnetPasskeyEscrow
                }
              />
              <DebuggerRow
                label="Blocking issues"
                value={state.mainnetSmartAccountReadiness.blockingIssues.length}
              />
            </DebuggerSection>

            <DebuggerSection title="Production hardening warnings">
              <DebuggerRow
                label="Warnings"
                value={formatWarnings(state.productionHardeningWarnings)}
              />
            </DebuggerSection>

            <DebuggerSection title="Active Highrable identity">
              <DebuggerRow label="Connected" value={state.activeHighrableIdentity.isConnected} />
              <DebuggerRow label="Address" value={state.activeHighrableIdentity.walletAddress} />
              <DebuggerRow label="Type" value={state.activeHighrableIdentity.walletType} />
              <DebuggerRow label="Source" value={state.activeHighrableIdentity.source} />
            </DebuggerSection>

            <DebuggerSection title="Wallet diagnostics">
              <DebuggerRow label="Connected" value={state.walletState.isConnected} />
              <DebuggerRow label="Selected wallet" value={state.walletState.selectedWallet} />
              <DebuggerRow label="Address" value={state.walletState.walletAddress} />
              <DebuggerRow label="Network" value={state.walletState.network} />
              <DebuggerRow label="Testnet" value={state.walletState.isTestnet} />
              <DebuggerRow label="Funded" value={state.walletState.isFunded} />
              <DebuggerRow label="Checking funding" value={state.walletState.isCheckingFunding} />
              <DebuggerRow
                label="Funding with friendbot"
                value={state.walletState.isFundingWithFriendbot}
              />
              <DebuggerRow label="Friendbot success" value={state.walletState.friendbotSuccess} />
              <DebuggerRow label="Friendbot error" value={state.walletState.friendbotError} />
              <DebuggerRow label="Wallet error" value={state.walletState.error} />
              <DebuggerRow
                label="Last transaction"
                value={formatTransactionStatus(state.walletState.lastTxStatus)}
              />
              <DebuggerRow
                label="Can write contracts"
                value={state.walletState.canWriteContracts}
              />
              <DebuggerRow
                label="Write restriction"
                value={state.walletState.writeRestrictionReason}
              />
            </DebuggerSection>

            <DebuggerSection title="Use Passkey Smart Account">
              <DebuggerRow label="Enabled" value={state.usePasskeySmartAccount} />
              <DebuggerRow
                label="Active mode"
                value={state.activeHighrableIdentity.activeWalletMode}
              />
            </DebuggerSection>

            <DebuggerSection title="Escrow Management">
              <DebuggerRow label="Total records" value={state.escrowManagement.total} />
              <DebuggerRow
                label="By status"
                value={formatEscrowStatusSummary(state.escrowManagement.byStatus)}
              />
              <DebuggerRow
                label="Records with sync errors"
                value={state.escrowManagement.syncErrorCount}
              />
            </DebuggerSection>

            <DebuggerSection title="Escrow Sync Status">
              <DebuggerRow label="Latest escrow" value={state.escrowSyncStatus.latestEscrowId} />
              <DebuggerRow label="Local status" value={state.escrowSyncStatus.convexStatus} />
              <DebuggerRow
                label="Latest network status"
                value={state.escrowSyncStatus.lastSyncedOnChainStatus}
              />
              <DebuggerRow label="Latest result" value={state.escrowSyncStatus.lastSyncOutcome} />
              <DebuggerRow
                label="Latest sync time"
                value={formatSyncTime(state.escrowSyncStatus.lastSyncAt)}
              />
              <DebuggerRow
                label="Latest sync error"
                value={state.escrowSyncStatus.lastSyncErrorMessage}
              />
            </DebuggerSection>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant={isOpen ? "outline" : "default"}
        className={cn(
          "hr-label-caps pointer-events-auto h-10 rounded-xl px-4",
          !isOpen && "hr-hard-shadow",
        )}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        {isOpen ? "Minimize Debugger" : "Open Debugger"}
      </Button>
    </div>
  );
}
