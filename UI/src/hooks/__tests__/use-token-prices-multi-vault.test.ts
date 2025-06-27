/**
 * TDD Tests for Multi-Vault useTokenPrices Hook
 * 
 * These tests define how token price fetching should work with ANY token symbols,
 * not just hard-coded wS/USDC.e. Following TDD: tests define requirements first.
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTokenPrices, getTokenUSDValue, formatTokenPrice, clearCache } from '../use-token-prices'

// Mock wagmi
const mockUseAccount = vi.fn()
vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
}))

describe('🎯 TDD: Multi-Vault useTokenPrices Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Clear price cache between tests
    clearCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('🎯 TDD: Dynamic Token Price Interface', () => {
    it('should provide a flexible TokenPrices interface that supports any token', async () => {
      // BUSINESS REQUIREMENT: TokenPrices should support any token symbol dynamically
      mockUseAccount.mockReturnValue({
        chainId: 31337,
      })

      const { result } = renderHook(() => useTokenPrices(['wS', 'USDC.e']))

      // Initially should be loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.prices).toBeNull()

      // Advance timers using the async API for async operations
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })

      // Now should have prices - use vi.waitFor with fake timers
      await vi.waitFor(() => {
        expect(result.current.prices).toBeDefined()
        expect(result.current.isLoading).toBe(false)
      })

      const prices = result.current.prices!

      // Should include requested tokens (case-insensitive)
      expect(prices['ws']).toBeDefined()
      expect(prices['usdc.e']).toBeDefined()
      expect(typeof prices['ws']).toBe('number')
      expect(typeof prices['usdc.e']).toBe('number')
      expect(prices.lastUpdated).toBeDefined()
    })

    it('should fetch prices for wS-METRO vault tokens', async () => {
      // BUSINESS REQUIREMENT: Support any token pair
      mockUseAccount.mockReturnValue({
        chainId: 31337,
      })

      const { result } = renderHook(() => useTokenPrices(['wS', 'METRO']))

      // Advance timers and wait for completion
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      
      await vi.waitFor(() => {
        expect(result.current.prices).toBeDefined()
      })

      const prices = result.current.prices!

      // Should include wS and METRO prices
      expect(prices['ws']).toBeGreaterThan(0)
      expect(prices['metro']).toBeGreaterThan(0)
      expect(typeof prices['metro']).toBe('number')
    })

    it('should fetch prices for METRO-USDC vault tokens', async () => {
      // BUSINESS REQUIREMENT: Support any token order
      mockUseAccount.mockReturnValue({
        chainId: 31337,
      })

      const { result } = renderHook(() => useTokenPrices(['METRO', 'USDC']))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      
      await vi.waitFor(() => {
        expect(result.current.prices).toBeDefined()
      })

      const prices = result.current.prices!

      // Should include METRO and USDC prices
      expect(prices['metro']).toBeGreaterThan(0)
      expect(prices['usdc']).toBeGreaterThan(0)
    })

    it('should handle empty token list gracefully', async () => {
      // BUSINESS REQUIREMENT: Graceful handling of edge cases
      mockUseAccount.mockReturnValue({
        chainId: 31337,
      })

      const { result } = renderHook(() => useTokenPrices([]))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      
      await vi.waitFor(() => {
        expect(result.current.prices).toBeDefined()
      })

      // Should return empty price object but not crash
      const prices = result.current.prices!
      expect(Object.keys(prices)).toEqual(['lastUpdated'])
    })
  })

  describe('🎯 TDD: Dynamic getTokenUSDValue Function', () => {
    it('should calculate USD value for any token symbol', () => {
      // BUSINESS REQUIREMENT: getTokenUSDValue should work with any token
      const mockPrices: any = {
        ws: 0.85,
        metro: 2.50,
        'usdc.e': 1.0,
        usdc: 1.0,
        lastUpdated: Date.now(),
      }

      // Test wS token
      expect(getTokenUSDValue('100', 'wS', mockPrices)).toBe(85) // 100 × 0.85

      // Test METRO token  
      expect(getTokenUSDValue('50', 'METRO', mockPrices)).toBe(125) // 50 × 2.50

      // Test USDC.e token
      expect(getTokenUSDValue('200', 'USDC.e', mockPrices)).toBe(200) // 200 × 1.0

      // Test USDC token
      expect(getTokenUSDValue('150', 'USDC', mockPrices)).toBe(150) // 150 × 1.0
    })

    it('should handle case-insensitive token symbols', () => {
      // BUSINESS REQUIREMENT: Token symbols should be case-insensitive
      const mockPrices: any = {
        ws: 0.85,
        metro: 2.50,
        'usdc.e': 1.0,
        lastUpdated: Date.now(),
      }

      // Different cases should work
      expect(getTokenUSDValue('100', 'WS', mockPrices)).toBe(85)
      expect(getTokenUSDValue('100', 'ws', mockPrices)).toBe(85)
      expect(getTokenUSDValue('50', 'Metro', mockPrices)).toBe(125)
      expect(getTokenUSDValue('50', 'METRO', mockPrices)).toBe(125)
    })

    it('should handle unknown tokens gracefully', () => {
      // BUSINESS REQUIREMENT: Unknown tokens should return 0, not crash
      const mockPrices: any = {
        ws: 0.85,
        lastUpdated: Date.now(),
      }

      expect(getTokenUSDValue('100', 'UNKNOWN_TOKEN', mockPrices)).toBe(0)
      expect(getTokenUSDValue('100', 'XYZ', mockPrices)).toBe(0)
    })

    it('should handle invalid amounts gracefully', () => {
      // BUSINESS REQUIREMENT: Invalid inputs should not crash
      const mockPrices: any = {
        ws: 0.85,
        lastUpdated: Date.now(),
      }

      expect(getTokenUSDValue('', 'wS', mockPrices)).toBe(0)
      expect(getTokenUSDValue('invalid', 'wS', mockPrices)).toBe(0)
      expect(getTokenUSDValue('NaN', 'wS', mockPrices)).toBe(0)
    })
  })

  describe('🎯 TDD: Dynamic formatTokenPrice Function', () => {
    it('should format prices for any token symbol', () => {
      // BUSINESS REQUIREMENT: Price formatting should work with any token
      const mockPrices: any = {
        ws: 0.85,
        metro: 2.505,
        'usdc.e': 1.0,
        usdc: 0.9998,
        lastUpdated: Date.now(),
      }

      // Should format with proper currency formatting
      expect(formatTokenPrice('wS', mockPrices)).toBe('$0.85')
      expect(formatTokenPrice('METRO', mockPrices)).toBe('$2.505') // Shows up to 4 decimal places
      expect(formatTokenPrice('USDC.e', mockPrices)).toBe('$1.00')
      expect(formatTokenPrice('USDC', mockPrices)).toBe('$0.9998')
    })

    it('should handle unknown tokens in formatting', () => {
      // BUSINESS REQUIREMENT: Unknown tokens should show $0.00
      const mockPrices: any = {
        ws: 0.85,
        lastUpdated: Date.now(),
      }

      expect(formatTokenPrice('UNKNOWN', mockPrices)).toBe('$0.00')
    })

    it('should handle null prices gracefully', () => {
      // BUSINESS REQUIREMENT: Null prices should show default
      expect(formatTokenPrice('wS', null)).toBe('$0.00')
    })
  })

  describe('🎯 TDD: Price Caching and Performance', () => {
    it('should cache prices to avoid excessive API calls', async () => {
      // BUSINESS REQUIREMENT: Efficient caching for performance
      mockUseAccount.mockReturnValue({
        chainId: 31337,
      })

      const { result: result1 } = renderHook(() => useTokenPrices(['wS', 'METRO']))
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      await vi.waitFor(() => expect(result1.current.prices).toBeDefined())

      const firstFetchTime = result1.current.prices!.lastUpdated

      // Second hook call should use cache (within cache duration)
      const { result: result2 } = renderHook(() => useTokenPrices(['wS', 'METRO']))
      
      await vi.waitFor(() => expect(result2.current.prices).toBeDefined())

      // Should be same cached data
      expect(result2.current.prices!.lastUpdated).toBe(firstFetchTime)
    })

    it('should refresh cache after cache duration expires', async () => {
      // BUSINESS REQUIREMENT: Cache should refresh periodically
      mockUseAccount.mockReturnValue({
        chainId: 31337,
      })

      const { result } = renderHook(() => useTokenPrices(['wS', 'METRO']))
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      await vi.waitFor(() => expect(result.current.prices).toBeDefined())

      const firstFetchTime = result.current.prices!.lastUpdated

      // Advance past cache duration (30 seconds)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31000)
      })
      
      await vi.waitFor(() => {
        expect(result.current.prices!.lastUpdated).toBeGreaterThan(firstFetchTime)
      })
    })

    it('should allow manual refetch', async () => {
      // BUSINESS REQUIREMENT: Manual refresh capability
      mockUseAccount.mockReturnValue({
        chainId: 31337,
      })

      const { result } = renderHook(() => useTokenPrices(['wS']))
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      await vi.waitFor(() => expect(result.current.prices).toBeDefined())

      const firstFetchTime = result.current.prices!.lastUpdated

      // Manual refetch
      result.current.refetch()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      
      await vi.waitFor(() => {
        expect(result.current.prices!.lastUpdated).toBeGreaterThan(firstFetchTime)
      })
    })
  })

  describe('🎯 TDD: Error Handling and Network Support', () => {
    it('should handle unsupported networks gracefully', async () => {
      // BUSINESS REQUIREMENT: Graceful network error handling
      mockUseAccount.mockReturnValue({
        chainId: 999999, // Unsupported network
      })

      const { result } = renderHook(() => useTokenPrices(['wS']))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      
      await vi.waitFor(() => {
        expect(result.current.error).toContain('Unsupported network')
      })

      expect(result.current.prices).toBeNull()
    })

    it('should support Sonic mainnet (chain ID 146)', async () => {
      // BUSINESS REQUIREMENT: Support production Sonic network
      mockUseAccount.mockReturnValue({
        chainId: 146,
      })

      const { result } = renderHook(() => useTokenPrices(['wS', 'USDC.e']))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      
      await vi.waitFor(() => {
        expect(result.current.prices).toBeDefined()
        expect(result.current.error).toBeNull()
      })
    })

    it('should support local fork (chain ID 31337)', async () => {
      // BUSINESS REQUIREMENT: Support development fork
      mockUseAccount.mockReturnValue({
        chainId: 31337,
      })

      const { result } = renderHook(() => useTokenPrices(['wS', 'USDC.e']))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      
      await vi.waitFor(() => {
        expect(result.current.prices).toBeDefined()
        expect(result.current.error).toBeNull()
      })
    })
  })
})

/**
 * TDD Test Summary:
 * 
 * These tests define the business requirements for a token-agnostic useTokenPrices hook:
 * 
 * 1. ✅ Dynamic Token Interface: Accept array of token symbols, return dynamic price object
 * 2. ✅ Any Token Pair Support: wS/USDC.e, wS/METRO, METRO/USDC, any combination
 * 3. ✅ Dynamic Utility Functions: getTokenUSDValue and formatTokenPrice work with any tokens
 * 4. ✅ Case Insensitive: Token symbols should work regardless of case
 * 5. ✅ Error Handling: Unknown tokens, invalid amounts, null prices handled gracefully
 * 6. ✅ Performance: Caching, periodic refresh, manual refetch
 * 7. ✅ Network Support: Sonic mainnet (146), fork (31337), unsupported networks
 * 
 * Next Step: Refactor useTokenPrices implementation to make these tests pass (GREEN phase)
 */