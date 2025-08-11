/**
 * TDD Tests for Progressive Enhancement in useVaultMetrics Hook
 *
 * These tests define how useVaultMetrics should behave with progressive enhancement:
 * - Return partial vault data immediately when price fetching fails
 * - Show loading indicators for USD values, but not block vault display
 * - Implement graceful degradation for better UX
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useVaultMetrics, type VaultMetrics } from "../use-vault-metrics";

// Mock the dependencies
const mockUseVault = vi.fn();
const mockUseHybridTokenPrices = vi.fn();
const mockUseTransactionHistory = vi.fn();
const mockUseVaultTransactionHistory = vi.fn();

vi.mock("../use-vault", () => ({
  useVault: () => mockUseVault(),
}));

vi.mock("../use-hybrid-token-prices", () => ({
  useHybridTokenPrices: () => mockUseHybridTokenPrices(),
}));

vi.mock("../use-token-prices", () => ({
  useTokenPrices: () => mockUseHybridTokenPrices(),
  getTokenUSDValue: (
    amount: string,
    tokenSymbol: string,
    prices: Record<string, number>,
  ) => {
    const price = prices[tokenSymbol.toLowerCase()] || 0;
    return parseFloat(amount) * price;
  },
}));

vi.mock("../use-transaction-history", () => ({
  useTransactionHistory: () => mockUseTransactionHistory(),
}));

vi.mock("../use-vault-transaction-history", () => ({
  useVaultTransactionHistory: () => mockUseVaultTransactionHistory(),
}));

describe("🎯 TDD: Progressive Enhancement for useVaultMetrics", () => {
  const baseVaultData = {
    vaultBalanceX: "1000.0",
    vaultBalanceY: "2000.0",
    userSharesX: "50.0",
    userSharesY: "100.0",
    userBalanceX: "200.0",
    userBalanceY: "500.0",
    pricePerShareX: "1.1",
    pricePerShareY: "1.05",
    tokenXSymbol: "wS",
    tokenYSymbol: "USDC.e",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVault.mockReturnValue(baseVaultData);
    mockUseTransactionHistory.mockReturnValue({
      getTransactionSummary: vi.fn().mockReturnValue({
        totalDeposited: 400,
      }),
    });
    mockUseVaultTransactionHistory.mockReturnValue({
      calculateTimeWindowDays: vi.fn().mockReturnValue(7), // 7 days window for testing
    });
  });

  describe("🎯 TDD: Partial Data Return When Prices Loading", () => {
    it("should return partial metrics when prices are loading (progressive enhancement)", () => {
      // BUSINESS REQUIREMENT: Show vault data immediately, load prices progressively
      mockUseHybridTokenPrices.mockReturnValue({
        prices: {},
        isLoading: true,
        error: null,
        refresh: vi.fn(),
        isUsingRealPrices: false,
      });

      const { result } = renderHook(() => useVaultMetrics());

      // Should NOT be loading (vault discovery shouldn't wait for prices)
      expect(result.current.isLoading).toBe(false);

      // Should return partial metrics object (not null)
      expect(result.current.metrics).toBeDefined();
      expect(result.current.metrics).not.toBeNull();

      const metrics = result.current.metrics as VaultMetrics;

      // Non-price-dependent data should be available
      expect(metrics.isDataAvailable).toBe(true);
      expect(metrics.priceDataLoading).toBe(true);
      expect(metrics.priceDataError).toBeNull();

      // USD values should be undefined/null (not yet calculated)
      expect(metrics.totalTvlUSD).toBeUndefined();
      expect(metrics.userTotalUSD).toBeUndefined();
      expect(metrics.vaultBalanceXUSD).toBeUndefined();
      expect(metrics.vaultBalanceYUSD).toBeUndefined();
      expect(metrics.userSharesXUSD).toBeUndefined();
      expect(metrics.userSharesYUSD).toBeUndefined();
      expect(metrics.userBalanceXUSD).toBeUndefined();
      expect(metrics.userBalanceYUSD).toBeUndefined();

      // APR should be undefined (price-dependent)
      expect(metrics.realApr).toBeUndefined();
      expect(metrics.dailyApr).toBeUndefined();

      // ROI calculations should be undefined (price-dependent)
      expect(metrics.userEarnings).toBeUndefined();
      expect(metrics.userROI).toBeUndefined();
    });

    it("should return partial metrics when price fetching fails (graceful degradation)", () => {
      // BUSINESS REQUIREMENT: Don't block vault display on price API failures
      mockUseHybridTokenPrices.mockReturnValue({
        prices: {},
        isLoading: false,
        error: "CoinGecko API rate limited",
        refresh: vi.fn(),
        isUsingRealPrices: false,
      });

      const { result } = renderHook(() => useVaultMetrics());

      // Should NOT be loading or errored (vault discovery succeeds)
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull(); // No overall error

      // Should return partial metrics object (not null)
      expect(result.current.metrics).toBeDefined();
      expect(result.current.metrics).not.toBeNull();

      const metrics = result.current.metrics as VaultMetrics;

      // Should indicate price data error
      expect(metrics.isDataAvailable).toBe(true);
      expect(metrics.priceDataLoading).toBe(false);
      expect(metrics.priceDataError).toBe("CoinGecko API rate limited");

      // USD values should be undefined (price fetch failed)
      expect(metrics.totalTvlUSD).toBeUndefined();
      expect(metrics.userTotalUSD).toBeUndefined();
      expect(metrics.realApr).toBeUndefined();
    });

    it("should update metrics when prices become available (progressive loading)", () => {
      // Start with loading prices
      const pricesHook = mockUseHybridTokenPrices;
      pricesHook.mockReturnValue({
        prices: {},
        isLoading: true,
        error: null,
        refresh: vi.fn(),
        isUsingRealPrices: false,
      });

      const { result, rerender } = renderHook(() => useVaultMetrics());

      // Initial state - partial data
      expect(result.current.metrics?.priceDataLoading).toBe(true);
      expect(result.current.metrics?.totalTvlUSD).toBeUndefined();

      // Update to successful price fetch
      pricesHook.mockReturnValue({
        prices: {
          ws: 0.85,
          "usdc.e": 1.0,
        },
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        isUsingRealPrices: false,
      });

      rerender();

      // Should now have complete data
      expect(result.current.metrics?.priceDataLoading).toBe(false);
      expect(result.current.metrics?.priceDataError).toBeNull();
      expect(result.current.metrics?.totalTvlUSD).toBeDefined();
      expect(result.current.metrics?.totalTvlUSD).toBe(2850); // 1000*0.85 + 2000*1.0
    });
  });

  describe("🎯 TDD: Environment Variable Override", () => {
    it("should use mock prices when VITE_PRICE_ORACLE_OVERRIDE=mock", () => {
      // Mock environment variable
      const originalEnv = import.meta.env.VITE_PRICE_ORACLE_OVERRIDE;
      import.meta.env.VITE_PRICE_ORACLE_OVERRIDE = "mock";

      mockUseHybridTokenPrices.mockReturnValue({
        prices: {
          ws: 1.0, // Mock price
          "usdc.e": 1.0, // Mock price
        },
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        isUsingRealPrices: false,
      });

      const { result } = renderHook(() => useVaultMetrics());

      expect(result.current.metrics).toBeDefined();
      const metrics = result.current.metrics as VaultMetrics;

      // Should have immediate data with mock prices
      expect(metrics.priceDataLoading).toBe(false);
      expect(metrics.totalTvlUSD).toBe(3000); // 1000*1.0 + 2000*1.0 with mock prices
      expect(metrics.isRealData).toBe(false);

      // Restore environment
      import.meta.env.VITE_PRICE_ORACLE_OVERRIDE = originalEnv;
    });

    it("should attempt real prices when VITE_PRICE_ORACLE_OVERRIDE=coingecko", () => {
      // Mock environment variable
      const originalEnv = import.meta.env.VITE_PRICE_ORACLE_OVERRIDE;
      import.meta.env.VITE_PRICE_ORACLE_OVERRIDE = "coingecko";

      mockUseHybridTokenPrices.mockReturnValue({
        prices: {
          ws: 0.85, // Real price from API
          "usdc.e": 1.0, // Real price from API
        },
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        isUsingRealPrices: true,
      });

      const { result } = renderHook(() => useVaultMetrics());

      expect(result.current.metrics).toBeDefined();
      const metrics = result.current.metrics as VaultMetrics;

      // Should have real price data
      expect(metrics.totalTvlUSD).toBe(2850); // 1000*0.85 + 2000*1.0 with real prices
      expect(metrics.isRealData).toBe(true);

      // Restore environment
      import.meta.env.VITE_PRICE_ORACLE_OVERRIDE = originalEnv;
    });
  });

  describe("🎯 TDD: Backward Compatibility", () => {
    it("should maintain full functionality when prices are available (no regression)", () => {
      // BUSINESS REQUIREMENT: Complete behavior should remain the same
      mockUseHybridTokenPrices.mockReturnValue({
        prices: {
          ws: 0.85,
          "usdc.e": 1.0,
        },
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        isUsingRealPrices: false,
      });

      const { result } = renderHook(() => useVaultMetrics());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.metrics).toBeDefined();

      const metrics = result.current.metrics as VaultMetrics;

      // All data should be available as before
      expect(metrics.totalTvlUSD).toBe(2850);
      expect(metrics.userTotalUSD).toBeCloseTo(151.75, 1); // (50*1.1*0.85) + (100*1.05*1.0) = 46.75 + 105 = 151.75
      expect(metrics.realApr).toBeUndefined(); // No real APR without reward data
      expect(metrics.priceDataLoading).toBe(false);
      expect(metrics.priceDataError).toBeNull();
      expect(metrics.isDataAvailable).toBe(true);
    });
  });
});

/**
 * TDD Test Summary for Progressive Enhancement:
 *
 * These tests define the new business requirements:
 *
 * 1. ✅ Partial Data Return: useVaultMetrics returns partial object when prices loading/failed
 * 2. ✅ Loading Indicators: priceDataLoading and priceDataError fields for UI feedback
 * 3. ✅ Graceful Degradation: Vault display not blocked by price API failures
 * 4. ✅ Progressive Loading: Metrics update when prices become available
 * 5. ✅ Environment Override: VITE_PRICE_ORACLE_OVERRIDE for development control
 * 6. ✅ Backward Compatibility: Full functionality preserved when prices available
 *
 * Current implementation will FAIL these tests (returns null when prices unavailable).
 * Next: Implement progressive enhancement to make tests pass.
 */
