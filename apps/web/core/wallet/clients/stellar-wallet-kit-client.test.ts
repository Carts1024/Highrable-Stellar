// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  config: {
    STELLAR_MAINNET_NETWORK_LABEL: "Stellar Mainnet" as string,
    STELLAR_MAINNET_NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015" as string,
    STELLAR_TESTNET_NETWORK_LABEL: "Stellar Testnet" as string,
    STELLAR_TESTNET_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015" as string,
    WALLET_NETWORK: "mainnet" as "mainnet" | "testnet" | "local",
    WALLET_NETWORK_LABEL: "Stellar Mainnet" as string,
    WALLET_NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015" as string,
    WALLETCONNECT_ENABLED: true,
    WALLETCONNECT_PROJECT_ID: "test-project-id" as string | undefined,
  },
  activeModules: [] as Array<{ productId: string; productName: string }>,
  authModalCallCount: 0,
  authModalError: null as unknown,
  authModalResultAddress: `G${"A".repeat(55)}`,
  defaultSelectedWalletId: "freighter",
  kitInitCalls: [] as Array<Record<string, unknown>>,
  networkResponse: {
    network: "PUBLIC",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  },
  selectedModule: null as { productId: string; productName: string } | null,
  signMessageCalls: [] as Array<{ message: string; options: unknown }>,
  signTransactionCalls: [] as Array<{ xdr: string; options: unknown }>,
  walletConnectAvailability: vi.fn<() => Promise<boolean>>(),
  walletConnectInstances: [] as Array<{ isAvailable: ReturnType<typeof vi.fn> }>,
  walletConnectOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/core/wallet/config", () => mockState.config);

vi.mock("@creit-tech/stellar-wallets-kit/modules/freighter", () => ({
  FreighterModule: class {
    productId = "freighter";
    productName = "Freighter";
    productUrl = "https://freighter.app";
    productIcon = "freighter-icon";
    moduleType = "extension";

    async isAvailable() {
      return true;
    }
  },
}));

vi.mock("@creit-tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: () => [
    {
      productId: "freighter",
      productName: "Freighter",
      productUrl: "https://freighter.app",
      productIcon: "freighter-icon",
      moduleType: "extension",
    },
    {
      productId: "albedo",
      productName: "Albedo",
      productUrl: "https://albedo.link",
      productIcon: "albedo-icon",
      moduleType: "web",
      isAvailable: async () => true,
    },
  ],
}));

vi.mock("@creit-tech/stellar-wallets-kit/modules/wallet-connect", () => ({
  WalletConnectTargetChain: {
    PUBLIC: "stellar:pubnet",
    TESTNET: "stellar:testnet",
  },
  WalletConnectModule: class {
    productId = "wallet_connect";
    productName = "WalletConnect";
    productUrl = "https://walletconnect.com";
    productIcon = "walletconnect-icon";
    moduleType = "bridge_wallet";
    isAvailable = vi.fn(async () => await mockState.walletConnectAvailability());

    constructor(options: Record<string, unknown>) {
      mockState.walletConnectOptions.push(options);
      mockState.walletConnectInstances.push(this);
    }
  },
}));

vi.mock("@creit-tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: {
    init: vi.fn((options: Record<string, unknown>) => {
      mockState.kitInitCalls.push(options);
      mockState.activeModules = options.modules as Array<{
        productId: string;
        productName: string;
      }>;
      mockState.selectedModule = null;
    }),
    setWallet: vi.fn((walletId: string) => {
      const selectedModule = mockState.activeModules.find(
        (module) => module.productId === walletId,
      );
      if (!selectedModule) throw new Error(`Missing wallet module: ${walletId}`);
      mockState.selectedModule = selectedModule;
    }),
    get selectedModule() {
      if (!mockState.selectedModule) throw new Error("No selected wallet module");
      return mockState.selectedModule;
    },
    authModal: vi.fn(async () => {
      mockState.authModalCallCount += 1;
      if (mockState.authModalError) throw mockState.authModalError;

      if (!mockState.selectedModule) {
        mockState.selectedModule =
          mockState.activeModules.find(
            (module) => module.productId === mockState.defaultSelectedWalletId,
          ) ?? null;
      }

      return { address: mockState.authModalResultAddress };
    }),
    getNetwork: vi.fn(async () => mockState.networkResponse),
    getAddress: vi.fn(async () => ({ address: mockState.authModalResultAddress })),
    signMessage: vi.fn(async (message: string, options: unknown) => {
      mockState.signMessageCalls.push({ message, options });
      return { signedMessage: "signed-message-result" };
    }),
    signTransaction: vi.fn(async (xdr: string, options: unknown) => {
      mockState.signTransactionCalls.push({ xdr, options });
      return { signedTxXdr: "signed-transaction-result" };
    }),
    disconnect: vi.fn(async () => undefined),
  },
}));

