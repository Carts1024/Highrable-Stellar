import { STELLAR_HORIZON_URL, STELLAR_NETWORK_PASSPHRASE } from "@/core/config/stellar-contracts";
import { getUsdcAsset, USDC_ASSET_CODE, USDC_ISSUER } from "@/core/stellar/assets";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { Account, BASE_FEE, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const TX_TIMEOUT_SECONDS = 180;

type THorizonBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
};

type THorizonAccount = {
  sequence: string;
  balances: THorizonBalance[];
};

export class UsdcTrustlineError extends Error {
  public readonly code:
    | "ACCOUNT_NOT_FUNDED"
    | "NETWORK_FAILURE"
    | "INSUFFICIENT_XLM"
    | "WRONG_NETWORK"
    | "USER_REJECTED"
    | "CONFIRMATION_DELAYED"
    | "TRANSACTION_FAILED"
    | "UNKNOWN";

  public constructor(message: string, code: UsdcTrustlineError["code"] = "UNKNOWN") {
    super(message);
    this.name = "UsdcTrustlineError";
    this.code = code;
  }
}

export type TSubmittedStellarTx = {
  txHash: string;
};

function getAccountUrl(publicKey: string): string {
  return `${STELLAR_HORIZON_URL}/accounts/${encodeURIComponent(publicKey)}`;
}

function getTransactionsUrl(): string {
  return `${STELLAR_HORIZON_URL}/transactions`;
}

function getTransactionUrl(txHash: string): string {
  return `${STELLAR_HORIZON_URL}/transactions/${encodeURIComponent(txHash)}`;
}

function toErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Stellar request failed. Please try again.";
}

export function normalizeUsdcTrustlineError(error: unknown): UsdcTrustlineError {
  if (error instanceof UsdcTrustlineError) {
    return error;
  }

  const message = normalizeStellarError(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("rejected") ||
    normalizedMessage.includes("declined") ||
    normalizedMessage.includes("denied")
  ) {
    return new UsdcTrustlineError("Wallet signing was rejected.", "USER_REJECTED");
  }

  if (
    normalizedMessage.includes("not funded") ||
    normalizedMessage.includes("account not found") ||
    normalizedMessage.includes("does not exist") ||
    normalizedMessage.includes("404")
  ) {
    return new UsdcTrustlineError(
      "Your Stellar testnet wallet needs testnet XLM before enabling USDC.",
      "ACCOUNT_NOT_FUNDED",
    );
  }

  if (
    normalizedMessage.includes("underfunded") ||
    normalizedMessage.includes("insufficient") ||
    normalizedMessage.includes("reserve") ||
    normalizedMessage.includes("op_low_reserve") ||
    normalizedMessage.includes("tx_insufficient_balance")
  ) {
    return new UsdcTrustlineError(
      "Could not enable USDC payments. Please make sure your wallet is funded with testnet XLM and try again.",
      "INSUFFICIENT_XLM",
    );
  }

  if (normalizedMessage.includes("timeout") || normalizedMessage.includes("timed out")) {
    return new UsdcTrustlineError(
      "USDC setup was submitted, but confirmation is delayed. Please try refreshing in a moment.",
      "CONFIRMATION_DELAYED",
    );
  }

  if (normalizedMessage.includes("network")) {
    return new UsdcTrustlineError(
      "Switch your wallet to Stellar Testnet before enabling USDC payments.",
      "WRONG_NETWORK",
    );
  }

  if (
    normalizedMessage.includes("tx_failed") ||
    normalizedMessage.includes("op_") ||
    normalizedMessage.includes("failed")
  ) {
    return new UsdcTrustlineError(
      "Could not enable USDC payments. Please make sure your wallet is funded with testnet XLM and try again.",
      "TRANSACTION_FAILED",
    );
  }

  return new UsdcTrustlineError(message || toErrorMessage(error), "NETWORK_FAILURE");
}

