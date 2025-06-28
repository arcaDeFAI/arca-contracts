/**
 * 🎯 TDD: Dashboard Data Hook Tests
 *
 * These tests define the behavior of the useDashboardData hook that aggregates
 * data across all vaults for the dashboard view. Following TDD: Tests define
 * requirements first, implementation follows.
 *
 * Requirements:
 * - Calculate total portfolio value across all vaults
 * - Sum historical deposits from transaction history
 * - Calculate earnings (current value - deposits)
 * - Calculate ROI percentage
 * - Handle edge cases gracefully
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDashboardData } from "../use-dashboard-data";
import { TestProviders } from "../../test-utils/test-providers";
import type { VaultConfig } from "../../lib/vault-configs";
import { SUPPORTED_CHAINS } from "../../config/chains";

// Mock dependencies
const mockGetVaultConfig = vi.fn();
const mockUseVault = vi.fn();
const mockUseVaultMetrics = vi.fn();
const mockUseTransactionHistory = vi.fn();
const mockUsePositionDetection = vi.fn();

vi.mock("../../lib/vault-configs", () => ({
  getVaultConfig: (address: string) => mockGetVaultConfig(address),
}));

vi.mock("../use-vault", () => ({
  useVault: (vaultAddress: string) => mockUseVault(vaultAddress),
}));

vi.mock("../use-vault-metrics", () => ({
  useVaultMetrics: (vaultAddress: string) => mockUseVaultMetrics(vaultAddress),
}));

vi.mock("../use-transaction-history", () => ({
  useTransactionHistory: () => mockUseTransactionHistory(),
}));

vi.mock("../use-position-detection", () => ({
  usePositionDetection: () => mockUsePositionDetection(),
}));

// Mock wagmi useAccount to return a test chainId from centralized config
vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useAccount: () => ({
      chainId: SUPPORTED_CHAINS.sonicFork.id, // Test environment: Sonic Fork
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      isConnected: true,
    }),
  };
});

describe("🎯 TDD: useDashboardData Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Portfolio Value Calculations", () => {
    it("should calculate total portfolio value across all vaults", () => {
      // Setup: Two vaults with different positions
      const vault1Config: VaultConfig = {
        address: "0xVault1",
        tokenX: { symbol: "wS", address: "0xTokenX1", decimals: 18 },
        tokenY: { symbol: "USDC.e", address: "0xTokenY1", decimals: 6 },
        name: "wS-USDC.e",
        platform: "DLMM",
        chain: "Sonic Fork",
        isActive: true,
      };

      const vault2Config: VaultConfig = {
        address: "0xVault2",
        tokenX: { symbol: "METRO", address: "0xTokenX2", decimals: 18 },
        tokenY: { symbol: "USDC", address: "0xTokenY2", decimals: 6 },
        name: "METRO-USDC",
        platform: "DLMM",
        chain: "Sonic Fork",
        isActive: true,
      };

      // Mock position detection - user has positions in both vaults
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: ["0xVault1", "0xVault2"],
        isDetecting: false,
        error: null,
      });

      // Set up vault configs
      mockGetVaultConfig.mockImplementation((address: string) => {
        if (address === "0xVault1") return vault1Config;
        if (address === "0xVault2") return vault2Config;
        return undefined;
      });

      // Reset mocks to ensure clean state
      mockUseVault.mockReset();
      mockUseVaultMetrics.mockReset();

      // Vault 1 data: User has 10 wS shares + 20 USDC.e shares
      mockUseVault.mockImplementation((address: string) => {
        if (address === "0xVault1") {
          return {
            userSharesX: "10.0",
            userSharesY: "20.0",
            pricePerShareX: "1.1", // 1.1 wS per share
            pricePerShareY: "1.05", // 1.05 USDC.e per share
            tokenXSymbol: "wS",
            tokenYSymbol: "USDC.e",
          };
        }
        if (address === "0xVault2") {
          return {
            userSharesX: "5.0",
            userSharesY: "15.0",
            pricePerShareX: "2.0", // 2 METRO per share
            pricePerShareY: "1.02", // 1.02 USDC per share
            tokenXSymbol: "METRO",
            tokenYSymbol: "USDC",
          };
        }
        // Return empty data for undefined addresses
        return {
          userSharesX: "0.0",
          userSharesY: "0.0",
          pricePerShareX: "0.0",
          pricePerShareY: "0.0",
          tokenXSymbol: "",
          tokenYSymbol: "",
        };
      });

      // Vault metrics with progressive enhancement structure
      mockUseVaultMetrics.mockImplementation((address: string | undefined) => {
        if (address === "0xVault1") {
          // Vault 1: (10 * 1.1 * 0.85) + (20 * 1.05 * 1.0) = 9.35 + 21 = 30.35
          return {
            metrics: {
              userSharesXUSD: 9.35, // 10 shares * 1.1 pricePerShare * $0.85
              userSharesYUSD: 21.0, // 20 shares * 1.05 pricePerShare * $1.00
              estimatedApr: 45.2,
              isDataAvailable: true,
              priceDataLoading: false,
              priceDataError: null,
            },
            isLoading: false,
            error: null,
          };
        }
        if (address === "0xVault2") {
          // Vault 2: (5 * 2.0 * 12.5) + (15 * 1.02 * 1.0) = 125 + 15.3 = 140.3
          return {
            metrics: {
              userSharesXUSD: 125.0, // 5 shares * 2.0 pricePerShare * $12.50
              userSharesYUSD: 15.3, // 15 shares * 1.02 pricePerShare * $1.00
              estimatedApr: 35.8,
              isDataAvailable: true,
              priceDataLoading: false,
              priceDataError: null,
            },
            isLoading: false,
            error: null,
          };
        }
        // Return empty data for undefined addresses
        return {
          metrics: null,
          isLoading: false,
          error: null,
        };
      });

      // Mock transaction history (required by the hook)
      mockUseTransactionHistory.mockReturnValue({
        transactions: [], // Empty for this test
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      // Calculate expected total:
      // Vault 1: (10 * 1.1 * 0.85) + (20 * 1.05 * 1.0) = 9.35 + 21 = 30.35
      // Vault 2: (5 * 2.0 * 12.5) + (15 * 1.02 * 1.0) = 125 + 15.3 = 140.3
      // Total: 30.35 + 140.3 = 170.65

      // Debug what we're actually getting
      console.log("Debug dashboard result:", {
        totalPortfolioValue: result.current.totalPortfolioValue,
        vaultPositionsLength: result.current.vaultPositions.length,
        vaultPositions: result.current.vaultPositions,
        isLoading: result.current.isLoading,
        error: result.current.error,
      });

      expect(result.current.totalPortfolioValue).toBeCloseTo(170.65, 2);
      expect(result.current.vaultPositions).toHaveLength(2);
    });

    it("should handle vaults with zero positions", () => {
      const vaultConfig: VaultConfig = {
        address: "0xVault1",
        tokenX: { symbol: "wS", address: "0xTokenX1", decimals: 18 },
        tokenY: { symbol: "USDC.e", address: "0xTokenY1", decimals: 6 },
        name: "wS-USDC.e",
        platform: "DLMM",
        chain: "Sonic Fork",
        isActive: true,
      };

      // Mock position detection - user has no positions (empty array)
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: [],
        isDetecting: false,
        error: null,
      });

      // Mock vault config (though it won't be called since no positions)
      mockGetVaultConfig.mockReturnValue(vaultConfig);

      // User has no shares in this vault
      mockUseVault.mockReturnValue({
        userSharesX: "0.0",
        userSharesY: "0.0",
        pricePerShareX: "1.0",
        pricePerShareY: "1.0",
      });

      mockUseVaultMetrics.mockReturnValue({
        tokenPrices: {
          tokenX: 0.85,
          tokenY: 1.0,
        },
      });

      // Mock transaction history (required by the hook)
      mockUseTransactionHistory.mockReturnValue({
        transactions: [],
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      expect(result.current.totalPortfolioValue).toBe(0);
      expect(result.current.vaultPositions).toHaveLength(0);
    });

    it("should handle missing price data gracefully", () => {
      const vaultConfig: VaultConfig = {
        address: "0xVault1",
        tokenX: { symbol: "wS", address: "0xTokenX1", decimals: 18 },
        tokenY: { symbol: "USDC.e", address: "0xTokenY1", decimals: 6 },
        name: "wS-USDC.e",
        platform: "DLMM",
        chain: "Sonic Fork",
        isActive: true,
      };

      // Mock position detection - user has position in one vault
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: ["0xVault1"],
        isDetecting: false,
        error: null,
      });

      mockGetVaultConfig.mockReturnValue(vaultConfig);

      mockUseVault.mockReturnValue({
        userSharesX: "10.0",
        userSharesY: "20.0",
        pricePerShareX: "1.1",
        pricePerShareY: "1.05",
      });

      // No price data available
      mockUseVaultMetrics.mockReturnValue({
        tokenPrices: null,
      });

      // Mock transaction history (required by the hook)
      mockUseTransactionHistory.mockReturnValue({
        transactions: [],
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      // Should default to 0 when prices unavailable
      expect(result.current.totalPortfolioValue).toBe(0);
      expect(result.current.vaultPositions[0].value).toBe(0);
    });
  });

  describe("Historical Deposits Tracking", () => {
    it("should calculate total deposits from transaction history", () => {
      // Mock position detection - no positions (testing just transaction history)
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: [],
        isDetecting: false,
        error: null,
      });

      // Transaction history with deposits
      mockUseTransactionHistory.mockReturnValue({
        transactions: [
          {
            id: "1",
            hash: "0x1",
            type: "deposit",
            token: "wS",
            amount: "100.0",
            usdValue: 85.0, // 100 wS * $0.85
            status: "success",
            timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
            userAddress: "0xUser",
            chainId: 31337,
          },
          {
            id: "2",
            hash: "0x2",
            type: "deposit",
            token: "USDC.e",
            amount: "200.0",
            usdValue: 200.0, // 200 USDC.e * $1.00
            status: "success",
            timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
            userAddress: "0xUser",
            chainId: 31337,
          },
          {
            id: "3",
            hash: "0x3",
            type: "withdraw", // Should not count withdrawals
            token: "wS",
            amount: "50.0",
            usdValue: 42.5,
            status: "success",
            timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
            userAddress: "0xUser",
            chainId: 31337,
          },
        ],
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      // Total deposits: $85 + $200 = $285
      expect(result.current.totalDeposited).toBe(285.0);
    });

    it("should handle no transaction history", () => {
      // Mock position detection - no positions
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: [],
        isDetecting: false,
        error: null,
      });

      mockUseTransactionHistory.mockReturnValue({
        transactions: [],
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      expect(result.current.totalDeposited).toBe(0);
    });
  });

  describe("Earnings and ROI Calculations", () => {
    it("should calculate earnings as current value minus deposits", () => {
      const vaultConfig: VaultConfig = {
        address: "0xVault1",
        tokenX: { symbol: "wS", address: "0xTokenX1", decimals: 18 },
        tokenY: { symbol: "USDC.e", address: "0xTokenY1", decimals: 6 },
        name: "wS-USDC.e",
        isActive: true,
      };

      // Mock position detection - user has position in one vault
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: ["0xVault1"],
        isDetecting: false,
        error: null,
      });

      mockGetVaultConfig.mockReturnValue(vaultConfig);

      // Current value: $150
      mockUseVault.mockReturnValue({
        userSharesX: "100.0",
        userSharesY: "50.0",
        pricePerShareX: "1.0",
        pricePerShareY: "1.0",
        tokenXSymbol: "wS",
        tokenYSymbol: "USDC.e",
      });

      mockUseVaultMetrics.mockReturnValue({
        metrics: {
          userSharesXUSD: 100.0, // 100 shares * 1.0 pricePerShare * $1.0
          userSharesYUSD: 50.0, // 50 shares * 1.0 pricePerShare * $1.0
          estimatedApr: 45.2,
          isDataAvailable: true,
          priceDataLoading: false,
          priceDataError: null,
        },
        isLoading: false,
        error: null,
      });

      // Historical deposits: $120
      mockUseTransactionHistory.mockReturnValue({
        transactions: [
          {
            id: "1",
            hash: "0x1",
            type: "deposit",
            token: "wS",
            amount: "80.0",
            usdValue: 80.0,
            status: "success",
            timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
            userAddress: "0xUser",
            chainId: 31337,
          },
          {
            id: "2",
            hash: "0x2",
            type: "deposit",
            token: "USDC.e",
            amount: "40.0",
            usdValue: 40.0,
            status: "success",
            timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
            userAddress: "0xUser",
            chainId: 31337,
          },
        ],
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      // Earnings: $150 - $120 = $30
      expect(result.current.totalEarnings).toBe(30.0);

      // ROI: ($30 / $120) * 100 = 25%
      expect(result.current.totalROI).toBe(25.0);
    });

    it("should handle zero deposits (avoid division by zero)", () => {
      const vaultConfig: VaultConfig = {
        address: "0xVault1",
        tokenX: { symbol: "wS", address: "0xTokenX1", decimals: 18 },
        tokenY: { symbol: "USDC.e", address: "0xTokenY1", decimals: 6 },
        name: "wS-USDC.e",
        isActive: true,
      };

      // Mock position detection - user has position in one vault
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: ["0xVault1"],
        isDetecting: false,
        error: null,
      });

      mockGetVaultConfig.mockReturnValue(vaultConfig);

      // Current value: $100 (somehow user has value without deposits)
      mockUseVault.mockReturnValue({
        userSharesX: "100.0",
        userSharesY: "0.0",
        pricePerShareX: "1.0",
        pricePerShareY: "1.0",
        tokenXSymbol: "wS",
        tokenYSymbol: "USDC.e",
      });

      mockUseVaultMetrics.mockReturnValue({
        metrics: {
          userSharesXUSD: 100.0, // 100 shares * 1.0 pricePerShare * $1.0
          userSharesYUSD: 0.0, // 0 shares
          estimatedApr: 45.2,
          isDataAvailable: true,
          priceDataLoading: false,
          priceDataError: null,
        },
        isLoading: false,
        error: null,
      });

      // No transaction history
      mockUseTransactionHistory.mockReturnValue({
        transactions: [],
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      expect(result.current.totalEarnings).toBe(100.0);
      expect(result.current.totalROI).toBe(0); // Should be 0 when no deposits
    });

    it("should handle negative earnings (losses)", () => {
      const vaultConfig: VaultConfig = {
        address: "0xVault1",
        tokenX: { symbol: "wS", address: "0xTokenX1", decimals: 18 },
        tokenY: { symbol: "USDC.e", address: "0xTokenY1", decimals: 6 },
        name: "wS-USDC.e",
        isActive: true,
      };

      // Mock position detection - user has position in one vault
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: ["0xVault1"],
        isDetecting: false,
        error: null,
      });

      mockGetVaultConfig.mockReturnValue(vaultConfig);

      // Current value: $80
      mockUseVault.mockReturnValue({
        userSharesX: "80.0",
        userSharesY: "0.0",
        pricePerShareX: "1.0",
        pricePerShareY: "1.0",
        tokenXSymbol: "wS",
        tokenYSymbol: "USDC.e",
      });

      mockUseVaultMetrics.mockReturnValue({
        metrics: {
          userSharesXUSD: 80.0, // 80 shares * 1.0 pricePerShare * $1.0
          userSharesYUSD: 0.0, // 0 shares
          estimatedApr: 45.2,
          isDataAvailable: true,
          priceDataLoading: false,
          priceDataError: null,
        },
        isLoading: false,
        error: null,
      });

      // Historical deposits: $100
      mockUseTransactionHistory.mockReturnValue({
        transactions: [
          {
            id: "1",
            hash: "0x1",
            type: "deposit",
            token: "wS",
            amount: "100.0",
            usdValue: 100.0,
            status: "success",
            timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
            userAddress: "0xUser",
            chainId: 31337,
          },
        ],
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      // Earnings: $80 - $100 = -$20
      expect(result.current.totalEarnings).toBe(-20.0);

      // ROI: (-$20 / $100) * 100 = -20%
      expect(result.current.totalROI).toBe(-20.0);
    });
  });

  describe("Individual Vault Position Data", () => {
    it("should provide detailed data for each vault position", () => {
      const vaultConfig: VaultConfig = {
        address: "0xVault1",
        tokenX: { symbol: "wS", address: "0xTokenX1", decimals: 18 },
        tokenY: { symbol: "USDC.e", address: "0xTokenY1", decimals: 6 },
        name: "wS-USDC.e",
        isActive: true,
      };

      // Mock position detection - user has position in one vault
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: ["0xVault1"],
        isDetecting: false,
        error: null,
      });

      mockGetVaultConfig.mockReturnValue(vaultConfig);

      mockUseVault.mockReturnValue({
        userSharesX: "10.0",
        userSharesY: "20.0",
        pricePerShareX: "1.1",
        pricePerShareY: "1.05",
        tokenXSymbol: "wS",
        tokenYSymbol: "USDC.e",
      });

      mockUseVaultMetrics.mockReturnValue({
        metrics: {
          userSharesXUSD: 9.35, // 10 shares * 1.1 pricePerShare * $0.85
          userSharesYUSD: 21.0, // 20 shares * 1.05 pricePerShare * $1.00
          estimatedApr: 45.2,
          isDataAvailable: true,
          priceDataLoading: false,
          priceDataError: null,
        },
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      const position = result.current.vaultPositions[0];

      expect(position).toEqual({
        vaultAddress: "0xVault1",
        vaultName: "wS-USDC.e",
        tokenX: {
          symbol: "wS",
          shares: "10.0",
          value: 9.35, // 10 * 1.1 * 0.85
        },
        tokenY: {
          symbol: "USDC.e",
          shares: "20.0",
          value: 21.0, // 20 * 1.05 * 1.0
        },
        value: 30.35, // 9.35 + 21.0
        apy: 45.2,
      });
    });
  });

  describe("Loading and Error States", () => {
    it("should indicate loading state when data is being fetched", () => {
      // Mock position detection - no positions
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: [],
        isDetecting: false,
        error: null,
      });

      mockUseTransactionHistory.mockReturnValue({
        transactions: undefined, // Still loading
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle errors gracefully", () => {
      // Mock position detection error
      mockUsePositionDetection.mockReturnValue({
        vaultAddressesWithPositions: [],
        isDetecting: false,
        error: "Failed to detect positions",
      });

      // Mock transaction history (required by the hook)
      mockUseTransactionHistory.mockReturnValue({
        transactions: [],
      });

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestProviders,
      });

      expect(result.current.error).toBe("Failed to detect positions");
      expect(result.current.totalPortfolioValue).toBe(0);
    });
  });
});

/**
 * Test Summary - Dashboard Data Hook Coverage:
 *
 * ✅ Portfolio Value Calculations (3 tests)
 *    - Total value across multiple vaults
 *    - Zero positions handling
 *    - Missing price data handling
 *
 * ✅ Historical Deposits Tracking (2 tests)
 *    - Sum deposits from transaction history
 *    - Empty history handling
 *
 * ✅ Earnings and ROI Calculations (3 tests)
 *    - Earnings calculation (value - deposits)
 *    - ROI percentage calculation
 *    - Edge cases (zero deposits, losses)
 *
 * ✅ Individual Vault Position Data (1 test)
 *    - Detailed position breakdown per vault
 *
 * ✅ Loading and Error States (2 tests)
 *    - Loading state indication
 *    - Error handling
 *
 * Total: 11 comprehensive tests defining dashboard data requirements
 */
