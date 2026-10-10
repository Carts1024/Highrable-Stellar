// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  clearWalletError: vi.fn(),
  connectWallet: vi.fn<(onNotice?: (message: string) => void) => Promise<string | null>>(),
  recordWalletIdentity: vi.fn(),
  setActiveWalletMode: vi.fn(),
  walletConnectEnabled: true,
  walletState: {
    error: null as string | null,
    isConnecting: false,
  },
}));

vi.mock("@/core/wallet/config", () => ({
  get WALLETCONNECT_ENABLED() {
    return mockState.walletConnectEnabled;
  },
}));

vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => ({
    clearWalletError: mockState.clearWalletError,
    connectWallet: mockState.connectWallet,
    walletState: mockState.walletState,
  }),
}));

vi.mock("@/core/wallet/passkey-smart-account-context", () => ({
  usePasskeySmartAccount: () => ({ setActiveWalletMode: mockState.setActiveWalletMode }),
}));

vi.mock("@/core/wallet/components/passkey-smart-account-card", () => ({
  PasskeySmartAccountCard: () => null,
}));

vi.mock("@repo/convex-client", () => ({
  api: { users: { recordWalletIdentity: "recordWalletIdentity" } },
}));

vi.mock("convex/react", () => ({
  useMutation: () => mockState.recordWalletIdentity,
}));

vi.mock("@repo/ui/components/ui-customs/responsive-dialog", () => ({
  ResponsiveDialog: ({ children }: { children: React.ReactNode }) => children,
  ResponsiveDialogContent: ({ children }: { children: React.ReactNode }) => children,
  ResponsiveDialogDescription: ({ children }: { children: React.ReactNode }) => children,
  ResponsiveDialogHeader: ({ children }: { children: React.ReactNode }) => children,
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => children,
  ResponsiveDialogTrigger: ({ children }: { children: React.ReactNode }) => children,
}));

import { WalletConnectTrigger } from "./wallet-connect-trigger";

describe("WalletConnectTrigger external wallet feedback", () => {
  beforeEach(() => {
    mockState.clearWalletError.mockReset();
    mockState.connectWallet.mockReset().mockResolvedValue(null);
    mockState.recordWalletIdentity.mockReset().mockResolvedValue(undefined);
    mockState.setActiveWalletMode.mockReset();
    mockState.walletConnectEnabled = true;
    mockState.walletState.error = null;
    mockState.walletState.isConnecting = false;
  });

  afterEach(cleanup);

  it("shows a cancellation as retryable feedback", async () => {
    mockState.connectWallet.mockImplementation(async () => {
      mockState.walletState.error = "The user closed the modal.";
      return null;
    });
    render(<WalletConnectTrigger />);

    fireEvent.click(screen.getByRole("button", { name: "Connect External Wallet" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Connection canceled. Choose a wallet to try again.",
    );
  });

  it("shows wallet connection failures in an accessible alert", async () => {
    mockState.connectWallet.mockImplementation(async () => {
      mockState.walletState.error = "Wallet relay could not be reached.";
      return null;
    });
    render(<WalletConnectTrigger />);

    fireEvent.click(screen.getByRole("button", { name: "Connect External Wallet" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Wallet relay could not be reached.",
    );
  });

  it("records the connected external wallet identity", async () => {
    const walletAddress = `G${"B".repeat(55)}`;
    mockState.connectWallet.mockResolvedValue(walletAddress);
    render(<WalletConnectTrigger />);

    fireEvent.click(screen.getByRole("button", { name: "Connect External Wallet" }));

    await waitFor(() => {
      expect(mockState.recordWalletIdentity).toHaveBeenCalledWith({
        walletAddress,
        walletType: "external_wallet",
      });
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the WalletConnect retry notice even if another wallet connects successfully", async () => {
    const walletAddress = `G${"D".repeat(55)}`;
    const notice =
      "WalletConnect is still initializing and was left out of this picker. You can use another available wallet or retry in a moment.";
    mockState.connectWallet.mockImplementation(async (onNotice) => {
      onNotice?.(notice);
      return walletAddress;
    });
    render(<WalletConnectTrigger />);

    fireEvent.click(screen.getByRole("button", { name: "Connect External Wallet" }));

    expect((await screen.findByRole("alert")).textContent).toContain(notice);
    expect(mockState.recordWalletIdentity).toHaveBeenCalledWith({
      walletAddress,
      walletType: "external_wallet",
    });
    expect(screen.getByRole("button", { name: "Try wallet picker again" })).toBeTruthy();
  });

  it("catches identity-recording failures and lets the user retry saving", async () => {
    const walletAddress = `G${"C".repeat(55)}`;
    mockState.connectWallet.mockResolvedValue(walletAddress);
    mockState.recordWalletIdentity
      .mockRejectedValueOnce(new Error("Convex is temporarily unavailable."))
      .mockResolvedValueOnce(undefined);
    render(<WalletConnectTrigger />);

    fireEvent.click(screen.getByRole("button", { name: "Connect External Wallet" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Your wallet is connected, but Highrable could not save it to your account. Retry to finish setup.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry saving wallet" }));

    await waitFor(() => {
      expect(mockState.recordWalletIdentity).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces loading accessibly and gives phone users WalletConnect guidance", () => {
    mockState.walletState.isConnecting = true;
    render(<WalletConnectTrigger />);

    expect(
      screen.getByRole("button", { name: "Connecting wallet..." }).getAttribute("aria-busy"),
    ).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Waiting for wallet approval");
    expect(screen.getByText(/approve the WalletConnect request in Freighter Mobile/)).toBeTruthy();
  });

  it("does not advertise WalletConnect on the local network", () => {
    mockState.walletConnectEnabled = false;
    render(<WalletConnectTrigger />);

    expect(screen.queryByText("Freighter or WalletConnect")).toBeNull();
    expect(screen.queryByText(/WalletConnect request in Freighter Mobile/)).toBeNull();
  });
});
