import {
  STABLECOIN_ASSET_CODE,
  STABLECOIN_ISSUER,
  STELLAR_HORIZON_URL,
  STELLAR_NETWORK,
  STELLAR_NETWORK_PASSPHRASE,
} from "@/core/config/stellar-contracts";
import { TStellarPublicKeySchema, TTransactionXdrSchema } from "@/core/wallet/validation";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import type { TSignedTransactionSubmitter } from "./transaction";
import type { Horizon as HorizonTypes, Transaction } from "@stellar/stellar-sdk";

const TX_TIMEOUT_SECONDS = 60;
const DEFAULT_SLIPPAGE_BPS = 100;
const MAX_SLIPPAGE_BPS = 500;
const STROOPS_PER_XLM = 10_000_000n;
const BASE_RESERVE_XLM = "0.5";
const MIN_XLM_FEE_RESERVE = "0.1";

export type TPathPaymentConfig = {
  readonly horizonUrl: string;
  readonly networkPassphrase: string;
  readonly usdcAssetCode: string;
  readonly usdcAssetIssuer: string;
};

export type TPathPaymentQuoteRequest = {
  readonly sourceAccount: string;
  readonly destinationAccount: string;
  readonly destAmount: string;
  readonly maxSlippageBps?: number;
};

export type TPathPaymentQuote = {
  readonly sourceAsset: "XLM";
  readonly destinationAssetCode: string;
  readonly destinationAssetIssuer: string;
  readonly destinationAmount: string;
  readonly estimatedSendAmount: string;
  readonly sendMax: string;
  readonly path: readonly TPathPaymentPathAsset[];
  readonly priceImpactWarning?: string;
  readonly raw?: unknown;
};

export type TPathPaymentPathAsset = {
  readonly assetType: string;
  readonly assetCode?: string;
  readonly assetIssuer?: string;
};

export type TExecutePathPaymentRequest = {
  readonly sourceAccount: string;
  readonly destinationAccount: string;
  readonly destAmount: string;
  readonly sendMax: string;
  readonly path: TPathPaymentQuote["path"];
  readonly memo?: string;
};

export type TExecutePathPaymentResult = {
  readonly hash: string;
  readonly ledger?: number;
  readonly successful: boolean;
};

export type TPathPaymentErrorCode =
  | "CONFIG_MISSING"
  | "INVALID_USDC_ISSUER"
  | "INVALID_WALLET"
  | "NO_ROUTE"
  | "INSUFFICIENT_XLM"
  | "TRUSTLINE_MISSING"
  | "USER_REJECTED"
  | "HORIZON_FAILURE"
  | "PATH_CHANGED"
  | "NETWORK_MISMATCH"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE";

export class PathPaymentError extends Error {
  public readonly code: TPathPaymentErrorCode;

  public constructor(message: string, code: TPathPaymentErrorCode) {
    super(message);
    this.name = "PathPaymentError";
    this.code = code;
  }
}

type THorizonAccountBalance = {
  readonly asset_type: string;
  readonly balance: string;
  readonly selling_liabilities?: string;
  readonly asset_code?: string;
  readonly asset_issuer?: string;
};

type THorizonAccountLike = {
  readonly balances?: readonly THorizonAccountBalance[];
  readonly subentry_count?: number | string;
  readonly num_sponsoring?: number | string;
  readonly num_sponsored?: number | string;
};
type THorizonLoadedAccount = Awaited<ReturnType<Horizon.Server["loadAccount"]>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeAmount(value: string, label: string): string {
  const amount = value.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(amount)) {
    throw new PathPaymentError(`${label} must be a positive Stellar amount.`, "MALFORMED_RESPONSE");
  }

  if (decimalToStroops(amount) <= 0n) {
    throw new PathPaymentError(`${label} must be greater than zero.`, "MALFORMED_RESPONSE");
  }

  return amount;
}

function decimalToStroops(value: string): bigint {
  const [wholePart = "0", fractionalPart = ""] = value.trim().split(".");
  return BigInt(wholePart) * STROOPS_PER_XLM + BigInt(fractionalPart.padEnd(7, "0") || "0");
}

