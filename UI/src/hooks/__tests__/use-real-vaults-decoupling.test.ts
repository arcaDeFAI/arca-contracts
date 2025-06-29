import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRealVaults } from "../use-real-vaults";
import * as useVaultRegistryModule from "../use-vault-registry";
import * as useVaultModule from "../use-vault";
import * as useVaultMetricsModule from "../use-vault-metrics";
import { TestProviders } from "../../test-utils/test-providers";
import { useAccount } from "wagmi";

// Mock dependencies
vi.mock("../use-vault-registry");
vi.mock("../use-vault");
vi.mock("../use-vault-metrics");
vi.mock("wagmi", async () => {
  const actual = await vi.importActual("wagmi");
  return {
    ...actual,
    useAccount: vi.fn(),
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
  };

  const mockVaultData = {
    vaultConfig: { address: "0x123" },
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
    pendingDeposits: "5",
    pendingWithdraws: "2",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default useAccount mock
    vi.mocked(useAccount).mockReturnValue({
      chainId: 146,
    } as ReturnType<typeof useAccount>);
  });

  it("should return vaults immediately without waiting for metrics", async () => {
    // Setup registry to return vault immediately
    vi.mocked(useVaultRegistryModule.useVaultRegistry).mockReturnValue({
      vaults: [mockRegistryVault],
      isLoading: false,
      error: null,
      registryAddress: "0xregistry",
    });

    // Setup vault data to be available
    vi.mocked(useVaultModule.useVault).mockReturnValue(
      mockVaultData as ReturnType<typeof useVaultModule.useVault>,
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
    expect(vault.vaultBalanceX).toBe("1000.0");
    expect(vault.vaultBalanceY).toBe("2000.0");

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

    vi.mocked(useVaultModule.useVault).mockReturnValue(
      mockVaultData as ReturnType<typeof useVaultModule.useVault>,
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

    vi.mocked(useVaultModule.useVault).mockReturnValue(
      mockVaultData as ReturnType<typeof useVaultModule.useVault>,
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
    expect(vault.vaultBalanceX).toBe("1000.0");

    // USD values should be undefined due to price error
    expect(vault.totalTvl).toBeUndefined();
    expect(vault.userBalance).toBeUndefined();
  });
});
