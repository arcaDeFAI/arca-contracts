import { renderHook, waitFor } from "@testing-library/react";
import type { Mock } from "vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("wagmi", () => ({
  useAccount: vi.fn(),
  useReadContracts: vi.fn(),
}));

vi.mock("../use-vault-metrics", () => ({
  useVaultMetrics: vi.fn(),
}));

vi.mock("../use-vault-registry", () => ({
  useVaultRegistry: vi.fn(),
}));

vi.mock("../../lib/contracts", () => ({
  VAULT_ABI: [],
  ERC20_ABI: [],
}));

vi.mock("../../lib/vault-configs", () => ({
  createVaultConfigFromRegistry: vi.fn((vault, chainId) => ({
    address: vault.vault,
    tokenX: {
      symbol: `TKX${vault.vault.slice(-1)}`,
      address: vault.tokenX,
      decimals: 18,
    },
    tokenY: {
      symbol: `TKY${vault.vault.slice(-1)}`,
      address: vault.tokenY,
      decimals: 18,
    },
    name: vault.name,
    platform: "DLMM",
    chain:
      chainId === 31337
        ? "Localhost"
        : chainId === 57054
          ? "Sonic Blaze Testnet"
          : "Sonic",
    isActive: vault.isActive,
  })),
}));

vi.mock("../../config/chains", () => ({
  getChainName: vi.fn((chainId: number) => {
    const names: Record<number, string> = {
      31337: "Localhost",
      57054: "Sonic Blaze Testnet",
      146: "Sonic",
    };
    return names[chainId] || "Unknown";
  }),
}));

// Import after mocks
import { useRealVaults } from "../use-real-vaults";
import { useAccount, useReadContracts } from "wagmi";
import { useVaultMetrics } from "../use-vault-metrics";
import { useVaultRegistry } from "../use-vault-registry";

