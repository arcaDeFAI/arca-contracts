import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRealVaults } from "../use-real-vaults";
import * as useVaultRegistryModule from "../use-vault-registry";
import * as useVaultMetricsModule from "../use-vault-metrics";
import { TestProviders } from "../../test-utils/test-providers";
import {
  useAccount,
  useReadContracts,
  type UseAccountReturnType,
  type UseReadContractsReturnType,
} from "wagmi";
import {
  createMockUseAccount,
  createMockUseReadContracts,
} from "../../test-utils/mock-contracts";

// Mock dependencies
vi.mock("../use-vault-registry");
vi.mock("../use-vault-metrics");
vi.mock("wagmi", async () => {
  const actual = await vi.importActual("wagmi");
  return {
    ...actual,
    useAccount: vi.fn(),
    useReadContracts: vi.fn(),
  };
});

describe("useRealVaults - Decoupling Test", () => {
  const mockRegistryVault = {
    vault: "0x123",
    name: "Test Vault",
    tokenX: "0xabc",
    tokenY: "0xdef",
    rewardClaimer: "0xRewardClaimer",
    queueHandler: "0xQueueHandler",
    feeManager: "0xFeeManager",
    symbol: "TEST",
    isActive: true,
    deploymentTimestamp: BigInt(Date.now()),
    deployer: "0x1234567890123456789012345678901234567890",
    isProxy: true,
  };

  // Define mock vault data that useVault returns
  const mockVaultData = {
    vaultConfig: {
      address: "0x123",
      tokenX: { symbol: "wS", address: "0xabc", decimals: 18 },
      tokenY: { symbol: "USDC.e", address: "0xdef", decimals: 6 },
      name: "Test Vault",
      platform: "DLMM",
      chain: "Sonic",
      isActive: true,
    },
    vaultAddress: "0x123",
    userAddress: "0xUser123",
    chainId: 146,
    tokenXSymbol: "wS",
    tokenYSymbol: "USDC.e",
    vaultBalanceX: "1000.0",
    vaultBalanceY: "2000.0",
    userSharesX: "100.0",
    userSharesY: "200.0",
    pricePerShareX: "1.1",
    pricePerShareY: "1.2",
    userBalanceX: "50.0",
    userBalanceY: "100.0",
    pendingDeposits: "0",
    pendingWithdraws: "0",
    totalCompoundedX: "0.0",
    totalCompoundedY: "0.0",
    rewardClaimerAddress: "0xRewardClaimer",
    rewardDataAvailable: false,
    isWritePending: false,
    isConfirming: false,
    isConfirmed: false,
    lastOperation: null,
    hash: undefined,
    approveTokenX: vi.fn(),
    approveTokenY: vi.fn(),
    depositTokenX: vi.fn(),
    depositTokenY: vi.fn(),
    withdrawShares: vi.fn(),
    withdrawAll: vi.fn(),
    hasAllowance: vi.fn(),
    validateBalance: vi.fn(),
    validateConnection: vi.fn(),
    formatBalance: vi.fn(),
    error: null,
    clearError: vi.fn(),
    // Legacy compatibility
    userBalanceWS: "50.0",
    userBalanceUSDC: "100.0",
    approveWS: vi.fn(),
    approveUSDC: vi.fn(),
    depositWS: vi.fn(),
    depositUSDC: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default useAccount mock with user address
    vi.mocked(useAccount).mockReturnValue(
      createMockUseAccount("0xUser123", 146),
    );
  });

  it("should return vaults immediately without waiting for metrics", async () => {
    // Setup registry to return vault immediately
    vi.mocked(useVaultRegistryModule.useVaultRegistry).mockReturnValue({
      vaults: [mockRegistryVault],
      isLoading: false,
      error: null,
      registryAddress: "0xregistry",
    });

    // Mock useReadContracts to return vault data
    vi.mocked(useReadContracts).mockReturnValue(
      createMockUseReadContracts([
        { result: 1000n }, // vaultBalanceX
        { result: 2000n }, // vaultBalanceY
        { result: 100n }, // userSharesX
        { result: 200n }, // userSharesY
        { result: 1100000000000000000n }, // pricePerShareX (1.1 * 1e18)
        { result: 1200000000000000000n }, // pricePerShareY (1.2 * 1e18)
        { result: "wS" }, // tokenX symbol
        { result: "USDC.e" }, // tokenY symbol
        { result: 50n }, // userBalanceX
        { result: 100n }, // userBalanceY
      ]),
    );

    // Setup metrics to be loading (simulating slow price fetch)
    vi.mocked(useVaultMetricsModule.useVaultMetrics).mockReturnValue({
      metrics: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useRealVaults(), {
      wrapper: TestProviders,
    });

    // Should not be loading since we have vault data
    expect(result.current.isLoading).toBe(false);

    // Should return vault with basic data
    expect(result.current.vaults).toHaveLength(1);
    const vault = result.current.vaults[0];

    // Basic data should be available
    expect(vault.name).toBe("Test Vault");
    expect(vault.vaultBalanceX).toBe("1000");
    expect(vault.vaultBalanceY).toBe("2000");

    // Metrics data should be undefined (not loaded yet)
    expect(vault.totalTvl).toBeUndefined();
    expect(vault.apr).toBeUndefined();
    expect(vault.userBalance).toBeUndefined();

    // Loading state should indicate metrics are loading
    expect(vault.metricsLoading).toBe(true);
  });

  it("should update vault with metrics when they become available", async () => {
    const mockMetrics = {
      // Required properties
      isDataAvailable: true,
      priceDataLoading: false,
      priceDataError: null,
      pricePerShareX: 1.0,
      pricePerShareY: 1.0,
      lastUpdated: Date.now(),
      isStale: false,
      // Optional properties
      totalTvlUSD: 5000,
      userTotalUSD: 500,
      realApr: 45.2,
      dailyApr: 0.124,
      vaultBalanceXUSD: 2000,
      vaultBalanceYUSD: 3000,
      userSharesXUSD: 200,
      userSharesYUSD: 300,
      userEarnings: 50,
      userROI: 10,
      userTotalDeposited: 450,
    };

    vi.mocked(useVaultRegistryModule.useVaultRegistry).mockReturnValue({
      vaults: [mockRegistryVault],
      isLoading: false,
      error: null,
      registryAddress: "0xregistry",
    });

    // Mock useReadContracts to return vault data
    vi.mocked(useReadContracts).mockReturnValue(
      createMockUseReadContracts([
        { result: 1000n }, // vaultBalanceX
        { result: 2000n }, // vaultBalanceY
        { result: 100n }, // userSharesX
        { result: 200n }, // userSharesY
        { result: 1100000000000000000n }, // pricePerShareX (1.1 * 1e18)
        { result: 1200000000000000000n }, // pricePerShareY (1.2 * 1e18)
        { result: "wS" }, // tokenX symbol
        { result: "USDC.e" }, // tokenY symbol
        { result: 50n }, // userBalanceX
        { result: 100n }, // userBalanceY
      ]),
    );

    // Start with loading metrics
    const metricsHook = vi.mocked(useVaultMetricsModule.useVaultMetrics);
    metricsHook.mockReturnValue({
      metrics: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { result, rerender } = renderHook(() => useRealVaults(), {
      wrapper: TestProviders,
    });

    // Initial state - vault without metrics
    expect(result.current.vaults[0].totalTvl).toBeUndefined();
    expect(result.current.vaults[0].metricsLoading).toBe(true);

    // Update metrics to be loaded
    metricsHook.mockReturnValue({
      metrics: mockMetrics as ReturnType<
        typeof useVaultMetricsModule.useVaultMetrics
      >["metrics"],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    rerender();

    await waitFor(() => {
      const vault = result.current.vaults[0];
      // Metrics should now be available
      expect(vault.totalTvl).toBe(5000);
      expect(vault.apr).toBe(45.2);
      expect(vault.userBalance).toBe(500);
      expect(vault.metricsLoading).toBe(false);
    });
  });

  it("should show vault discovery as loading only when registry is loading", () => {
    // Registry is loading
    vi.mocked(useVaultRegistryModule.useVaultRegistry).mockReturnValue({
      vaults: [],
      isLoading: true,
      error: null,
      registryAddress: "0xregistry",
    });

    const { result } = renderHook(() => useRealVaults(), {
      wrapper: TestProviders,
    });

    // Should be loading because registry is loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.vaults).toHaveLength(0);
  });

  it("should handle metrics errors gracefully with progressive enhancement", () => {
    vi.mocked(useVaultRegistryModule.useVaultRegistry).mockReturnValue({
      vaults: [mockRegistryVault],
      isLoading: false,
      error: null,
      registryAddress: "0xregistry",
    });

    // Mock useReadContracts to return vault data
    vi.mocked(useReadContracts).mockReturnValue(
      createMockUseReadContracts([
        { result: 1000n }, // vaultBalanceX
        { result: 2000n }, // vaultBalanceY
        { result: 100n }, // userSharesX
        { result: 200n }, // userSharesY
        { result: 1100000000000000000n }, // pricePerShareX (1.1 * 1e18)
        { result: 1200000000000000000n }, // pricePerShareY (1.2 * 1e18)
        { result: "wS" }, // tokenX symbol
        { result: "USDC.e" }, // tokenY symbol
        { result: 50n }, // userBalanceX
        { result: 100n }, // userBalanceY
      ]),
    );

    // Progressive enhancement: metrics returns partial data with error indicators
    vi.mocked(useVaultMetricsModule.useVaultMetrics).mockReturnValue({
      metrics: {
        isDataAvailable: true,
        priceDataLoading: false,
        priceDataError: "Failed to fetch prices",
        pricePerShareX: 1.1,
        pricePerShareY: 1.2,
        lastUpdated: Date.now(),
        isStale: false,
        // USD values undefined due to price error
      } as ReturnType<typeof useVaultMetricsModule.useVaultMetrics>["metrics"],
      isLoading: false,
      error: null, // No top-level error
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useRealVaults(), {
      wrapper: TestProviders,
    });

    // Should still return vault (no blocking)
    expect(result.current.isLoading).toBe(false);
    expect(result.current.vaults).toHaveLength(1);
    expect(result.current.error).toBeNull(); // No top-level error

    // Should have vault data with price error indicated in metrics
    const vault = result.current.vaults[0];
    expect(vault.metricsError).toBe("Failed to fetch prices");
    expect(vault.metricsLoading).toBe(false);

    // Basic vault data should be available
    expect(vault.name).toBe("Test Vault");
    expect(vault.vaultBalanceX).toBe("1000");

    // USD values should be undefined due to price error
    expect(vault.totalTvl).toBeUndefined();
    expect(vault.userBalance).toBeUndefined();
  });
});
