"use client";

import {
  getConnectedSmartAccountReadiness,
  getStaticSmartAccountReadiness,
} from "@/core/stellar/smart-account-mainnet-checks";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import type { ISmartAccountMainnetReadiness } from "@/core/stellar/mainnet-readiness";
import type React from "react";

function StatusBadge({ isReady }: { readonly isReady: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        isReady
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"
      }
    >
      {isReady ? "Ready" : "Blocked"}
    </Badge>
  );
}

function ConfigRow({
  label,
  value,
  isReady,
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly isReady: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <StatusBadge isReady={isReady} />
      </div>
      <p className="mt-1 font-mono text-xs break-all text-gray-900">{value ?? "missing"}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SmartAccountMainnetReadinessPanel() {
  const { smartAccountAddress, isPasskeyConnected, credentialId } = usePasskeySmartAccount();
  const [readiness, setReadiness] = useState<ISmartAccountMainnetReadiness>(() =>
    getStaticSmartAccountReadiness(),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      const nextReadiness =
        isPasskeyConnected && smartAccountAddress
          ? await getConnectedSmartAccountReadiness({ smartAccountAddress, credentialId })
          : getStaticSmartAccountReadiness();
      setReadiness(nextReadiness);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAccountAddress, isPasskeyConnected]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Mainnet Smart Account Readiness</p>
          <p className="mt-1 text-sm text-gray-600">
            Configuration readiness does not mean the contracts or relayer have been audited for
            production funds.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={isRefreshing}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {isRefreshing ? "Checking..." : "Refresh"}
        </Button>
      </div>

      {readiness.isMainnet && !readiness.capabilities.canExecuteMainnetPasskeyEscrow ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
          Mainnet passkey escrow is blocked until the issues below are resolved.
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        <Section title="Network">
          <ConfigRow
            label="Selected network"
            value={readiness.network}
            isReady={readiness.network !== "unknown"}
          />
          <ConfigRow
            label="RPC URL"
            value={readiness.networkStatus.rpcUrl}
            isReady={
              Boolean(readiness.networkStatus.rpcUrl) &&
              (!readiness.isMainnet || !readiness.networkStatus.rpcLooksLikeTestnet)
            }
          />
          <ConfigRow
            label="Horizon URL"
            value={readiness.networkStatus.horizonUrl}
            isReady={
              Boolean(readiness.networkStatus.horizonUrl) &&
              (!readiness.isMainnet || !readiness.networkStatus.horizonLooksLikeTestnet)
            }
          />
          <ConfigRow
            label="Network passphrase"
            value={readiness.networkStatus.networkPassphrase}
            isReady={Boolean(readiness.networkStatus.networkPassphrase)}
          />
        </Section>

        <Section title="Domain / WebAuthn">
          <ConfigRow
            label="App domain"
            value={readiness.appDomainStatus.appDomain}
            isReady={
              Boolean(readiness.appDomainStatus.appDomain) &&
              (!readiness.isMainnet || readiness.appDomainStatus.isValidForMainnet)
            }
          />
          <ConfigRow
            label="Derived RP ID"
            value={readiness.appDomainStatus.derivedRpId}
            isReady={Boolean(readiness.appDomainStatus.derivedRpId)}
          />
          <ConfigRow
            label="RP name"
            value={readiness.appDomainStatus.rpName}
            isReady={Boolean(readiness.appDomainStatus.rpName)}
          />
          <ConfigRow
            label="HTTPS domain"
            value={readiness.appDomainStatus.isHttps ? "https" : "not https"}
            isReady={!readiness.isMainnet || readiness.appDomainStatus.isHttps}
          />
        </Section>

        <Section title="Smart Account Deployment">
          <ConfigRow
            label="Configured WASM hash"
            value={readiness.smartAccountStatus.configuredWasmHash}
            isReady={readiness.smartAccountStatus.wasmHashStatus !== "missing"}
          />
          <ConfigRow
            label="Connected account WASM hash"
            value={readiness.smartAccountStatus.connectedAccountWasmHash}
            isReady={readiness.smartAccountStatus.wasmHashStatus !== "mismatch"}
          />
          <ConfigRow
            label="Deployment label/version"
            value={[
              readiness.smartAccountStatus.deploymentLabel,
              readiness.smartAccountStatus.deploymentVersion,
            ]
              .filter(Boolean)
              .join(" ")}
            isReady={Boolean(readiness.smartAccountStatus.deploymentLabel)}
          />
          <ConfigRow
            label="Factory contract"
            value={readiness.smartAccountStatus.factoryContractId}
            isReady={true}
          />
        </Section>

        <Section title="WebAuthn Verifier">
          <ConfigRow
            label="Verifier contract"
            value={readiness.verifierStatus.verifierContractId}
            isReady={readiness.verifierStatus.formatStatus === "valid"}
          />
          <ConfigRow
            label="Connected signer verifier"
            value={readiness.verifierStatus.connectedSignerVerifier}
            isReady={readiness.verifierStatus.status !== "mismatch"}
          />
        </Section>

        <Section title="Fee Path">
          <ConfigRow
            label="Relayer kind"
            value={readiness.relayerStatus.relayerKind}
            isReady={readiness.relayerStatus.healthStatus !== "unsupported"}
          />
          <ConfigRow
            label="Relayer URL"
            value={readiness.relayerStatus.relayerUrl}
            isReady={!readiness.isMainnet || readiness.relayerStatus.isHttps}
          />
          <ConfigRow
            label="Relayer health"
            value={readiness.relayerStatus.healthStatus}
            isReady={
              readiness.relayerStatus.healthStatus !== "unsafe" &&
              readiness.relayerStatus.healthStatus !== "unsupported"
            }
          />
          <ConfigRow
            label="Source account"
            value={readiness.sourceAccountStatus.sourceAccount}
            isReady={readiness.sourceAccountStatus.formatStatus !== "invalid"}
          />
        </Section>

        <Section title="Payment Assets">
          <ConfigRow
            label="USDC/stablecoin token"
            value={readiness.paymentAssetStatus.stablecoin}
            isReady={readiness.paymentAssetStatus.stablecoin !== "missing"}
          />
          <ConfigRow
            label="Native XLM SAC"
            value={readiness.paymentAssetStatus.nativeXlmSac}
            isReady={readiness.paymentAssetStatus.nativeXlmSac !== "missing"}
          />
          <ConfigRow
            label="USDC classic asset"
            value={readiness.paymentAssetStatus.usdcClassicAsset}
            isReady={readiness.paymentAssetStatus.usdcClassicAsset !== "missing"}
          />
        </Section>

        <Section title="Passkey Escrow Gate">
          <ConfigRow
            label="Create passkey account"
            value={readiness.capabilities.canCreatePasskeyAccount ? "allowed" : "blocked"}
            isReady={readiness.capabilities.canCreatePasskeyAccount}
          />
          <ConfigRow
            label="Restore/reconnect"
            value={readiness.capabilities.canRestorePasskeyAccount ? "allowed" : "blocked"}
            isReady={readiness.capabilities.canRestorePasskeyAccount}
          />
          <ConfigRow
            label="Execute passkey escrow"
            value={readiness.capabilities.canExecutePasskeyEscrow ? "allowed" : "blocked"}
            isReady={readiness.capabilities.canExecutePasskeyEscrow}
          />
          <ConfigRow
            label="Mainnet passkey escrow"
            value={readiness.capabilities.canExecuteMainnetPasskeyEscrow ? "allowed" : "blocked"}
            isReady={!readiness.isMainnet || readiness.capabilities.canExecuteMainnetPasskeyEscrow}
          />
        </Section>
      </div>

      {readiness.blockingIssues.length > 0 ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Blocking issues</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {readiness.blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {readiness.warnings.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Production hardening warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {readiness.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {readiness.relayerStatus.relayerKind === "openzeppelin_channels" ? (
        <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          OpenZeppelin Relayer with the Channels Plugin can submit Soroban transactions and handle
          fees, but Highrable must still enforce allowed targets, network consistency, and user
          authorization.
        </p>
      ) : null}
    </section>
  );
}