describe("useRealVaults - TDD Multi-Vault Support", () => {
  // Mock data for multiple vaults
  const mockRegistryVaults = [
    {
      vault: "0xVault1",
      name: "Arca wS-USDC.e Vault",
      symbol: "ARCA-V1",
      tokenX: "0xTokenX1",
      tokenY: "0xTokenY1",
      isActive: true,
    },
    {
      vault: "0xVault2",
      name: "Arca METRO-USDC.e Vault",
      symbol: "ARCA-V2",
      tokenX: "0xTokenX2",
      tokenY: "0xTokenY2",
      isActive: true,
    },
    {
      vault: "0xVault3",
      name: "Arca wS-METRO Vault",
      symbol: "ARCA-V3",
      tokenX: "0xTokenX3",
      tokenY: "0xTokenY3",
      isActive: true,
    },
  ];

  // Mock contract data results for each vault
  const createMockContractData = (vaultIndex: number) => {
    const tokenPairs = [
      ["wS", "USDC.e"],
      ["METRO", "USDC.e"],
      ["wS", "METRO"],
    ];
    const balances = [
      { x: 1000n, y: 2000n },
      { x: 5000n, y: 3000n },
      { x: 2000n, y: 4000n },
    ];

    return [
      { result: balances[vaultIndex].x }, // vaultBalanceX
      { result: balances[vaultIndex].y }, // vaultBalanceY
      { result: 100n }, // userSharesX
      { result: 200n }, // userSharesY
      { result: 1100000000000000000n }, // pricePerShareX
      { result: 1050000000000000000n }, // pricePerShareY
      { result: tokenPairs[vaultIndex][0] }, // tokenXSymbol
      { result: tokenPairs[vaultIndex][1] }, // tokenYSymbol
      { result: 500n }, // userBalanceX
      { result: 1000n }, // userBalanceY
    ];
  };

  const mockMetrics = {
    totalTvlUSD: 50000,
    userTotalUSD: 5000,
    realApr: 45.5,
    dailyApr: 0.125,
    userEarnings: 250,
    userROI: 5.0,
    userTotalDeposited: 4750,
    vaultBalanceXUSD: 20000,
    vaultBalanceYUSD: 30000,
    userSharesXUSD: 2000,
    userSharesYUSD: 3000,
    lastUpdated: new Date(),
    isStale: false,
    priceDataError: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock setup
    (useAccount as Mock).mockReturnValue({ chainId: 31337, address: "0xUser" });
    (useVaultRegistry as Mock).mockReturnValue({
      vaults: mockRegistryVaults,
      isLoading: false,
      error: null,
    });
    (useVaultMetrics as Mock).mockReturnValue({
      metrics: mockMetrics,
      isLoading: false,
      error: null,
    });

    // Mock useReadContracts to return data for all vaults
    const allContractData = mockRegistryVaults.flatMap((_, index) =>
      createMockContractData(index),
    );
    (useReadContracts as Mock).mockReturnValue({
      data: allContractData,
      isLoading: false,
    });
  });

  describe("Multi-Vault Support", () => {
    it("should return all vaults from registry", async () => {
      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert - should have all 3 vaults
      await waitFor(() => {
        expect(result.current.vaults).toHaveLength(3);
        expect(result.current.vaults[0].name).toBe("Arca wS-USDC.e Vault");
        expect(result.current.vaults[1].name).toBe("Arca METRO-USDC.e Vault");
        expect(result.current.vaults[2].name).toBe("Arca wS-METRO Vault");
      });
    });

    it("should support any token pair combination", async () => {
      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert - each vault has different token pairs
      await waitFor(() => {
        expect(result.current.vaults[0].tokens).toEqual(["wS", "USDC.e"]);
        expect(result.current.vaults[1].tokens).toEqual(["METRO", "USDC.e"]);
        expect(result.current.vaults[2].tokens).toEqual(["wS", "METRO"]);
      });
    });

    it("should handle vaults with different metrics independently", async () => {
      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert - each vault has independent data
      await waitFor(() => {
        expect(result.current.vaults[0].vaultBalanceX).toBe("1000");
        expect(result.current.vaults[1].vaultBalanceX).toBe("5000");
        expect(result.current.vaults[2].vaultBalanceX).toBe("2000");
      });
    });

    it("should handle empty vault list gracefully", async () => {
      // Arrange
      (useVaultRegistry as Mock).mockReturnValue({
        vaults: [],
        isLoading: false,
        error: null,
      });

      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert
      expect(result.current.vaults).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Progressive Enhancement", () => {
    it("should show vault data immediately, metrics async", async () => {
      // Arrange - Mock vault data available, metrics loading
      (useVaultMetrics as Mock).mockReturnValue({
        metrics: undefined,
        isLoading: true,
        error: null,
      });

      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert - immediate data available
      expect(result.current.vaults[0].vaultBalanceX).toBeDefined();
      expect(result.current.vaults[0].userSharesX).toBeDefined();
      expect(result.current.vaults[0].pricePerShareX).toBeDefined();

      // Async metrics undefined initially
      expect(result.current.vaults[0].apr).toBeUndefined();
      expect(result.current.vaults[0].totalTvl).toBeUndefined();
      expect(result.current.vaults[0].metricsLoading).toBe(true);
    });

    it("should not block on metrics errors", async () => {
      // Arrange - Mock vault data available, metrics error
      (useVaultMetrics as Mock).mockReturnValue({
        metrics: null,
        isLoading: false,
        error: "Price feed unavailable",
      });

      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert - core data still available
      expect(result.current.vaults).toHaveLength(3);
      expect(result.current.vaults[0].vaultBalanceX).toBeDefined();
      expect(result.current.vaults[0].userSharesX).toBeDefined();

      // Metrics-related fields undefined but not blocking
      expect(result.current.vaults[0].apr).toBeUndefined();
      expect(result.current.vaults[0].totalTvl).toBeUndefined();
      expect(result.current.vaults[0].metricsError).toBe(
        "Price feed unavailable",
      );

      // Overall hook not in error state
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Network Support", () => {
    it("should work on testnet with multiple vaults", async () => {
      // Arrange
      (useAccount as Mock).mockReturnValue({
        chainId: 57054,
        address: "0xUser",
      });

      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert
      await waitFor(() => {
        expect(result.current.vaults).toHaveLength(3);
        expect(result.current.vaults[0].chain).toBe("Sonic Blaze Testnet");
      });
    });

    it("should work on mainnet with multiple vaults", async () => {
      // Arrange
      (useAccount as Mock).mockReturnValue({ chainId: 146, address: "0xUser" });

      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert
      await waitFor(() => {
        expect(result.current.vaults).toHaveLength(3);
        expect(result.current.vaults[0].chain).toBe("Sonic");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle registry errors gracefully", async () => {
      // Arrange
      (useVaultRegistry as Mock).mockReturnValue({
        vaults: [],
        isLoading: false,
        error: "Failed to connect to registry",
      });

      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert
      expect(result.current.error).toBe(
        "Registry error: Failed to connect to registry",
      );
      expect(result.current.vaults).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle vault contract errors for individual vaults", async () => {
      // Arrange - Mock one vault with missing data
      const customContractData = [
        ...createMockContractData(0), // Vault 1 - complete data
        // Vault 2 - missing token symbols
        { result: 5000n }, // vaultBalanceX
        { result: 3000n }, // vaultBalanceY
        { result: 100n }, // userSharesX
        { result: 200n }, // userSharesY
        { result: 1100000000000000000n }, // pricePerShareX
        { result: 1050000000000000000n }, // pricePerShareY
        { result: undefined }, // tokenXSymbol - missing!
        { result: undefined }, // tokenYSymbol - missing!
        { result: 500n }, // userBalanceX
        { result: 1000n }, // userBalanceY
        ...createMockContractData(2), // Vault 3 - complete data
      ];

      (useReadContracts as Mock).mockReturnValue({
        data: customContractData,
        isLoading: false,
      });

      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert - should still show other vaults
      await waitFor(() => {
        expect(result.current.vaults).toHaveLength(2); // Only 2 of 3 vaults work
        expect(result.current.vaults[0].name).toBe("Arca wS-USDC.e Vault");
        expect(result.current.vaults[1].name).toBe("Arca wS-METRO Vault");
        // Vault2 is skipped due to error
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading while discovering vaults", async () => {
      // Arrange
      (useVaultRegistry as Mock).mockReturnValue({
        vaults: [],
        isLoading: true,
        error: null,
      });

      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert
      expect(result.current.isLoading).toBe(true);
      expect(result.current.vaults).toEqual([]);
    });

    it("should not show loading for metrics updates", async () => {
      // Arrange - Vaults loaded, metrics loading
      (useVaultMetrics as Mock).mockReturnValue({
        metrics: undefined,
        isLoading: true,
        error: null,
      });

      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert - not loading overall, just metrics
      expect(result.current.isLoading).toBe(false);
      expect(result.current.vaults[0].metricsLoading).toBe(true);
    });
  });

  describe("Dynamic Descriptions", () => {
    it("should generate appropriate descriptions for different vault types", async () => {
      // Act
      const { result } = renderHook(() => useRealVaults());

      // Assert - each vault should have appropriate description
      await waitFor(() => {
        expect(result.current.vaults[0].description).toContain("wS/USDC.e");
        expect(result.current.vaults[1].description).toContain("METRO/USDC.e");
        expect(result.current.vaults[2].description).toContain("wS/METRO");

        // All should mention Metropolis DLMM and Metro compounding
        result.current.vaults.forEach((vault) => {
          expect(vault.description).toContain("Metropolis DLMM");
          expect(vault.description).toContain("Metro reward compounding");
        });
      });
    });
  });
});
