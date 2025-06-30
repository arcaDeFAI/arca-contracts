/**
 * Real Token Prices Hook Tests
 *
 * Tests for the React hook that fetches real token prices.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useRealTokenPrices,
  useRealTokenPrice,
} from "../use-real-token-prices";

// Mock the price feed service
vi.mock("../../services/price-feed", () => ({
  priceFeedService: {
    getMultipleTokenPrices: vi.fn(),
    getTokenPrice: vi.fn(),
    clearCache: vi.fn(),
  },
}));

import { priceFeedService } from "../../services/price-feed";
const mockPriceFeedService = vi.mocked(priceFeedService);

describe("useRealTokenPrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch token prices on mount", async () => {
    const mockPrices = {
      ws: {
        symbol: "ws",
        price: 0.95,
        lastUpdated: Date.now(),
        source: "coingecko" as const,
      },
      "usdc.e": {
        symbol: "usdc.e",
        price: 1.0,
        lastUpdated: Date.now(),
        source: "coingecko" as const,
      },
    };

    mockPriceFeedService.getMultipleTokenPrices.mockResolvedValue(mockPrices);

    const { result } = renderHook(() => useRealTokenPrices());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.prices).toEqual({});

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.prices).toEqual({
      ws: 0.95,
      "usdc.e": 1.0,
    });
    expect(result.current.priceDetails).toEqual(mockPrices);
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdated).toBeTruthy();
  });

  it("should handle API errors gracefully", async () => {
    const errorMessage = "Network error";
    mockPriceFeedService.getMultipleTokenPrices.mockRejectedValue(
      new Error(errorMessage),
    );

    const { result } = renderHook(() => useRealTokenPrices());

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.prices).toEqual({});
  });

  it("should support custom token list", async () => {
    const customTokens = ["metro", "usdc"];
    const mockPrices = {
      metro: {
        symbol: "metro",
        price: 2.5,
        lastUpdated: Date.now(),
        source: "coingecko" as const,
      },
    };

    mockPriceFeedService.getMultipleTokenPrices.mockResolvedValue(mockPrices);

    const { result } = renderHook(() =>
      useRealTokenPrices({ tokens: customTokens }),
    );

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockPriceFeedService.getMultipleTokenPrices).toHaveBeenCalledWith(
      customTokens,
    );
    expect(result.current.prices).toEqual({ metro: 2.5 });
  });

  it("should refresh prices at specified interval", async () => {
    vi.useFakeTimers();

    const mockPrices = {
      ws: {
        symbol: "ws",
        price: 0.95,
        lastUpdated: Date.now(),
        source: "coingecko" as const,
      },
    };

    mockPriceFeedService.getMultipleTokenPrices.mockResolvedValue(mockPrices);

    const { result, unmount } = renderHook(() =>
      useRealTokenPrices({ refreshInterval: 1000 }),
    );

    // Initial fetch
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCallCount =
      mockPriceFeedService.getMultipleTokenPrices.mock.calls.length;

    // Fast-forward time to trigger refresh
    await act(async () => {
      vi.advanceTimersByTime(1000);
      // Wait a tick for the effect to run
      await Promise.resolve();
    });

    expect(
      mockPriceFeedService.getMultipleTokenPrices.mock.calls.length,
    ).toBeGreaterThan(initialCallCount);

    unmount();
    vi.useRealTimers();
  });

  it("should support manual refresh", async () => {
    const mockPrices = {
      ws: {
        symbol: "ws",
        price: 0.95,
        lastUpdated: Date.now(),
        source: "coingecko" as const,
      },
    };

    mockPriceFeedService.getMultipleTokenPrices.mockResolvedValue(mockPrices);

    const { result } = renderHook(() => useRealTokenPrices());

    // Initial fetch
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockPriceFeedService.getMultipleTokenPrices).toHaveBeenCalledTimes(
      1,
    );

    // Manual refresh
    await act(async () => {
      await result.current.refresh();
    });

    expect(mockPriceFeedService.clearCache).toHaveBeenCalled();
    expect(mockPriceFeedService.getMultipleTokenPrices).toHaveBeenCalledTimes(
      2,
    );
  });

  it("should not fetch when disabled", async () => {
    const { result } = renderHook(() => useRealTokenPrices({ enabled: false }));

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockPriceFeedService.getMultipleTokenPrices).not.toHaveBeenCalled();
    expect(result.current.prices).toEqual({});
  });

  it("should detect stale prices", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = Date.now();
    vi.setSystemTime(now);

    const mockPrices = {
      ws: {
        symbol: "ws",
        price: 0.95,
        lastUpdated: now,
        source: "coingecko" as const,
      },
    };

    mockPriceFeedService.getMultipleTokenPrices.mockResolvedValue(mockPrices);

    const { result, rerender } = renderHook(() =>
      useRealTokenPrices({ refreshInterval: 1000 }),
    );

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isStale).toBe(false);

    // Fast-forward time to make prices stale
    act(() => {
      vi.advanceTimersByTime(2000);
      vi.setSystemTime(now + 2000);
    });

    // Force re-render to update isStale calculation
    rerender();

    expect(result.current.isStale).toBe(true);

    vi.useRealTimers();
  });
});

it("should work with useRealTokenPrice wrapper for single token", async () => {
  const mockPrices = {
    ws: {
      symbol: "ws",
      price: 0.95,
      lastUpdated: Date.now(),
      source: "coingecko" as const,
    },
  };

  mockPriceFeedService.getMultipleTokenPrices.mockResolvedValue(mockPrices);

  const { result } = renderHook(() =>
    useRealTokenPrice("ws", { refreshInterval: 0 }),
  );

  await vi.waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.price).toBe(0.95);
  expect(result.current.priceDetail).toEqual(mockPrices.ws);
  expect(mockPriceFeedService.getMultipleTokenPrices).toHaveBeenCalledWith([
    "ws",
  ]);
});

it("should return null for unknown token with useRealTokenPrice", async () => {
  mockPriceFeedService.getMultipleTokenPrices.mockResolvedValue({});

  const { result } = renderHook(() =>
    useRealTokenPrice("unknown", { refreshInterval: 0 }),
  );

  await vi.waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.price).toBeNull();
  expect(result.current.priceDetail).toBeNull();
});

// TODO: Add formatTokenPrice tests when module imports are resolved
