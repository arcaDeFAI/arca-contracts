/**
 * TDD Tests for Multi-Vault VaultCard Component
 *
 * These tests define the business requirements for a token-agnostic VaultCard
 * that works with ANY vault type (wS-USDC.e, wS-METRO, METRO-USDC, etc.)
 *
 * Following TDD principles: Tests define behavior, implementation follows tests.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseEther } from "viem";
import VaultCard from "../vault-card";
import { TestProviders } from "../../test-utils/test-providers";
import type { RealVault } from "../../types/vault";

// Mock the multi-vault useVault hook
const mockUseVault = vi.fn();
const mockUseTransactionHistory = vi.fn();

vi.mock("../../hooks/use-vault", () => ({
  useVault: (vaultAddress?: string) => mockUseVault(vaultAddress),
}));

vi.mock("../../hooks/use-transaction-history", () => ({
  useTransactionHistory: () => mockUseTransactionHistory(),
}));

// Factory function for creating vaults with any token pair
const createVault = (
  tokenX: string,
  tokenY: string,
  vaultAddress = "0x1234567890123456789012345678901234567890",
): RealVault => ({
  id: vaultAddress,
  name: `${tokenX}-${tokenY}`,
  tokens: [tokenX, tokenY],
  platform: "DLMM",
  chain: "Sonic Fork",

  // Contract data
  vaultBalanceX: "1000.0",
  vaultBalanceY: "1000.0",
  userSharesX: "10.0",
  userSharesY: "10.0",
  pricePerShareX: "1.1",
  pricePerShareY: "1.05",

  // Calculated values
  totalTvl: 2000,
  userBalance: 100,
  apr: 45.2,
  aprDaily: 0.124,

  // User metrics
  userEarnings: 10.5,
  userROI: 10.5,
  userTotalDeposited: 100,

  // USD breakdowns
  vaultBalanceXUSD: 850,
  vaultBalanceYUSD: 1000,
  userSharesXUSD: 9.35,
  userSharesYUSD: 10.5,

  contractAddress: vaultAddress,
  isActive: true,

  // User balances
  userBalanceX: "100.0",
  userBalanceY: "200.0",

  // Queue status
  pendingDeposits: "0",
  pendingWithdraws: "0",
});

describe("Multi-Vault VaultCard (TDD)", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock transaction history
    mockUseTransactionHistory.mockReturnValue({
      addTransaction: vi.fn(),
      updateTransactionStatus: vi.fn(),
    });
  });

  describe("🎯 TDD: Token-Agnostic Display Requirements", () => {
    it("should display correct token symbols for wS-USDC.e vault", () => {
      const vault = createVault("wS", "USDC.e");

      mockUseVault.mockReturnValue({
        vaultConfig: { tokenX: { symbol: "wS" }, tokenY: { symbol: "USDC.e" } },
        tokenXSymbol: "wS",
        tokenYSymbol: "USDC.e",
        userBalanceX: "100.0",
        userBalanceY: "200.0",
        // ... other mock data
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        approveTokenX: vi.fn(),
        approveTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(true),
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        validateBalance: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      // Should display the correct vault name (use first match - desktop version)
      expect(screen.getAllByText("wS-USDC.e")[0]).toBeInTheDocument();
    });

    it("should display correct token symbols for wS-METRO vault", () => {
      const vault = createVault("wS", "METRO");

      mockUseVault.mockReturnValue({
        vaultConfig: { tokenX: { symbol: "wS" }, tokenY: { symbol: "METRO" } },
        tokenXSymbol: "wS",
        tokenYSymbol: "METRO",
        userBalanceX: "50.0",
        userBalanceY: "300.0",
        // ... other mock data
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        approveTokenX: vi.fn(),
        approveTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(true),
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        validateBalance: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      // Should display the correct vault name (use first match - desktop version)
      expect(screen.getAllByText("wS-METRO")[0]).toBeInTheDocument();
    });

    it("should display correct token symbols for METRO-USDC vault", () => {
      const vault = createVault("METRO", "USDC");

      mockUseVault.mockReturnValue({
        vaultConfig: {
          tokenX: { symbol: "METRO" },
          tokenY: { symbol: "USDC" },
        },
        tokenXSymbol: "METRO",
        tokenYSymbol: "USDC",
        userBalanceX: "75.0",
        userBalanceY: "150.0",
        // ... other mock data
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        approveTokenX: vi.fn(),
        approveTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(true),
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        validateBalance: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      // Should display the correct vault name (use first match - desktop version)
      expect(screen.getAllByText("METRO-USDC")[0]).toBeInTheDocument();
    });
  });

  describe("🎯 TDD: Token-Agnostic Button Text Requirements", () => {
    it('should show "Enter wS Amount" and "Enter USDC.e Amount" for empty inputs', async () => {
      const vault = createVault("wS", "USDC.e");

      mockUseVault.mockReturnValue({
        vaultConfig: { tokenX: { symbol: "wS" }, tokenY: { symbol: "USDC.e" } },
        tokenXSymbol: "wS",
        tokenYSymbol: "USDC.e",
        userBalanceX: "100.0",
        userBalanceY: "200.0",
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(true),
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      // Expand card to show deposit inputs
      await user.click(screen.getAllByText("wS-USDC.e")[0]);

      // Should show token-specific button text for empty inputs (first match is desktop)
      const wsButtons = screen.getAllByRole("button", {
        name: /enter ws amount/i,
      });
      const usdcButtons = screen.getAllByRole("button", {
        name: /enter usdc\.e amount/i,
      });
      expect(wsButtons[0]).toBeInTheDocument();
      expect(usdcButtons[0]).toBeInTheDocument();
    });

    it('should show "Enter METRO Amount" and "Enter USDC Amount" for METRO-USDC vault', async () => {
      const vault = createVault("METRO", "USDC");

      mockUseVault.mockReturnValue({
        vaultConfig: {
          tokenX: { symbol: "METRO" },
          tokenY: { symbol: "USDC" },
        },
        tokenXSymbol: "METRO",
        tokenYSymbol: "USDC",
        userBalanceX: "75.0",
        userBalanceY: "150.0",
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(true),
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      // Expand card to show deposit inputs
      await user.click(screen.getAllByText("METRO-USDC")[0]);

      // Should show token-specific button text for empty inputs (first match is desktop)
      const metroButtons = screen.getAllByRole("button", {
        name: /enter metro amount/i,
      });
      const usdcButtons = screen.getAllByRole("button", {
        name: /enter usdc amount/i,
      });
      expect(metroButtons[0]).toBeInTheDocument();
      expect(usdcButtons[0]).toBeInTheDocument();
    });

    it('should show "Approve wS" when allowance is insufficient for wS', async () => {
      const vault = createVault("wS", "USDC.e");

      mockUseVault.mockReturnValue({
        vaultConfig: { tokenX: { symbol: "wS" }, tokenY: { symbol: "USDC.e" } },
        tokenXSymbol: "wS",
        tokenYSymbol: "USDC.e",
        userBalanceX: "100.0",
        userBalanceY: "200.0",
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        approveTokenX: vi.fn(),
        approveTokenY: vi.fn(),
        hasAllowance: vi
          .fn()
          .mockImplementation((tokenIndex) =>
            tokenIndex === 0 ? false : true,
          ), // No allowance for tokenX (wS)
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      await user.click(screen.getAllByText("wS-USDC.e")[0]);

      // Enter amount in first token input
      const inputs = screen.getAllByPlaceholderText("0.0");
      await user.type(inputs[0], "50");

      // Should show approve button for wS (tokenX) - first match is desktop
      await waitFor(() => {
        const approveButtons = screen.getAllByRole("button", {
          name: /approve ws/i,
        });
        expect(approveButtons[0]).toBeInTheDocument();
      });
    });

    it('should show "Deposit METRO" when allowance is sufficient for METRO', async () => {
      const vault = createVault("METRO", "USDC");

      mockUseVault.mockReturnValue({
        vaultConfig: {
          tokenX: { symbol: "METRO" },
          tokenY: { symbol: "USDC" },
        },
        tokenXSymbol: "METRO",
        tokenYSymbol: "USDC",
        userBalanceX: "75.0",
        userBalanceY: "150.0",
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(true), // Has allowance
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      await user.click(screen.getAllByText("METRO-USDC")[0]);

      // Enter amount in first token input
      const inputs = screen.getAllByPlaceholderText("0.0");
      await user.type(inputs[0], "25");

      // Should show deposit button for METRO (tokenX) - first match is desktop
      await waitFor(() => {
        const depositButtons = screen.getAllByRole("button", {
          name: /deposit metro/i,
        });
        expect(depositButtons[0]).toBeInTheDocument();
      });
    });
  });

  describe("🎯 TDD: Token-Agnostic Transaction Requirements", () => {
    it("should show confirmation modal then call depositTokenX for first token in any vault", async () => {
      const vault = createVault("wS", "METRO");
      const mockDepositTokenX = vi.fn();

      mockUseVault.mockReturnValue({
        vaultConfig: { tokenX: { symbol: "wS" }, tokenY: { symbol: "METRO" } },
        tokenXSymbol: "wS",
        tokenYSymbol: "METRO",
        userBalanceX: "100.0",
        userBalanceY: "200.0",
        depositTokenX: mockDepositTokenX,
        depositTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(true),
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        validateBalance: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      await user.click(screen.getAllByText("wS-METRO")[0]);

      // Enter amount for first token (wS)
      const inputs = screen.getAllByPlaceholderText("0.0");
      await user.type(inputs[0], "75");

      // Click deposit button for first token (desktop version)
      const depositButtons = screen.getAllByRole("button", {
        name: /deposit ws/i,
      });
      await user.click(depositButtons[0]);

      // Should show confirmation modal for better UX
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Click confirm button to complete transaction
      const confirmButton = screen.getByRole("button", { name: /confirm/i });
      await user.click(confirmButton);

      // Should call depositTokenX after confirmation
      expect(mockDepositTokenX).toHaveBeenCalledWith("75");
    });

    it("should show confirmation modal then call depositTokenY for second token in any vault", async () => {
      const vault = createVault("METRO", "USDC");
      const mockDepositTokenY = vi.fn();

      mockUseVault.mockReturnValue({
        vaultConfig: {
          tokenX: { symbol: "METRO" },
          tokenY: { symbol: "USDC" },
        },
        tokenXSymbol: "METRO",
        tokenYSymbol: "USDC",
        userBalanceX: "75.0",
        userBalanceY: "150.0",
        depositTokenX: vi.fn(),
        depositTokenY: mockDepositTokenY,
        hasAllowance: vi.fn().mockReturnValue(true),
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        validateBalance: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      await user.click(screen.getAllByText("METRO-USDC")[0]);

      // Enter amount for second token (USDC)
      const inputs = screen.getAllByPlaceholderText("0.0");
      await user.type(inputs[1], "100");

      // Click deposit button for second token (desktop version)
      const depositButtons = screen.getAllByRole("button", {
        name: /deposit usdc/i,
      });
      await user.click(depositButtons[0]);

      // Should show confirmation modal for better UX
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Click confirm button to complete transaction
      const confirmButton = screen.getByRole("button", { name: /confirm/i });
      await user.click(confirmButton);

      // Should call depositTokenY after confirmation
      expect(mockDepositTokenY).toHaveBeenCalledWith("100");
    });

    it("should call approveTokenX with correct token index for any vault", async () => {
      const vault = createVault("wS", "METRO");
      const mockApproveTokenX = vi.fn();

      mockUseVault.mockReturnValue({
        vaultConfig: { tokenX: { symbol: "wS" }, tokenY: { symbol: "METRO" } },
        tokenXSymbol: "wS",
        tokenYSymbol: "METRO",
        userBalanceX: "100.0",
        userBalanceY: "200.0",
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        approveTokenX: mockApproveTokenX,
        approveTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(false), // No allowance
        validateBalance: vi.fn().mockReturnValue(true),
        validateConnection: vi.fn().mockReturnValue(true),
        isWritePending: false,
        isConfirming: false,
        lastOperation: null,
        hash: undefined,
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      await user.click(screen.getAllByText("wS-METRO")[0]);

      // Enter amount for first token (wS)
      const inputs = screen.getAllByPlaceholderText("0.0");
      await user.type(inputs[0], "50");

      // Click approve button for first token (desktop version)
      const approveButtons = screen.getAllByRole("button", {
        name: /approve ws/i,
      });
      await user.click(approveButtons[0]);

      // Should show transaction confirmation modal for approval
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Click confirm button to complete approval
      const confirmButton = screen.getByRole("button", { name: /confirm/i });
      await user.click(confirmButton);

      // Should call approveTokenX after confirmation
      expect(mockApproveTokenX).toHaveBeenCalledWith("50");
    });
  });

  describe("🎯 TDD: Token-Agnostic Validation Requirements", () => {
    it("should validate balance using tokenIndex for any token", async () => {
      const vault = createVault("METRO", "USDC");
      const mockValidateBalance = vi.fn().mockReturnValue(false);

      mockUseVault.mockReturnValue({
        vaultConfig: {
          tokenX: { symbol: "METRO" },
          tokenY: { symbol: "USDC" },
        },
        tokenXSymbol: "METRO",
        tokenYSymbol: "USDC",
        userBalanceX: "75.0",
        userBalanceY: "150.0",
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(true),
        validateBalance: mockValidateBalance,
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      await user.click(screen.getAllByText("METRO-USDC")[0]);

      // Try to deposit more than balance
      const inputs = screen.getAllByPlaceholderText("0.0");
      await user.type(inputs[0], "999"); // More than 75.0 METRO balance

      const depositButtons = screen.getAllByRole("button", {
        name: /deposit metro/i,
      });
      await user.click(depositButtons[0]);

      // Should call validateBalance with token index 0 (METRO)
      expect(mockValidateBalance).toHaveBeenCalledWith(0, "999");
    });

    it("should check allowance using tokenIndex for any token", async () => {
      const vault = createVault("wS", "METRO");
      const mockHasAllowance = vi.fn();

      mockUseVault.mockReturnValue({
        vaultConfig: { tokenX: { symbol: "wS" }, tokenY: { symbol: "METRO" } },
        tokenXSymbol: "wS",
        tokenYSymbol: "METRO",
        userBalanceX: "100.0",
        userBalanceY: "200.0",
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        hasAllowance: mockHasAllowance,
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        validateBalance: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      await user.click(screen.getAllByText("wS-METRO")[0]);

      // Enter amounts for both tokens
      const inputs = screen.getAllByPlaceholderText("0.0");
      await user.type(inputs[0], "50"); // wS (tokenIndex 0)
      await user.type(inputs[1], "25"); // METRO (tokenIndex 1)

      // Should check allowance for both tokens using index
      expect(mockHasAllowance).toHaveBeenCalledWith(0, "50"); // wS
      expect(mockHasAllowance).toHaveBeenCalledWith(1, "25"); // METRO
    });
  });

  describe("🎯 TDD: Vault Address Parameter Requirement", () => {
    it("should pass vault address to useVault hook", () => {
      const vaultAddress = "0xSpecificVaultAddress123";
      const vault = createVault("wS", "USDC.e", vaultAddress);

      mockUseVault.mockReturnValue({
        vaultConfig: { tokenX: { symbol: "wS" }, tokenY: { symbol: "USDC.e" } },
        tokenXSymbol: "wS",
        tokenYSymbol: "USDC.e",
        userBalanceX: "100.0",
        userBalanceY: "200.0",
        depositTokenX: vi.fn(),
        depositTokenY: vi.fn(),
        hasAllowance: vi.fn().mockReturnValue(true),
        isWritePending: false,
        isConfirming: false,
        validateConnection: vi.fn().mockReturnValue(true),
        error: null,
        clearError: vi.fn(),
      });

      render(
        <TestProviders>
          <VaultCard vault={vault} />
        </TestProviders>,
      );

      // Should call useVault with the specific vault address
      expect(mockUseVault).toHaveBeenCalledWith(vaultAddress);
    });
  });
});

/**
 * TDD Test Summary:
 *
 * These tests define the business requirements for a token-agnostic VaultCard:
 *
 * 1. ✅ Display Requirements: Show correct token symbols for any vault
 * 2. ✅ Button Text Requirements: Dynamic text based on token symbols and state
 * 3. ✅ Transaction Requirements: Use tokenIndex-based functions (depositTokenX/Y)
 * 4. ✅ Validation Requirements: Index-based validation for any token
 * 5. ✅ Hook Parameter Requirements: Pass vault address to useVault
 *
 * Next Step: Implement VaultCard to make these tests pass (GREEN phase)
 */