function stroopsToDecimal(stroops: bigint): string {
  const wholePart = stroops / STROOPS_PER_XLM;
  const fractionalPart = stroops % STROOPS_PER_XLM;
  const trimmedFraction = fractionalPart.toString().padStart(7, "0").replace(/0+$/, "");

  return trimmedFraction ? `${wholePart.toString()}.${trimmedFraction}` : wholePart.toString();
}

function parseHorizonCount(value: number | string | undefined): bigint {
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.max(0, Math.trunc(value)));
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }

  return 0n;
}

function addSlippage(amount: string, slippageBps: number): string {
  const amountStroops = decimalToStroops(amount);
  const sendMaxStroops = (amountStroops * BigInt(10_000 + slippageBps) + 9_999n) / 10_000n;
  return stroopsToDecimal(sendMaxStroops);
}

function getErrorText(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (isRecord(error)) {
    const responseData =
      isRecord(error.response) && isRecord(error.response.data) ? error.response.data : null;
    const extras = isRecord(responseData?.extras) ? responseData.extras : null;
    const resultCodes = extras?.result_codes;
    if (resultCodes) {
      return JSON.stringify(resultCodes);
    }

    if (typeof responseData?.detail === "string" && responseData.detail.trim()) {
      return responseData.detail.trim();
    }

    const response = error.response;
    if (isRecord(response) && typeof response.statusText === "string") {
      return response.statusText;
    }

    const message = error.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return "Stellar path payment failed. Please try again.";
}

export function getPathPaymentConfig(): TPathPaymentConfig {
  return {
    horizonUrl: STELLAR_HORIZON_URL,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    usdcAssetCode: STABLECOIN_ASSET_CODE,
    usdcAssetIssuer: STABLECOIN_ISSUER,
  };
}

export function validatePathPaymentConfig(config: TPathPaymentConfig = getPathPaymentConfig()): {
  readonly isValid: boolean;
  readonly message?: string;
} {
  if (!config.horizonUrl.trim()) {
    return {
      isValid: false,
      message: "Path payment config is missing NEXT_PUBLIC_STELLAR_HORIZON_URL.",
    };
  }

  try {
    const url = new URL(config.horizonUrl);
    if (
      (STELLAR_NETWORK === "public" || STELLAR_NETWORK === "mainnet") &&
      url.hostname.includes("testnet")
    ) {
      return {
        isValid: false,
        message: "Configured Horizon URL looks like testnet while Highrable is on mainnet.",
      };
    }
  } catch {
    return {
      isValid: false,
      message: "Path payment Horizon URL is invalid.",
    };
  }

  if (!config.networkPassphrase.trim()) {
    return {
      isValid: false,
      message: "Path payment config is missing NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE.",
    };
  }

  if (!config.usdcAssetCode.trim()) {
    return {
      isValid: false,
      message: "Path payment config is missing NEXT_PUBLIC_USDC_ASSET_CODE.",
    };
  }

  const issuerValidation = TStellarPublicKeySchema.safeParse(config.usdcAssetIssuer);
  if (!issuerValidation.success) {
    return {
      isValid: false,
      message: "Path payment config is missing a valid NEXT_PUBLIC_USDC_ASSET_ISSUER.",
    };
  }

  return { isValid: true };
}

export function createHorizonServer(config: TPathPaymentConfig = getPathPaymentConfig()) {
  const validation = validatePathPaymentConfig(config);
  if (!validation.isValid) {
    throw new PathPaymentError(
      validation.message ?? "Path payment config is missing.",
      "CONFIG_MISSING",
    );
  }

  return new Horizon.Server(config.horizonUrl, {
    allowHttp: config.horizonUrl.startsWith("http://"),
    appName: "Highrable",
  });
}

export function getPathPaymentUsdcAsset(
  config: TPathPaymentConfig = getPathPaymentConfig(),
): Asset {
  const validation = validatePathPaymentConfig(config);
  if (!validation.isValid) {
    throw new PathPaymentError(
      validation.message ?? "Path payment config is missing.",
      "CONFIG_MISSING",
    );
  }

  try {
    return new Asset(config.usdcAssetCode.trim(), config.usdcAssetIssuer.trim());
  } catch {
    throw new PathPaymentError("Configured USDC issuer is invalid.", "INVALID_USDC_ISSUER");
  }
}

function normalizePathAsset(pathAsset: {
  readonly asset_type: string;
  readonly asset_code?: string;
  readonly asset_issuer?: string;
}): TPathPaymentPathAsset {
  return {
    assetType: pathAsset.asset_type,
    ...(pathAsset.asset_code ? { assetCode: pathAsset.asset_code } : {}),
    ...(pathAsset.asset_issuer ? { assetIssuer: pathAsset.asset_issuer } : {}),
  };
}

function pathAssetToSdkAsset(pathAsset: TPathPaymentPathAsset): Asset {
  if (pathAsset.assetType === "native") {
    return Asset.native();
  }

  if (!pathAsset.assetCode || !pathAsset.assetIssuer) {
    throw new PathPaymentError(
      "Path payment route contains an invalid asset.",
      "MALFORMED_RESPONSE",
    );
  }

  return new Asset(pathAsset.assetCode, pathAsset.assetIssuer);
}

function isUsdcTrustlineReady(account: THorizonAccountLike, config: TPathPaymentConfig): boolean {
  return (
    account.balances?.some(
      (balance) =>
        balance.asset_type !== "native" &&
        balance.asset_code === config.usdcAssetCode &&
        balance.asset_issuer === config.usdcAssetIssuer,
    ) ?? false
  );
}

export async function getClassicXlmBalance(
  accountId: string,
  server = createHorizonServer(),
): Promise<string | null> {
  const sanitizedAccount = TStellarPublicKeySchema.parse(accountId);
  const account = (await server.loadAccount(sanitizedAccount)) as THorizonAccountLike;
  const nativeBalance = account.balances?.find((balance) => balance.asset_type === "native");
  return nativeBalance?.balance ?? null;
}

export function getClassicXlmMinimumBalance(account: THorizonAccountLike): string {
  const reserveStroops = decimalToStroops(BASE_RESERVE_XLM);
  const subentryCount = parseHorizonCount(account.subentry_count);
  const numSponsoring = parseHorizonCount(account.num_sponsoring);
  const numSponsored = parseHorizonCount(account.num_sponsored);
  const reserveEntryCount = 2n + subentryCount + numSponsoring - numSponsored;
  const minimumBalanceStroops = (reserveEntryCount > 0n ? reserveEntryCount : 0n) * reserveStroops;
  const nativeBalance = account.balances?.find((balance) => balance.asset_type === "native");
  const sellingLiabilitiesStroops = nativeBalance?.selling_liabilities
    ? decimalToStroops(nativeBalance.selling_liabilities)
    : 0n;

  return stroopsToDecimal(minimumBalanceStroops + sellingLiabilitiesStroops);
}

export function getSpendableClassicXlmBalance(account: THorizonAccountLike): string | null {
  const nativeBalance = account.balances?.find((balance) => balance.asset_type === "native");
  if (!nativeBalance) {
    return null;
  }

  const spendableStroops =
    decimalToStroops(nativeBalance.balance) -
    decimalToStroops(getClassicXlmMinimumBalance(account));

  return stroopsToDecimal(spendableStroops > 0n ? spendableStroops : 0n);
}

export function hasEnoughXlmForPathPayment({
  xlmBalance,
  sendMax,
  feeReserve = MIN_XLM_FEE_RESERVE,
  account,
}: {
  readonly xlmBalance: string | null | undefined;
  readonly sendMax: string;
  readonly feeReserve?: string;
  readonly account?: THorizonAccountLike;
}): boolean {
  const availableXlm = account ? getSpendableClassicXlmBalance(account) : xlmBalance;

  if (!availableXlm) {
    return false;
  }

  return decimalToStroops(availableXlm) >= decimalToStroops(sendMax) + decimalToStroops(feeReserve);
}

async function assertEnoughXlmForPathPayment({
  sourceAccount,
  sendMax,
  server,
}: {
  readonly sourceAccount: string;
  readonly sendMax: string;
  readonly server: Horizon.Server;
}): Promise<THorizonLoadedAccount> {
  const account = await server.loadAccount(sourceAccount);
  const accountLike = account as unknown as THorizonAccountLike;
  const xlmBalance = account.balances?.find((balance) => balance.asset_type === "native")?.balance;

  if (!hasEnoughXlmForPathPayment({ xlmBalance, sendMax, account: accountLike })) {
    throw new PathPaymentError(
      "You do not have enough spendable XLM for this conversion after Stellar account reserves and network fees.",
      "INSUFFICIENT_XLM",
    );
  }

  return account;
}

export async function quoteXlmToUsdcStrictReceive(
  request: TPathPaymentQuoteRequest,
  config: TPathPaymentConfig = getPathPaymentConfig(),
): Promise<TPathPaymentQuote> {
  const sourceAccount = TStellarPublicKeySchema.parse(request.sourceAccount);
  const destinationAccount = TStellarPublicKeySchema.parse(request.destinationAccount);
  const destinationAmount = sanitizeAmount(request.destAmount, "Destination amount");
  const slippageBps = request.maxSlippageBps ?? DEFAULT_SLIPPAGE_BPS;

  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > MAX_SLIPPAGE_BPS) {
    throw new PathPaymentError(
      "Slippage tolerance must be between 0% and 5%.",
      "MALFORMED_RESPONSE",
    );
  }

  const server = createHorizonServer(config);
  const destination = (await server.loadAccount(destinationAccount)) as THorizonAccountLike;
  if (!isUsdcTrustlineReady(destination, config)) {
    throw new PathPaymentError(
      "Your wallet must be able to receive USDC before conversion. Enable USDC support in your wallet, then try again.",
      "TRUSTLINE_MISSING",
    );
  }

  let response: HorizonTypes.ServerApi.CollectionPage<HorizonTypes.ServerApi.PaymentPathRecord>;
  try {
    response = await server
      .strictReceivePaths([Asset.native()], getPathPaymentUsdcAsset(config), destinationAmount)
      .call();
  } catch (error) {
    throw classifyPathPaymentError(error);
  }

  const records = response.records.filter(
    (record) =>
      record.source_asset_type === "native" &&
      record.destination_asset_code === config.usdcAssetCode &&
      record.destination_asset_issuer === config.usdcAssetIssuer,
  );

  const bestRoute = records.sort((left, right) =>
    decimalToStroops(left.source_amount) < decimalToStroops(right.source_amount) ? -1 : 1,
  )[0];

  if (!bestRoute) {
    throw new PathPaymentError(
      "No XLM to USDC route is available right now. Try again later or fund your wallet with USDC directly.",
      "NO_ROUTE",
    );
  }

  const estimatedSendAmount = sanitizeAmount(bestRoute.source_amount, "Estimated XLM amount");
  const sendMax = addSlippage(estimatedSendAmount, slippageBps);
  try {
    await assertEnoughXlmForPathPayment({ sourceAccount, sendMax, server });
  } catch (error) {
    if (error instanceof PathPaymentError) {
      throw error;
    }
  }

  return {
    sourceAsset: "XLM",
    destinationAssetCode: config.usdcAssetCode,
    destinationAssetIssuer: config.usdcAssetIssuer,
    destinationAmount,
    estimatedSendAmount,
    sendMax,
    path: bestRoute.path.map(normalizePathAsset),
    raw: bestRoute,
  };
}