vi.mock("@creit-tech/stellar-wallets-kit/types", () => ({
  Networks: {
    PUBLIC: "PUBLIC",
    TESTNET: "TESTNET",
  },
}));

const PUBLIC_KEY = `G${"A".repeat(55)}`;

async function loadClient(
  network: "mainnet" | "testnet" | "local" = "mainnet",
  projectId: string | undefined = "test-project-id",
) {
  vi.resetModules();
  localStorage.clear();

  mockState.config.WALLET_NETWORK = network;
  mockState.config.WALLET_NETWORK_LABEL =
    network === "mainnet"
      ? "Stellar Mainnet"
      : network === "local"
        ? "Local Stellar Network"
        : "Stellar Testnet";
  mockState.config.WALLET_NETWORK_PASSPHRASE =
    network === "mainnet"
      ? "Public Global Stellar Network ; September 2015"
      : network === "local"
        ? "Standalone Network ; February 2017"
        : "Test SDF Network ; September 2015";
  mockState.config.WALLETCONNECT_PROJECT_ID = projectId;
  mockState.config.WALLETCONNECT_ENABLED = network !== "local" && Boolean(projectId);
  mockState.networkResponse = {
    network: network === "mainnet" ? "PUBLIC" : network === "local" ? "LOCAL" : "TESTNET",
    networkPassphrase: mockState.config.WALLET_NETWORK_PASSPHRASE,
  };
  mockState.activeModules = [];
  mockState.authModalCallCount = 0;
  mockState.authModalError = null;
  mockState.defaultSelectedWalletId = "freighter";
  mockState.kitInitCalls.length = 0;
  mockState.signMessageCalls.length = 0;
  mockState.signTransactionCalls.length = 0;
  mockState.walletConnectAvailability.mockReset().mockResolvedValue(true);
  mockState.walletConnectInstances.length = 0;
  mockState.walletConnectOptions.length = 0;

  const { StellarWalletKitClient } = await import("./stellar-wallet-kit-client");
  return new StellarWalletKitClient();
}

function modulesFromInitCall(index = mockState.kitInitCalls.length - 1) {
  return mockState.kitInitCalls[index]?.modules as Array<{ productId: string }>;
}

