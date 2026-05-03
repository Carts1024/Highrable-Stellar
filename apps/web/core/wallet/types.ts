export type TWalletConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export type TWalletNetwork = "testnet";

export type TWalletErrorCode =
  | "NOT_INITIALIZED"
  | "UNSUPPORTED_NETWORK"
  | "CONNECT_FAILED"
  | "DISCONNECT_FAILED"
  | "AUTH_FAILED"
  | "CONFIG_ERROR"
  | "UNKNOWN";

export type TWalletError = {
  code: TWalletErrorCode;
  message: string;
};

export type TWalletAccount = {
  address: string;
  displayAddress: string;
  walletId: string;
};

export type TWalletState = {
  status: TWalletConnectionStatus;
  network: TWalletNetwork;
  account: TWalletAccount | null;
  error: TWalletError | null;
};

export type TAuthSession = {
  address: string;
  token: string;
  expiresAt: string;
};

export type TAuthChallenge = {
  nonce: string;
  message: string;
  expiresAt: string;
};

export interface IWalletClient {
  connect(): Promise<TWalletAccount>;
  disconnect(): Promise<void>;
  signMessage(message: string): Promise<string>;
}

export interface IWalletAuthService {
  createChallenge(address: string): Promise<TAuthChallenge>;
  verifySignature(input: {
    address: string;
    signature: string;
    message: string;
    nonce: string;
  }): Promise<TAuthSession>;
}
