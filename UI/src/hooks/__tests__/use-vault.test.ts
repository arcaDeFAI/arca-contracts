import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { parseEther, formatEther } from 'viem'
import * as wagmi from 'wagmi'
import * as contractsModule from '../../lib/contracts'
import { useVault } from '../use-vault'
import { TestProviders } from '../../test-utils/test-providers'
import { 
  MOCK_CONTRACTS, 
  MOCK_VAULT_DATA,
  MOCK_TX_HASH,
  createMockReadContract,
  createMockWriteContract,
  createMockWaitForTransactionReceipt 
} from '../../test-utils/mock-contracts'

// Mock wagmi hooks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useAccount: vi.fn(() => ({
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      chainId: 31337, // Hardhat chain ID
    })),
    useReadContract: vi.fn(() => ({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })),
    useWriteContract: vi.fn(() => ({
      writeContract: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    })),
    useWaitForTransactionReceipt: vi.fn(() => ({
      data: undefined,
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
    })),
  }
})

// Mock the contracts module
vi.mock('../../lib/contracts', () => ({
  getContracts: vi.fn(),
  VAULT_ABI: [],
  ERC20_ABI: [],
  QUEUE_HANDLER_ABI: [],
}))

const mockedUseAccount = vi.mocked(wagmi.useAccount)
const mockedUseReadContract = vi.mocked(wagmi.useReadContract)
const mockedUseWriteContract = vi.mocked(wagmi.useWriteContract)
const mockedUseWaitForTransactionReceipt = vi.mocked(wagmi.useWaitForTransactionReceipt)