describe("StellarWalletKitClient WalletConnect readiness", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("waits through delayed initialization before opening the picker", async () => {
    const client = await loadClient();
    mockState.walletConnectAvailability
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    vi.useFakeTimers();

    const connection = client.connect();
    await vi.advanceTimersByTimeAsync(200);

    await expect(connection).resolves.toMatchObject({
      address: PUBLIC_KEY,
      walletId: "freighter",
    });
    expect(mockState.walletConnectInstances).toHaveLength(1);
    expect(mockState.walletConnectInstances[0]?.isAvailable).toHaveBeenCalledTimes(3);
    expect(mockState.authModalCallCount).toBe(1);
    expect(modulesFromInitCall()).toContainEqual(
      expect.objectContaining({ productId: "wallet_connect" }),
    );
  });

  it("omits WalletConnect on readiness timeout and rechecks it on retry", async () => {
    const client = await loadClient();
    mockState.walletConnectAvailability.mockResolvedValue(false);
    mockState.authModalError = new Error("The user closed the modal.");
    vi.useFakeTimers();

    const readinessNotices: string[] = [];
    const failedConnection = client.connect((notice) => readinessNotices.push(notice));
    const failedConnectionAssertion =
      expect(failedConnection).rejects.toThrow(/left out of this picker/);
    await vi.advanceTimersByTimeAsync(10_000);
    await failedConnectionAssertion;
    expect(readinessNotices).toEqual([
      "WalletConnect is still initializing and was left out of this picker. You can use another available wallet or retry in a moment.",
    ]);
    expect(modulesFromInitCall()).toContainEqual(
      expect.objectContaining({ productId: "freighter" }),
    );
    expect(modulesFromInitCall()).not.toContainEqual(
      expect.objectContaining({ productId: "wallet_connect" }),
    );

    mockState.walletConnectAvailability.mockResolvedValue(true);
    mockState.authModalError = null;
    await expect(client.connect()).resolves.toMatchObject({ walletId: "freighter" });
    expect(mockState.walletConnectInstances).toHaveLength(1);
    expect(mockState.walletConnectInstances[0]?.isAvailable).toHaveBeenCalledTimes(101);
    expect(modulesFromInitCall()).toContainEqual(
      expect.objectContaining({ productId: "wallet_connect" }),
    );
  });

  it("coalesces concurrent connection attempts and retains one module instance", async () => {
    const client = await loadClient();
    mockState.walletConnectAvailability.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.useFakeTimers();

    const firstConnection = client.connect();
    const secondConnection = client.connect();
    expect(secondConnection).toBe(firstConnection);

    await vi.advanceTimersByTimeAsync(100);
    await expect(Promise.all([firstConnection, secondConnection])).resolves.toHaveLength(2);
    expect(mockState.walletConnectInstances).toHaveLength(1);
    expect(mockState.authModalCallCount).toBe(1);
    expect(mockState.walletConnectInstances[0]?.isAvailable).toHaveBeenCalledTimes(2);
  });

  it("checks readiness before restoring a WalletConnect selection", async () => {
    const client = await loadClient();
    localStorage.setItem("@StellarWalletsKit/activeAddress", PUBLIC_KEY);
    localStorage.setItem("@StellarWalletsKit/selectedModuleId", "wallet_connect");
    mockState.walletConnectAvailability.mockResolvedValue(false);
    vi.useFakeTimers();

    const restoration = client.restoreConnection();
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(restoration).resolves.toBeNull();
    expect(mockState.walletConnectInstances[0]?.isAvailable).toHaveBeenCalledTimes(100);
    expect(mockState.authModalCallCount).toBe(0);
  });

  it("does not construct or advertise WalletConnect without a project ID", async () => {
    const client = await loadClient("testnet", "");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockState.authModalError = new Error("The user closed the modal.");

    await expect(client.connect()).rejects.toThrow("The user closed the modal.");
    expect(mockState.walletConnectOptions).toHaveLength(0);
    expect(modulesFromInitCall()).not.toContainEqual(
      expect.objectContaining({ productId: "wallet_connect" }),
    );
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("does not advertise WalletConnect on the local network", async () => {
    const client = await loadClient("local");
    mockState.authModalError = new Error("The user closed the modal.");

    await expect(client.connect()).rejects.toThrow("The user closed the modal.");
    expect(mockState.walletConnectOptions).toHaveLength(0);
    expect(modulesFromInitCall()).not.toContainEqual(
      expect.objectContaining({ productId: "wallet_connect" }),
    );
  });

  it.each([
    ["mainnet", "stellar:pubnet", "PUBLIC", "Public Global Stellar Network ; September 2015"],
    ["testnet", "stellar:testnet", "TESTNET", "Test SDF Network ; September 2015"],
  ] as const)("uses the configured %s chain", async (network, chain, kitNetwork, passphrase) => {
    const client = await loadClient(network);

    await client.connect();

    expect(mockState.walletConnectOptions[0]?.allowedChains).toEqual([chain]);
    expect(mockState.kitInitCalls[0]?.network).toBe(kitNetwork);
    expect(mockState.networkResponse.networkPassphrase).toBe(passphrase);
  });

  it("delegates transaction and message signing with the configured network", async () => {
    const client = await loadClient("testnet");
    await client.connect();

    await expect(client.signMessage("Highrable wallet authentication message")).resolves.toBe(
      "signed-message-result",
    );
    await expect(client.signTransaction("x".repeat(32), PUBLIC_KEY)).resolves.toBe(
      "signed-transaction-result",
    );

    expect(mockState.signMessageCalls).toEqual([
      {
        message: "Highrable wallet authentication message",
        options: { networkPassphrase: "Test SDF Network ; September 2015" },
      },
    ]);
    expect(mockState.signTransactionCalls).toEqual([
      {
        xdr: "x".repeat(32),
        options: {
          address: PUBLIC_KEY,
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      },
    ]);
  });
});
