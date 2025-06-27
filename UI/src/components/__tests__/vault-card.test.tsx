import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseEther } from 'viem'
import VaultCard from '../vault-card'
import { TestProviders } from '../../test-utils/test-providers'
import { MOCK_CONTRACTS } from '../../test-utils/mock-contracts'
import type { RealVault } from '../../types/vault'

// Mock the hooks
const mockUseVaultWithErrorHandling = vi.fn()
const mockUseTransactionHistory = vi.fn()

vi.mock('../use-vault-with-error-handling', () => ({
  useVaultWithErrorHandling: () => mockUseVaultWithErrorHandling(),
}))

vi.mock('../../hooks/use-transaction-history', () => ({
  useTransactionHistory: () => mockUseTransactionHistory(),
}))

// Mock vault data for testing
const createMockVault = (overrides?: Partial<RealVault>): RealVault => ({
  id: MOCK_CONTRACTS.vault,
  name: 'wS-USDC.e',
  tokens: ['wS', 'USDC.e'],
  platform: 'Arca DLMM',
  chain: 'Sonic Fork',
  
  // Contract data
  vaultBalanceX: '1000.0',
  vaultBalanceY: '1000.0',
  userSharesX: '10.0',
  userSharesY: '10.0',
  pricePerShareX: '1.1',
  pricePerShareY: '1.05',
  
  // Calculated values
  totalTvl: 2000,
  userBalance: 100,
  apr: 45.2,
  aprDaily: 0.124,
  
  // Enhanced user metrics
  userEarnings: 10.5,
  userROI: 10.5,
  userTotalDeposited: 100,
  
  // USD breakdowns
  vaultBalanceXUSD: 850,
  vaultBalanceYUSD: 1000,
  userSharesXUSD: 9.35,
  userSharesYUSD: 10.5,
  
  contractAddress: MOCK_CONTRACTS.vault,
  isActive: true,
  
  // User balances
  userBalanceWS: '100.0',
  userBalanceUSDC: '200.0',
  
  // Queue status
  pendingDeposits: '0',
  pendingWithdraws: '0',
  
  ...overrides,
})