export async function buildPathPaymentStrictReceiveTransactionXdr(
  request: TExecutePathPaymentRequest,
  config: TPathPaymentConfig = getPathPaymentConfig(),
): Promise<string> {
  const sourceAccount = TStellarPublicKeySchema.parse(request.sourceAccount);
  const destinationAccount = TStellarPublicKeySchema.parse(request.destinationAccount);
  const destAmount = sanitizeAmount(request.destAmount, "Destination amount");
  const sendMax = sanitizeAmount(request.sendMax, "Maximum XLM spend");
  const server = createHorizonServer(config);
  const account = await assertEnoughXlmForPathPayment({ sourceAccount, sendMax, server });
  const memoText = (request.memo ?? "Highrable USDC top-up").trim().slice(0, 28);
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax,
        destination: destinationAccount,
        destAsset: getPathPaymentUsdcAsset(config),
        destAmount,
        path: request.path.map(pathAssetToSdkAsset),
      }),
    )
    .addMemo(Memo.text(memoText))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  return transaction.toXDR();
}

export async function executeXlmToUsdcTopUp(
  request: TExecutePathPaymentRequest & {
    readonly signTransaction: TSignedTransactionSubmitter;
  },
  config: TPathPaymentConfig = getPathPaymentConfig(),
): Promise<TExecutePathPaymentResult> {
  try {
    const transactionXdr = await buildPathPaymentStrictReceiveTransactionXdr(request, config);
    const signedXdr = TTransactionXdrSchema.parse(await request.signTransaction(transactionXdr));
    const signedTransaction = TransactionBuilder.fromXDR(
      signedXdr,
      config.networkPassphrase,
    ) as Transaction;
    const response = await createHorizonServer(config).submitTransaction(signedTransaction);

    if (!response.successful || !response.hash) {
      throw new PathPaymentError("Horizon submission failed.", "HORIZON_FAILURE");
    }

    return {
      hash: response.hash,
      ledger: response.ledger,
      successful: true,
    };
  } catch (error) {
    throw classifyPathPaymentError(error);
  }
}

