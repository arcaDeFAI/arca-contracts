/**
 * Price Feed Service Tests
 *
 * Basic tests for the real price feed service to ensure it compiles correctly.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { PriceFeedService } from "../price-feed";

// Mock fetch globally
global.fetch = vi.fn();

describe("PriceFeedService", () => {
  let service: PriceFeedService;

  beforeEach(() => {
    service = new PriceFeedService({
      cacheTimeout: 1000, // 1 second for testing
      retryAttempts: 2,
      retryDelay: 100,
    });
    vi.clearAllMocks();
    service.clearCache();
  });

  it("should create service instance with default config", () => {
    const defaultService = new PriceFeedService();
    expect(defaultService).toBeDefined();
  });

  it("should clear cache correctly", () => {
    service.clearCache();
    const status = service.getCacheStatus();
    expect(status.size).toBe(0);
    expect(status.entries).toHaveLength(0);
  });

  it("should handle fallback prices for known tokens", async () => {
    // Mock fetch to reject (simulate network error)
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const result = await service.getTokenPrice("ws");

    expect(result.symbol).toBe("ws");
    expect(result.price).toBe(0.9); // Fallback price
    expect(result.source).toBe("fallback");
  });

  it("should reject for unknown token symbols", async () => {
    await expect(service.getTokenPrice("unknown")).rejects.toThrow(
      "Unknown token symbol: unknown",
    );
  });

  it("should fetch multiple token prices and handle errors gracefully", async () => {
    // Mock fetch to reject (simulate network error)
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const result = await service.getMultipleTokenPrices(["ws", "usdc.e"]);

    expect(result.ws.source).toBe("fallback");
    expect(result["usdc.e"].source).toBe("fallback");
    expect(result.ws.price).toBe(0.9);
    expect(result["usdc.e"].price).toBe(1.0);
  });

  it("should successfully parse valid API response", async () => {
    const mockResponse = {
      sonic: {
        usd: 0.95,
        last_updated_at: 1640995200,
      },
    };

    // Mock successful fetch
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
      headers: new Headers(),
    } as Response);

    const result = await service.getTokenPrice("ws");

    expect(result).toEqual({
      symbol: "ws",
      price: 0.95,
      lastUpdated: 1640995200000,
      source: "coingecko",
    });
  });
});