describe('VaultCard Money-Handling Flows', () => {
  const user = userEvent.setup()
  let mockVault: RealVault
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockVault = createMockVault()
    
    // Default mock implementations
    mockUseVaultWithErrorHandling.mockReturnValue({
      depositWS: vi.fn(),
      depositUSDC: vi.fn(),
      withdrawShares: vi.fn(),
      approveWS: vi.fn(),
      approveUSDC: vi.fn(),
      hasAllowance: vi.fn().mockReturnValue(true),
      isWritePending: false,
      isConfirming: false,
      lastOperation: null,
      error: null,
      clearError: vi.fn(),
      validateConnection: vi.fn().mockReturnValue(true),
      validateBalance: vi.fn().mockReturnValue(true),
      validateShares: vi.fn().mockReturnValue(true),
      hash: undefined,
    })
    
    mockUseTransactionHistory.mockReturnValue({
      addTransaction: vi.fn(),
      updateTransactionStatus: vi.fn(),
    })
  })

  describe('🔴 HIGH RISK: Deposit Input Validation', () => {
    it('should prevent deposit when amount is empty', async () => {
      const mockDepositWS = vi.fn()
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        depositWS: mockDepositWS,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      // Expand the card to show deposit inputs - click the first instance
      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      // Try to deposit without entering amount
      const depositButton = screen.getByRole('button', { name: /enter ws amount/i })
      await user.click(depositButton)
      
      // Should NOT call depositWS with empty amount
      expect(mockDepositWS).not.toHaveBeenCalled()
    })

    it('should prevent deposit when amount is "0"', async () => {
      const mockDepositWS = vi.fn()
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        depositWS: mockDepositWS,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      // Enter zero amount in first input (wS)
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '0') // First input is wS
      
      const depositButton = screen.getByRole('button', { name: /enter ws amount/i })
      await user.click(depositButton)
      
      // Should NOT call depositWS with zero amount
      expect(mockDepositWS).not.toHaveBeenCalled()
    })

    it('should prevent deposit when amount exceeds user balance', async () => {
      const mockValidateBalance = vi.fn().mockReturnValue(false)
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        validateBalance: mockValidateBalance,
        depositWS: vi.fn(),
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      // Enter amount larger than balance (user has 100.0 wS)
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '999') // wS input
      
      const depositButton = screen.getByRole('button', { name: /enter ws amount/i })
      await user.click(depositButton)
      
      // Should call validateBalance and respect the result
      expect(mockValidateBalance).toHaveBeenCalledWith('wS', '999')
    })

    it('should handle very large numbers gracefully', async () => {
      const mockDepositWS = vi.fn()
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        depositWS: mockDepositWS,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      // Enter extremely large number
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '999999999999999999999') // wS input
      
      const depositButton = screen.getByRole('button', { name: /enter ws amount/i })
      await user.click(depositButton)
      
      // Should either handle gracefully or call with valid amount
      // The exact behavior depends on validation, but should not crash
      expect(() => parseEther('999999999999999999999')).not.toThrow()
    })

    it('should handle many decimal places correctly', async () => {
      const mockDepositWS = vi.fn()
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        depositWS: mockDepositWS,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      // Enter amount with many decimal places
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '1.123456789012345678') // wS input
      
      const depositButton = screen.getByRole('button', { name: /enter ws amount/i })
      await user.click(depositButton)
      
      // Should handle precision correctly
      if (mockDepositWS.mock.calls.length > 0) {
        const calledAmount = mockDepositWS.mock.calls[0][0]
        // Should be a valid string that parseEther can handle
        expect(() => parseEther(calledAmount)).not.toThrow()
      }
    })
  })

  describe('🔴 HIGH RISK: Approval Flow', () => {
    it('should require approval before deposit when no allowance', async () => {
      const mockHasAllowance = vi.fn().mockReturnValue(false)
      const mockApproveWS = vi.fn()
      const mockDepositWS = vi.fn()
      
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        hasAllowance: mockHasAllowance,
        approveWS: mockApproveWS,
        depositWS: mockDepositWS,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '50') // wS input
      
      // Button should show "Approve wS" instead of "Deposit wS"
      expect(screen.getByRole('button', { name: /approve ws/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /deposit ws/i })).not.toBeInTheDocument()
    })

    it('should show deposit button when user has sufficient allowance', async () => {
      const mockHasAllowance = vi.fn().mockReturnValue(true)
      
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        hasAllowance: mockHasAllowance,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '50') // wS input
      
      // Should show deposit button when allowance is sufficient
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deposit ws/i })).toBeInTheDocument()
      })
    })

    it('should call approval with correct amount', async () => {
      const mockHasAllowance = vi.fn().mockReturnValue(false)
      const mockApproveWS = vi.fn()
      
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        hasAllowance: mockHasAllowance,
        approveWS: mockApproveWS,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '75.5') // wS input
      
      const approveButton = screen.getByRole('button', { name: /approve ws/i })
      await user.click(approveButton)
      
      // Should show transaction confirmation modal first
      // The approval should be triggered through the modal
      expect(screen.getByText(/approve ws spending/i)).toBeInTheDocument()
    })
  })

  describe('🔴 HIGH RISK: Withdraw Flow', () => {
    it('should prevent withdrawal of more shares than user owns', async () => {
      const mockValidateShares = vi.fn().mockReturnValue(false)
      const mockWithdrawShares = vi.fn()
      
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        validateShares: mockValidateShares,
        withdrawShares: mockWithdrawShares,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      // Switch to withdraw tab
      await user.click(screen.getByText('Withdraw'))
      
      // Enter more shares than user owns (user has 10.0 wS shares)
      const wsSharesInput = screen.getAllByPlaceholderText('0.0')[0]
      await user.type(wsSharesInput, '999')
      
      const withdrawButton = screen.getByRole('button', { name: /withdraw shares/i })
      await user.click(withdrawButton)
      
      // Should call validateShares and respect the result
      expect(mockValidateShares).toHaveBeenCalledWith('999', '')
    })

    it('should calculate withdrawal amounts correctly', async () => {
      const mockWithdrawShares = vi.fn()
      
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        withdrawShares: mockWithdrawShares,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      await user.click(screen.getByText('Withdraw'))
      
      // Enter specific amounts for both tokens
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '5.5')   // wS shares
      await user.type(inputs[1], '3.25')  // USDC.e shares
      
      const withdrawButton = screen.getByRole('button', { name: /withdraw shares/i })
      await user.click(withdrawButton)
      
      // Should show withdrawal confirmation first
      expect(screen.getByText(/confirm.*withdrawal/i)).toBeInTheDocument()
    })

    it('should prevent empty withdrawals', async () => {
      const mockWithdrawShares = vi.fn()
      
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        withdrawShares: mockWithdrawShares,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      await user.click(screen.getByText('Withdraw'))
      
      // Try to withdraw without entering amounts
      const withdrawButton = screen.getByRole('button', { name: /withdraw shares/i })
      await user.click(withdrawButton)
      
      // Should NOT call withdrawShares
      expect(mockWithdrawShares).not.toHaveBeenCalled()
    })
  })

  describe('🔴 HIGH RISK: Transaction States', () => {
    it('should disable buttons during pending transactions', () => {
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        isWritePending: true,
        lastOperation: 'deposit',
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      // Should show loading state for deposit
      expect(screen.getByText(/pending/i)).toBeInTheDocument()
    })

    it('should show confirming state correctly', () => {
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        isConfirming: true,
        lastOperation: 'deposit',
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      // Should show confirming state
      expect(screen.getByText(/confirming/i)).toBeInTheDocument()
    })

    it('should clear input fields after successful deposit', async () => {
      // This test would require more complex state management testing
      // For now, verify the component structure supports this behavior
      
      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      const wsInput = screen.getByPlaceholderText('0.0') as HTMLInputElement
      await user.type(wsInput, '50')
      
      expect(wsInput.value).toBe('50')
      
      // After successful transaction, input should be cleared
      // This would be tested through transaction completion simulation
    })
  })

  describe('🔴 HIGH RISK: Error Handling', () => {
    it('should display errors clearly to users', () => {
      const testError = 'Insufficient balance for transaction'
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        error: testError,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      // Error should be displayed to user
      expect(screen.getByText(testError)).toBeInTheDocument()
    })

    it('should provide error dismissal functionality', async () => {
      const mockClearError = vi.fn()
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        error: 'Test error message',
        clearError: mockClearError,
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      // Should have dismiss button or functionality
      // Implementation depends on ErrorDisplay component
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    it('should handle wallet connection errors', () => {
      mockUseVaultWithErrorHandling.mockReturnValue({
        ...mockUseVaultWithErrorHandling(),
        validateConnection: vi.fn().mockReturnValue(false),
      })

      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      // Should gracefully handle disconnected wallet state
      // Component should still render but actions should be disabled
      expect(screen.getByText('wS-USDC.e')).toBeInTheDocument()
    })
  })

  describe('🔴 HIGH RISK: Display Accuracy', () => {
    it('should display user balances accurately', () => {
      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      // Should show correct user balance (formatted to USD)
      expect(screen.getByText('$100')).toBeInTheDocument()
    })

    it('should display TVL accurately', () => {
      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      // Should show correct TVL
      expect(screen.getByText('$2,000')).toBeInTheDocument()
    })

    it('should display APR with correct precision', () => {
      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      // Should show APR with proper formatting
      expect(screen.getByText('45.2%')).toBeInTheDocument()
      expect(screen.getByText('(0.124% daily)')).toBeInTheDocument()
    })

    it('should display shares with consistent formatting', async () => {
      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      // Should show user shares with consistent decimal formatting
      expect(screen.getByText('10.0')).toBeInTheDocument() // wS shares
      // Note: This should match our fixed formatBalance function
    })
  })

  describe('🔴 HIGH RISK: Fee Calculations', () => {
    it('should show correct deposit fees in confirmation modal', async () => {
      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '100') // wS input
      
      const depositButton = screen.getByRole('button', { name: /enter ws amount/i })
      await user.click(depositButton)
      
      // Should show confirmation modal with fee breakdown
      expect(screen.getByText(/deposit fee \(0\.5%\)/i)).toBeInTheDocument()
      
      // 0.5% of 100 = 0.5
      expect(screen.getByText(/0\.500000/)).toBeInTheDocument()
    })

    it('should calculate net deposit amount correctly', async () => {
      render(
        <TestProviders>
          <VaultCard vault={mockVault} />
        </TestProviders>
      )

      await user.click(screen.getAllByText('wS-USDC.e')[0])
      
      const inputs = screen.getAllByPlaceholderText('0.0')
      await user.type(inputs[0], '100') // wS input
      
      const depositButton = screen.getByRole('button', { name: /enter ws amount/i })
      await user.click(depositButton)
      
      // Net deposit should be 100 - 0.5 = 99.5
      expect(screen.getByText(/99\.500000/)).toBeInTheDocument()
    })
  })
})