describe('useVault Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the getContracts function
    vi.mocked(contractsModule.getContracts).mockReturnValue(MOCK_CONTRACTS)
  })

  describe('Contract Data Reading', () => {
    it('should return formatted vault balances', () => {
      // Mock vault balance queries
      mockedUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'tokenBalance') {
          return createMockReadContract(MOCK_VAULT_DATA.vaultBalanceX)
        }
        return createMockReadContract(undefined)
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.vaultBalanceX).toBe('1000.0')
      expect(result.current.contracts).toEqual(MOCK_CONTRACTS)
    })

    it('should return user share balances', () => {
      mockedUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'getShares') {
          return createMockReadContract(MOCK_VAULT_DATA.userSharesX)
        }
        return createMockReadContract(undefined)
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.userSharesX).toBe('10.0')
    })

    it('should calculate price per share correctly', () => {
      mockedUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'getPricePerFullShare') {
          return createMockReadContract(MOCK_VAULT_DATA.pricePerShareX)
        }
        return createMockReadContract(undefined)
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.pricePerShareX).toBe('1.1')
    })

    it('should return user token balances', () => {
      mockedUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'balanceOf') {
          return createMockReadContract(MOCK_VAULT_DATA.userBalanceWS)
        }
        return createMockReadContract(undefined)
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.userBalanceWS).toBe('100.0')
    })

    it('should handle loading states correctly', () => {
      mockedUseReadContract.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.vaultBalanceX).toBe('0')
      expect(result.current.vaultBalanceY).toBe('0')
    })

    it('should handle error states gracefully', () => {
      mockedUseReadContract.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Contract read failed'),
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.vaultBalanceX).toBe('0')
      expect(result.current.userSharesX).toBe('0')
    })
  })

  describe('Deposit Operations', () => {
    it('should approve and deposit wS tokens', async () => {
      const mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH)
      
      mockedUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        isPending: false,
        isError: false,
        error: null,
      })
      
      mockedUseWaitForTransactionReceipt.mockReturnValue(
        createMockWaitForTransactionReceipt(false)
      )

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // Test approval
      await result.current.approveWS('100')
      
      expect(mockWriteContract).toHaveBeenCalledWith({
        address: MOCK_CONTRACTS.tokenX,
        abi: expect.any(Array),
        functionName: 'approve',
        args: [MOCK_CONTRACTS.vault, parseEther('100')],
      })

      // Test deposit
      await result.current.depositWS('100')
      
      expect(mockWriteContract).toHaveBeenCalledWith({
        address: MOCK_CONTRACTS.vault,
        abi: expect.any(Array),
        functionName: 'depositTokenX',
        args: [parseEther('100')],
      })
    })

    it('should check allowance before deposit', () => {
      mockedUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'allowance') {
          return createMockReadContract(parseEther('50'))
        }
        return createMockReadContract(undefined)
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // Should have allowance for 50 tokens
      expect(result.current.hasAllowance('wS', '50')).toBe(true)
      expect(result.current.hasAllowance('wS', '100')).toBe(false)
    })

    it('should handle deposit transaction states', async () => {
      mockedUseWriteContract.mockReturnValue({
        writeContract: vi.fn().mockResolvedValue(MOCK_TX_HASH),
        data: undefined,
        isPending: true,
        isError: false,
        error: null,
      })
      
      mockedUseWaitForTransactionReceipt.mockReturnValue({
        data: undefined,
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.isWritePending).toBe(true)
      expect(result.current.isConfirming).toBe(true)
      expect(result.current.isConfirmed).toBe(false)
    })
  })

  describe('Withdraw Operations', () => {
    it('should withdraw shares correctly', async () => {
      const mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH)
      
      mockedUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        isPending: false,
        isError: false,
        error: null,
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      await result.current.withdrawShares('5', '5')
      
      expect(mockWriteContract).toHaveBeenCalledWith({
        address: MOCK_CONTRACTS.vault,
        abi: expect.any(Array),
        functionName: 'withdrawShares',
        args: [parseEther('5'), parseEther('5')],
      })
      
      expect(result.current.lastOperation).toBe('withdraw')
    })

    it('should handle withdrawAll operation', async () => {
      const mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH)
      
      mockedUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        isPending: false,
        isError: false,
        error: null,
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      await result.current.withdrawAll()
      
      expect(mockWriteContract).toHaveBeenCalledWith({
        address: MOCK_CONTRACTS.vault,
        abi: expect.any(Array),
        functionName: 'withdrawAll',
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing user address', () => {
      mockedUseAccount.mockReturnValue({
        address: undefined,
        chainId: 31337,
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      // Should return zero values when no user connected
      expect(result.current.userSharesX).toBe('0')
      expect(result.current.userSharesY).toBe('0')
      expect(result.current.userBalanceWS).toBe('0')
      expect(result.current.userBalanceUSDC).toBe('0')
    })

    it('should handle unsupported chain', () => {
      mockedUseAccount.mockReturnValue({
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        chainId: 1, // Ethereum mainnet - not supported
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.contracts).toBeUndefined()
    })

    it('should format balance with various bigint values', () => {
      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.formatBalance(parseEther('1.5'))).toBe('1.5')
      expect(result.current.formatBalance(parseEther('0.000001'))).toBe('0.000001')
      expect(result.current.formatBalance(0n)).toBe('0.0')
      expect(result.current.formatBalance(undefined)).toBe('0')
      expect(result.current.formatBalance('not a bigint')).toBe('0')
    })

    it('should handle zero allowance correctly', () => {
      mockedUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'allowance') {
          return createMockReadContract(0n)
        }
        return createMockReadContract(undefined)
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.hasAllowance('wS', '0.000001')).toBe(false)
      expect(result.current.hasAllowance('usdce', '100')).toBe(false)
    })
  })

  describe('Queue Status', () => {
    it('should return queue status as strings', () => {
      mockedUseReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'getUserQueues') {
          return createMockReadContract({
            depositCount: 3n,
            withdrawCount: 2n,
          })
        }
        return createMockReadContract(undefined)
      })

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.pendingDeposits).toBe('3')
      expect(result.current.pendingWithdraws).toBe('2')
    })

    it('should handle missing queue data', () => {
      mockedUseReadContract.mockImplementation(() => createMockReadContract(undefined))

      const { result } = renderHook(() => useVault(), {
        wrapper: TestProviders,
      })

      expect(result.current.pendingDeposits).toBe('0')
      expect(result.current.pendingWithdraws).toBe('0')
    })
  })
})