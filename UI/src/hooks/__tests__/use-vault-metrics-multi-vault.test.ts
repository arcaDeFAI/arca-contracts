/**
 * TDD Tests for Multi-Vault useVaultMetrics Hook
 * 
 * These tests define how vault metrics calculations should work with ANY token pair,
 * not just hard-coded wS/USDC.e. Following TDD: tests define requirements first.
 */

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useVaultMetrics, type VaultMetrics } from '../use-vault-metrics'

// Mock the dependencies
const mockUseVault = vi.fn()
const mockUseTokenPrices = vi.fn()
const mockUseTransactionHistory = vi.fn()

vi.mock('../use-vault', () => ({
  useVault: () => mockUseVault(),
}))

vi.mock('../use-token-prices', () => ({
  useTokenPrices: () => mockUseTokenPrices(),
  getTokenUSDValue: (amount: string, tokenSymbol: string, prices: any) => {
    const price = prices[tokenSymbol.toLowerCase()] || 0
    return parseFloat(amount) * price
  },
}))

vi.mock('../use-transaction-history', () => ({
  useTransactionHistory: () => mockUseTransactionHistory(),
}))

describe('🎯 TDD: Multi-Vault useVaultMetrics Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('🎯 TDD: Token-Agnostic Vault Metrics Calculations', () => {
    it('should calculate TVL correctly for wS-USDC.e vault', () => {
      // BUSINESS REQUIREMENT: TVL = sum of both token balances in USD
      mockUseVault.mockReturnValue({
        vaultBalanceX: '1000.0',    // 1000 wS
        vaultBalanceY: '2000.0',    // 2000 USDC.e
        userSharesX: '50.0',
        userSharesY: '100.0',
        userBalanceX: '200.0',      // User's wS balance
        userBalanceY: '500.0',      // User's USDC.e balance
        pricePerShareX: '1.1',
        pricePerShareY: '1.05',
        tokenXSymbol: 'wS',
        tokenYSymbol: 'USDC.e',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: {
          ws: 0.85,      // $0.85 per wS
          'usdc.e': 1.0, // $1.00 per USDC.e
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 400, // User deposited $400 total
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.metrics).toBeDefined()
      const metrics = result.current.metrics as VaultMetrics

      // TVL = (1000 wS × $0.85) + (2000 USDC.e × $1.0) = $850 + $2000 = $2850
      expect(metrics.totalTvlUSD).toBe(2850)
      expect(metrics.vaultBalanceXUSD).toBe(850)  // 1000 × 0.85
      expect(metrics.vaultBalanceYUSD).toBe(2000) // 2000 × 1.0
    })

    it('should calculate TVL correctly for wS-METRO vault', () => {
      // BUSINESS REQUIREMENT: Same calculation logic, different tokens
      mockUseVault.mockReturnValue({
        vaultBalanceX: '500.0',     // 500 wS
        vaultBalanceY: '1500.0',    // 1500 METRO
        userSharesX: '25.0',
        userSharesY: '75.0',
        userBalanceX: '100.0',      // User's wS balance
        userBalanceY: '300.0',      // User's METRO balance
        pricePerShareX: '1.2',
        pricePerShareY: '1.1',
        tokenXSymbol: 'wS',
        tokenYSymbol: 'METRO',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: {
          ws: 0.85,      // $0.85 per wS
          metro: 2.50,   // $2.50 per METRO
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 1000,
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.metrics).toBeDefined()
      const metrics = result.current.metrics as VaultMetrics

      // TVL = (500 wS × $0.85) + (1500 METRO × $2.50) = $425 + $3750 = $4175
      expect(metrics.totalTvlUSD).toBe(4175)
      expect(metrics.vaultBalanceXUSD).toBe(425)  // 500 × 0.85
      expect(metrics.vaultBalanceYUSD).toBe(3750) // 1500 × 2.50
    })

    it('should calculate TVL correctly for METRO-USDC vault', () => {
      // BUSINESS REQUIREMENT: Works with any token order
      mockUseVault.mockReturnValue({
        vaultBalanceX: '800.0',     // 800 METRO
        vaultBalanceY: '1200.0',    // 1200 USDC
        userSharesX: '40.0',
        userSharesY: '60.0',
        userBalanceX: '150.0',      // User's METRO balance
        userBalanceY: '250.0',      // User's USDC balance
        pricePerShareX: '1.15',
        pricePerShareY: '1.08',
        tokenXSymbol: 'METRO',
        tokenYSymbol: 'USDC',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: {
          metro: 2.50,   // $2.50 per METRO
          usdc: 1.0,     // $1.00 per USDC
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 800,
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.metrics).toBeDefined()
      const metrics = result.current.metrics as VaultMetrics

      // TVL = (800 METRO × $2.50) + (1200 USDC × $1.0) = $2000 + $1200 = $3200
      expect(metrics.totalTvlUSD).toBe(3200)
      expect(metrics.vaultBalanceXUSD).toBe(2000) // 800 × 2.50
      expect(metrics.vaultBalanceYUSD).toBe(1200) // 1200 × 1.0
    })
  })

  describe('🎯 TDD: Token-Agnostic User Position Calculations', () => {
    it('should calculate user shares value correctly for any token pair', () => {
      // BUSINESS REQUIREMENT: User shares value = shares × pricePerShare × tokenPrice
      mockUseVault.mockReturnValue({
        vaultBalanceX: '1000.0',
        vaultBalanceY: '2000.0',
        userSharesX: '50.0',        // User owns 50 shares of tokenX
        userSharesY: '100.0',       // User owns 100 shares of tokenY
        userBalanceX: '200.0',
        userBalanceY: '500.0',
        pricePerShareX: '1.1',      // Each share worth 1.1 tokens
        pricePerShareY: '1.05',     // Each share worth 1.05 tokens
        tokenXSymbol: 'wS',
        tokenYSymbol: 'METRO',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: {
          ws: 0.85,      // $0.85 per wS
          metro: 2.50,   // $2.50 per METRO
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 500,
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.metrics).toBeDefined()
      const metrics = result.current.metrics as VaultMetrics

      // User tokenX shares value = 50 shares × 1.1 tokens/share × $0.85/token = $46.75
      expect(metrics.userSharesXUSD).toBeCloseTo(46.75, 2)
      
      // User tokenY shares value = 100 shares × 1.05 tokens/share × $2.50/token = $262.50
      expect(metrics.userSharesYUSD).toBeCloseTo(262.5, 2)
      
      // User total position = $46.75 + $262.50 = $309.25
      expect(metrics.userTotalUSD).toBeCloseTo(309.25, 2)
    })

    it('should calculate user wallet balances correctly for any token pair', () => {
      // BUSINESS REQUIREMENT: User wallet balances in USD
      mockUseVault.mockReturnValue({
        vaultBalanceX: '1000.0',
        vaultBalanceY: '2000.0',
        userSharesX: '50.0',
        userSharesY: '100.0',
        userBalanceX: '200.0',      // User has 200 tokenX in wallet
        userBalanceY: '500.0',      // User has 500 tokenY in wallet
        pricePerShareX: '1.1',
        pricePerShareY: '1.05',
        tokenXSymbol: 'wS',
        tokenYSymbol: 'METRO',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: {
          ws: 0.85,      // $0.85 per wS
          metro: 2.50,   // $2.50 per METRO
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 500,
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.metrics).toBeDefined()
      const metrics = result.current.metrics as VaultMetrics

      // User wallet tokenX value = 200 × $0.85 = $170
      expect(metrics.userBalanceXUSD).toBe(170)
      
      // User wallet tokenY value = 500 × $2.50 = $1250
      expect(metrics.userBalanceYUSD).toBe(1250)
    })
  })

  describe('🎯 TDD: Token-Agnostic ROI Calculations', () => {
    it('should calculate user earnings and ROI correctly regardless of token pair', () => {
      // BUSINESS REQUIREMENT: ROI = (currentValue - totalDeposited) / totalDeposited × 100
      mockUseVault.mockReturnValue({
        vaultBalanceX: '1000.0',
        vaultBalanceY: '2000.0',
        userSharesX: '100.0',       // User position worth more than deposited
        userSharesY: '200.0',
        userBalanceX: '50.0',
        userBalanceY: '100.0',
        pricePerShareX: '1.2',      // Shares have appreciated (>1.0)
        pricePerShareY: '1.1',      // Shares have appreciated (>1.0)
        tokenXSymbol: 'METRO',
        tokenYSymbol: 'USDC',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: {
          metro: 3.0,    // $3.00 per METRO
          usdc: 1.0,     // $1.00 per USDC
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 500, // User deposited $500 total
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.metrics).toBeDefined()
      const metrics = result.current.metrics as VaultMetrics

      // Current value = (100 × 1.2 × $3.0) + (200 × 1.1 × $1.0) = $360 + $220 = $580
      expect(metrics.userTotalUSD).toBe(580)
      
      // Earnings = $580 - $500 = $80
      expect(metrics.userEarnings).toBe(80)
      
      // ROI = ($80 / $500) × 100 = 16%
      expect(metrics.userROI).toBe(16)
      expect(metrics.userTotalDeposited).toBe(500)
    })

    it('should handle zero deposits gracefully (edge case)', () => {
      // BUSINESS REQUIREMENT: Avoid division by zero
      mockUseVault.mockReturnValue({
        vaultBalanceX: '1000.0',
        vaultBalanceY: '2000.0',
        userSharesX: '0.0',         // No user position
        userSharesY: '0.0',
        userBalanceX: '0.0',
        userBalanceY: '0.0',
        pricePerShareX: '1.1',
        pricePerShareY: '1.05',
        tokenXSymbol: 'wS',
        tokenYSymbol: 'USDC.e',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: {
          ws: 0.85,
          'usdc.e': 1.0,
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 0, // No deposits yet
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.metrics).toBeDefined()
      const metrics = result.current.metrics as VaultMetrics

      expect(metrics.userTotalUSD).toBe(0)
      expect(metrics.userEarnings).toBe(0)
      expect(metrics.userROI).toBe(0) // Should not throw division by zero
      expect(metrics.userTotalDeposited).toBe(0)
    })
  })

  describe('🎯 TDD: Token-Agnostic APR Calculations', () => {
    it('should calculate estimated APR based on TVL size regardless of token composition', () => {
      // BUSINESS REQUIREMENT: APR calculation should work with any vault size/tokens
      mockUseVault.mockReturnValue({
        vaultBalanceX: '10000.0',   // Large vault
        vaultBalanceY: '20000.0',
        userSharesX: '100.0',
        userSharesY: '200.0',
        userBalanceX: '500.0',
        userBalanceY: '1000.0',
        pricePerShareX: '1.1',
        pricePerShareY: '1.05',
        tokenXSymbol: 'METRO',
        tokenYSymbol: 'USDC',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: {
          metro: 5.0,    // High value token
          usdc: 1.0,
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 2000,
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.metrics).toBeDefined()
      const metrics = result.current.metrics as VaultMetrics

      // Large TVL = (10000 × $5.0) + (20000 × $1.0) = $50000 + $20000 = $70000
      expect(metrics.totalTvlUSD).toBe(70000)
      
      // APR should be calculated and reasonable (not hardcoded)
      expect(metrics.estimatedApr).toBeGreaterThan(0)
      expect(metrics.estimatedApr).toBeLessThan(200) // Reasonable upper bound
      
      // Daily APR should be annual APR / 365
      expect(metrics.dailyApr).toBe(metrics.estimatedApr / 365)
    })
  })

  describe('🎯 TDD: Loading States and Error Handling', () => {
    it('should return loading state when prices are loading', () => {
      mockUseVault.mockReturnValue({
        vaultBalanceX: '1000.0',
        vaultBalanceY: '2000.0',
        userSharesX: '50.0',
        userSharesY: '100.0',
        userBalanceX: '200.0',
        userBalanceY: '500.0',
        pricePerShareX: '1.1',
        pricePerShareY: '1.05',
        tokenXSymbol: 'wS',
        tokenYSymbol: 'USDC.e',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 400,
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.metrics).toBeNull()
    })

    it('should handle price fetch errors gracefully', () => {
      mockUseVault.mockReturnValue({
        vaultBalanceX: '1000.0',
        vaultBalanceY: '2000.0',
        userSharesX: '50.0',
        userSharesY: '100.0',
        userBalanceX: '200.0',
        userBalanceY: '500.0',
        pricePerShareX: '1.1',
        pricePerShareY: '1.05',
        tokenXSymbol: 'wS',
        tokenYSymbol: 'USDC.e',
      })

      mockUseTokenPrices.mockReturnValue({
        prices: null,
        isLoading: false,
        error: 'Failed to fetch token prices',
        refetch: vi.fn(),
      })

      mockUseTransactionHistory.mockReturnValue({
        getTransactionSummary: vi.fn().mockReturnValue({
          totalDeposited: 400,
        }),
      })

      const { result } = renderHook(() => useVaultMetrics())

      expect(result.current.error).toBe('Failed to fetch token prices')
      expect(result.current.metrics).toBeNull()
    })
  })
})

/**
 * TDD Test Summary:
 * 
 * These tests define the business requirements for a token-agnostic useVaultMetrics hook:
 * 
 * 1. ✅ TVL Calculations: Work with any token pair (wS/USDC.e, wS/METRO, METRO/USDC)
 * 2. ✅ User Position Calculations: Calculate shares value using dynamic token prices
 * 3. ✅ Wallet Balance Calculations: Convert any token balances to USD
 * 4. ✅ ROI Calculations: Earnings and ROI work regardless of token types
 * 5. ✅ APR Calculations: Estimated APR based on TVL size, not token composition
 * 6. ✅ Edge Cases: Handle zero deposits, missing prices gracefully
 * 7. ✅ Loading States: Proper loading and error handling
 * 
 * Next Step: Refactor useVaultMetrics implementation to make these tests pass (GREEN phase)
 */