async function loadHorizonAccount(publicKey: string): Promise<THorizonAccount> {
  const sanitizedPublicKey = TStellarPublicKeySchema.parse(publicKey);

  let response: Response;
  try {
    response = await fetch(getAccountUrl(sanitizedPublicKey), {
      method: "GET",
      cache: "no-store",
    });
  } catch {
    throw new UsdcTrustlineError(
      "Unable to reach Stellar testnet. Please check your connection and try again.",
      "NETWORK_FAILURE",
    );
  }

  if (response.status === 404) {
    throw new UsdcTrustlineError(
      "Your Stellar testnet wallet needs testnet XLM before enabling USDC.",
      "ACCOUNT_NOT_FUNDED",
    );
  }

  if (!response.ok) {
    throw new UsdcTrustlineError(
      `Unable to check USDC readiness on Stellar testnet (${response.status}).`,
      "NETWORK_FAILURE",
    );
  }

  const account = (await response.json()) as THorizonAccount;
  if (!Array.isArray(account.balances) || typeof account.sequence !== "string") {
    throw new UsdcTrustlineError(
      "Stellar testnet returned an unreadable account response.",
      "NETWORK_FAILURE",
    );
  }

  return account;
}

export async function hasUsdcTrustline(publicKey: string): Promise<boolean> {
  const account = await loadHorizonAccount(publicKey);

  return account.balances.some(
    (balance) =>
      balance.asset_type !== "native" &&
      balance.asset_code === USDC_ASSET_CODE &&
      balance.asset_issuer === USDC_ISSUER,
  );
}

export async function buildEnableUsdcTrustlineTx(publicKey: string): Promise<string> {
  const sanitizedPublicKey = TStellarPublicKeySchema.parse(publicKey);
  const account = await loadHorizonAccount(sanitizedPublicKey);
  const sourceAccount = new Account(sanitizedPublicKey, account.sequence);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset: getUsdcAsset() }))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  return transaction.toXDR();
}

export async function submitSignedStellarTransactionXdr(
  signedTransactionXdr: string,
): Promise<TSubmittedStellarTx> {
  let response: Response;
  try {
    response = await fetch(getTransactionsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        tx: signedTransactionXdr,
      }),
    });
  } catch {
    throw new UsdcTrustlineError(
      "Unable to submit the USDC setup transaction. Please check your connection and try again.",
      "NETWORK_FAILURE",
    );
  }

  const responseText = await response.text();
  let payload: unknown = null;

  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "extras" in payload &&
      typeof payload.extras === "object" &&
      payload.extras !== null &&
      "result_codes" in payload.extras
        ? JSON.stringify(payload.extras.result_codes)
        : toErrorMessage(payload ?? responseText);

    throw normalizeUsdcTrustlineError(new Error(message));
  }

  if (typeof payload === "object" && payload !== null && "hash" in payload) {
    const hash = (payload as { hash?: unknown }).hash;
    if (typeof hash === "string" && hash.trim()) {
      return {
        txHash: hash,
      };
    }
  }

  throw new UsdcTrustlineError(
    "USDC setup was submitted, but Stellar returned an unreadable response.",
    "CONFIRMATION_DELAYED",
  );
}

export async function waitForClassicTransaction(txHash: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(getTransactionUrl(txHash), {
      method: "GET",
      cache: "no-store",
    });

    if (response.ok) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
  }

  throw new UsdcTrustlineError(
    "USDC setup was submitted, but confirmation is delayed. Please try refreshing in a moment.",
    "CONFIRMATION_DELAYED",
  );
}

export async function enableUsdcTrustline({
  publicKey,
  signTransaction,
}: {
  publicKey: string;
  signTransaction: (xdr: string) => Promise<string>;
}): Promise<TSubmittedStellarTx> {
  try {
    if (await hasUsdcTrustline(publicKey)) {
      return {
        txHash: "",
      };
    }

    const transactionXdr = await buildEnableUsdcTrustlineTx(publicKey);
    const signedXdr = await signTransaction(transactionXdr);
    const submittedTx = await submitSignedStellarTransactionXdr(signedXdr);

    await waitForClassicTransaction(submittedTx.txHash);

    if (!(await hasUsdcTrustline(publicKey))) {
      throw new UsdcTrustlineError(
        "USDC setup was submitted, but confirmation is delayed. Please try refreshing in a moment.",
        "CONFIRMATION_DELAYED",
      );
    }

    return submittedTx;
  } catch (error) {
    throw normalizeUsdcTrustlineError(error);
  }
}
