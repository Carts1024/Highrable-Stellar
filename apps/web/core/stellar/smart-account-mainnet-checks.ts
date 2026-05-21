"use client";

import {
  evaluateSmartAccountMainnetReadiness,
  type ISmartAccountMainnetReadiness,
} from "@/core/stellar/mainnet-readiness";
import { readSmartAccountWasmHash } from "@/core/stellar/passkeySmartAccountExecutor";
import {
  getSmartAccountDeploymentConfig,
  normalizeContractId,
} from "@/core/stellar/smart-account-deployment-config";
import { getSmartAccountKit } from "@/core/stellar/smart-account-kit";

export interface ISmartAccountMainnetCheckInput {
  readonly smartAccountAddress?: string | null;
  readonly credentialId?: string | null;
}

type TIndexerSigner = {
  readonly signer_address?: string;
  readonly signer_type?: string;
};

type TIndexerContextRule = {
  readonly signers?: readonly TIndexerSigner[];
};

function normalizeCredentialId(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function selectConnectedSignerVerifier(
  contextRules: readonly TIndexerContextRule[],
): string | undefined {
  const signer = contextRules
    .flatMap((rule) => rule.signers ?? [])
    .find((candidate) => candidate.signer_type === "External" && candidate.signer_address);

  return normalizeContractId(signer?.signer_address);
}

export async function getConnectedSmartAccountReadiness(
  input: ISmartAccountMainnetCheckInput = {},
): Promise<ISmartAccountMainnetReadiness> {
  const config = getSmartAccountDeploymentConfig();
  const kit = getSmartAccountKit();
  const connectedAccountAddress =
    normalizeContractId(input.smartAccountAddress) ?? normalizeContractId(kit.contractId);
  const sourceAccount = kit.deployerPublicKey;
  const sourceAccountFunded = await kit.rpc
    .getAccount(sourceAccount)
    .then(() => true)
    .catch(() => false);
  let connectedAccountWasmHash: string | undefined;
  let connectedSignerVerifier: string | undefined;

  if (connectedAccountAddress) {
    connectedAccountWasmHash = await readSmartAccountWasmHash({
      rpcUrl: config.rpcUrl ?? "",
      contractId: connectedAccountAddress,
    }).catch(() => undefined);

    const details = await kit
      .getContractDetailsFromIndexer(connectedAccountAddress)
      .catch(() => null);
    connectedSignerVerifier = selectConnectedSignerVerifier(
      (details?.contextRules ?? []) as readonly TIndexerContextRule[],
    );
  }

  return evaluateSmartAccountMainnetReadiness({
    connectedAccountAddress,
    connectedAccountWasmHash,
    connectedSignerVerifier,
    sourceAccount,
    sourceAccountFunded,
  });
}

export function getStaticSmartAccountReadiness(): ISmartAccountMainnetReadiness {
  return evaluateSmartAccountMainnetReadiness();
}

export function normalizeSmartAccountCredentialId(
  value: string | null | undefined,
): string | undefined {
  return normalizeCredentialId(value);
}
