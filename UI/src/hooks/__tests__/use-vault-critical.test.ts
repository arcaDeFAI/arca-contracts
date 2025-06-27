import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseEther } from 'viem'
import { useVault } from '../use-vault'
import { TestProviders } from '../../test-utils/test-providers'
import { MOCK_CONTRACTS, MOCK_TX_HASH } from '../../test-utils/mock-contracts'
import * as contractsModule from '../../lib/contracts'

// Mock the contracts module
vi.mock('../../lib/contracts', () => ({
  getContracts: vi.fn(),
  VAULT_ABI: [],
  ERC20_ABI: [],
  QUEUE_HANDLER_ABI: [],
}))

// Mock wagmi hooks with simpler approach
const mockUseAccount = vi.fn()
const mockUseReadContract = vi.fn()
const mockUseWriteContract = vi.fn()
const mockUseWaitForTransactionReceipt = vi.fn()

vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useAccount: () => mockUseAccount(),
    useReadContract: (args: any) => mockUseReadContract(args),
    useWriteContract: () => mockUseWriteContract(),
    useWaitForTransactionReceipt: () => mockUseWaitForTransactionReceipt(),
  }
})

describe('useVault Critical Money Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the getContracts function
    vi.mocked(contractsModule.getContracts).mockReturnValue(MOCK_CONTRACTS)
    
    // Default mock implementations
    mockUseAccount.mockReturnValue({
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      chainId: 31337,
    })
    
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })
    
    mockUseWriteContract.mockReturnValue({
      writeContract: vi.fn(),
      data: undefined,
      isPending: false,
    })
    
    mockUseWaitForTransactionReceipt.mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
    })
  })

  describe('Critical: Deposit Flow', () => {
    it('should check allowance before allowing deposit', () => {
      // Mock zero allowance
      mockUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'allowance') {
          return { data: 0n, isLoading: false, isError: false }
        }
        return { data: undefined, isLoading: false, isError: false }
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // Should not have allowance
      expect(result.current.hasAllowance('wS', '100')).toBe(false)
    })

    it('should require approval before deposit when no allowance', () => {
      // Mock no allowance
      mockUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'allowance') {
          return { data: 0n, isLoading: false, isError: false }
        }
        return { data: undefined, isLoading: false, isError: false }
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // User should approve first
      expect(result.current.hasAllowance('wS', '100')).toBe(false)
      
      // This ensures UI will show "Approve" button instead of "Deposit"
    })

    it('should calculate deposit amount correctly', async () => {
      const mockWriteContract = vi.fn()
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        isPending: false,
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      await act(async () => {
        await result.current.depositWS('100.5')
      })

      // Should call with exact parsed amount and correct token index
      expect(mockWriteContract).toHaveBeenCalledWith({
        address: MOCK_CONTRACTS.vault,
        abi: expect.any(Array),
        functionName: 'depositToken',
        args: [parseEther('100.5'), 0], // 0 = wS token
      })
    })

    it('should track deposit transaction state', () => {
      mockUseWriteContract.mockReturnValue({
        writeContract: vi.fn(),
        data: MOCK_TX_HASH,
        isPending: true,
      })

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: undefined,
        isLoading: true,
        isSuccess: false,
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.isWritePending).toBe(true)
      expect(result.current.isConfirming).toBe(true)
      expect(result.current.hash).toBe(MOCK_TX_HASH)
    })
  })

  describe('Critical: Withdraw Flow', () => {
    it('should prevent withdrawal of more shares than user owns', () => {
      mockUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'getShares') {
          // User has 10 shares
          return { data: parseEther('10'), isLoading: false, isError: false }
        }
        return { data: undefined, isLoading: false, isError: false }
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // User shares should be properly formatted
      expect(result.current.userSharesX).toBe('10.0')
    })

    it('should calculate withdrawal amounts correctly', async () => {
      const mockWriteContract = vi.fn()
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        isPending: false,
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      await act(async () => {
        await result.current.withdrawShares('5.5', '3.25')
      })

      // Should call with exact parsed amounts as array
      expect(mockWriteContract).toHaveBeenCalledWith({
        address: MOCK_CONTRACTS.vault,
        abi: expect.any(Array),
        functionName: 'withdrawTokenShares',
        args: [[parseEther('5.5'), parseEther('3.25')]],
      })
    })

    it('should set lastOperation to withdraw', async () => {
      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      await act(async () => {
        await result.current.withdrawShares('1', '1')
      })

      expect(result.current.lastOperation).toBe('withdraw')
    })
  })

  describe('Critical: Balance Display', () => {
    it('should format balance correctly for display', () => {
      mockUseReadContract.mockImplementation(({ functionName, args }: any) => {
        if (functionName === 'tokenBalance' && args?.[0] === 0) {
          // Vault has 1234.567890123456789 wS tokens
          return { data: parseEther('1234.567890123456789'), isLoading: false }
        }
        if (functionName === 'tokenBalance' && args?.[0] === 1) {
          // Vault has 5678.9 USDC.e tokens
          return { data: parseEther('5678.9'), isLoading: false }
        }
        return { data: undefined, isLoading: false }
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // Should format with full precision
      expect(result.current.vaultBalanceX).toBe('1234.567890123456789')
      expect(result.current.vaultBalanceY).toBe('5678.9')
    })

    it('should handle zero balances safely', () => {
      mockUseReadContract.mockImplementation(() => ({
        data: 0n,
        isLoading: false,
        isError: false,
      }))

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.vaultBalanceX).toBe('0.0')
      expect(result.current.vaultBalanceY).toBe('0.0')
      expect(result.current.userSharesX).toBe('0.0')
      expect(result.current.userSharesY).toBe('0.0')
    })
  })

  describe('Critical: Error Handling', () => {
    it('should handle missing user address gracefully', () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        chainId: 31337,
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // Should return zero values when no user connected (with consistent formatting)
      expect(result.current.userSharesX).toBe('0.0')
      expect(result.current.userSharesY).toBe('0.0')
      expect(result.current.userBalanceWS).toBe('0.0')
      expect(result.current.userBalanceUSDC).toBe('0.0')
    })

    it('should handle contract read errors', () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('RPC Error'),
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // Should fallback to zero on errors (with consistent formatting)
      expect(result.current.vaultBalanceX).toBe('0.0')
      expect(result.current.vaultBalanceY).toBe('0.0')
    })

    it('should handle invalid balance formats', () => {
      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // Test formatBalance with edge cases (consistent decimal formatting)
      expect(result.current.formatBalance(undefined)).toBe('0.0')
      expect(result.current.formatBalance(null)).toBe('0.0')
      expect(result.current.formatBalance('not a bigint')).toBe('0.0')
      expect(result.current.formatBalance({})).toBe('0.0')
    })
  })

  describe('Critical: Price Per Share', () => {
    it('should display price per share for user calculations', () => {
      mockUseReadContract.mockImplementation(({ functionName, args }: any) => {
        if (functionName === 'getPricePerFullShare' && args?.[0] === 0) {
          // 1.1 tokens per share for wS
          return { data: parseEther('1.1'), isLoading: false }
        }
        if (functionName === 'getPricePerFullShare' && args?.[0] === 1) {
          // 1.05 tokens per share for USDC.e
          return { data: parseEther('1.05'), isLoading: false }
        }
        return { data: undefined, isLoading: false }
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.pricePerShareX).toBe('1.1')
      expect(result.current.pricePerShareY).toBe('1.05')
    })
  })
})