export function classifyPathPaymentError(error: unknown): PathPaymentError {
  if (error instanceof PathPaymentError) {
    return error;
  }

  const message = getErrorText(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("rejected") ||
    normalizedMessage.includes("declined") ||
    normalizedMessage.includes("denied") ||
    normalizedMessage.includes("cancel")
  ) {
    return new PathPaymentError("Conversion was cancelled in your wallet.", "USER_REJECTED");
  }

  if (
    normalizedMessage.includes("op_src_no_trust") ||
    normalizedMessage.includes("op_no_destination") ||
    normalizedMessage.includes("op_no_trust") ||
    normalizedMessage.includes("op_not_authorized")
  ) {
    return new PathPaymentError(
      "Your wallet must be able to receive USDC before conversion. Enable USDC support in your wallet, then try again.",
      "TRUSTLINE_MISSING",
    );
  }

  if (
    normalizedMessage.includes("op_underfunded") ||
    normalizedMessage.includes("tx_insufficient_balance") ||
    normalizedMessage.includes("insufficient")
  ) {
    return new PathPaymentError(
      "You do not have enough XLM for this conversion and network fees.",
      "INSUFFICIENT_XLM",
    );
  }

  if (
    normalizedMessage.includes("op_too_few_offers") ||
    normalizedMessage.includes("op_offer_cross_self") ||
    normalizedMessage.includes("op_over_sendmax") ||
    normalizedMessage.includes("underfunded")
  ) {
    return new PathPaymentError(
      "The conversion route changed before submission. Get a new quote and try again.",
      "PATH_CHANGED",
    );
  }

  if (normalizedMessage.includes("network")) {
    return new PathPaymentError(
      "Your wallet network does not match the configured Highrable network.",
      "NETWORK_MISMATCH",
    );
  }

  if (normalizedMessage.includes("timeout") || normalizedMessage.includes("timed out")) {
    return new PathPaymentError("Stellar path payment confirmation timed out.", "TIMEOUT");
  }

  if (normalizedMessage.includes("not found") || normalizedMessage.includes("404")) {
    return new PathPaymentError(
      "No XLM to USDC route is available right now. Try again later or fund your wallet with USDC directly.",
      "NO_ROUTE",
    );
  }

  return new PathPaymentError(message, "HORIZON_FAILURE");
}
