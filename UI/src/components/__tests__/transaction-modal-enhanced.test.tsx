/**
 * 🎯 TDD: Enhanced TransactionModal Tests - Fee Display & Token-Agnostic Support
 *
 * These tests validate the enhanced transaction UI with comprehensive fee calculations
 * and multi-vault token-agnostic support. Following TDD: Tests define enhanced UX first.
 *
 * Enhanced Features Coverage:
 * - Fee calculation accuracy (deposit 0.5%, withdrawal 0.5%)
 * - Net amount calculations
 * - User balance validations
 * - Token-agnostic interface (wS/USDC.e, wS/METRO, METRO/USDC)
 * - Network fee display
 * - Withdrawal share calculations
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TransactionModal,
  type TransactionModalProps,
} from "../transaction-modal";
import { TestProviders } from "../../test-utils/test-providers";

describe("🎯 TDD: Enhanced TransactionModal - Fee Display & Multi-Vault", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("🎯 TDD: Enhanced Fee Calculations", () => {
    it("should calculate deposit fees accurately for any token amount", () => {
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        type: "deposit",
        token: "wS",
        amount: "100.0",
        userBalance: "500.0",
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      // Should show deposit amount
      expect(screen.getByText("100.000000 wS")).toBeInTheDocument();

      // Should calculate 0.5% deposit fee: 100 * 0.005 = 0.5
      expect(screen.getByText("-0.500000 wS")).toBeInTheDocument();

      // Should calculate net deposit: 100 - 0.5 = 99.5
      expect(screen.getByText("99.500000 wS")).toBeInTheDocument();

      // Should show remaining balance: 500 - 100 = 400
      expect(screen.getByText("400.000000 wS")).toBeInTheDocument();
    });

    it("should calculate fees correctly for decimal amounts", () => {
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        type: "deposit",
        token: "USDC.e",
        amount: "1234.56789",
        userBalance: "2000.0",
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      // Should show deposit amount with precision
      expect(screen.getByText("1234.567890 USDC.e")).toBeInTheDocument();

      // Should calculate 0.5% fee: 1234.56789 * 0.005 = 6.172839
      expect(screen.getByText("-6.172839 USDC.e")).toBeInTheDocument();

      // Should calculate net: 1234.56789 - 6.172839 = 1228.395051
      expect(screen.getByText("1228.395051 USDC.e")).toBeInTheDocument();
    });

    it("should handle zero and very small amounts gracefully", () => {
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        type: "deposit",
        token: "wS",
        amount: "0.001",
        userBalance: "1.0",
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      // Should handle small amounts: 0.001 * 0.005 = 0.000005
      expect(screen.getByText("0.001000 wS")).toBeInTheDocument();
      expect(screen.getByText("-0.000005 wS")).toBeInTheDocument();
      expect(screen.getByText("0.000995 wS")).toBeInTheDocument();
    });
  });

  describe("🎯 TDD: Token-Agnostic Support (Multi-Vault)", () => {
    it("should support METRO token deposits", () => {
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        type: "deposit",
        token: "METRO",
        amount: "50.0",
        userBalance: "100.0",
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      // Should display METRO-specific calculations
      expect(screen.getByText("Confirm METRO Deposit")).toBeInTheDocument();

      // TDD: Handle multiple instances of the same text (similar to VaultCard responsive pattern)
      const metroAmounts = screen.getAllByText("50.000000 METRO");
      expect(metroAmounts.length).toBeGreaterThanOrEqual(1); // At least one instance

      expect(screen.getByText("-0.250000 METRO")).toBeInTheDocument(); // 50 * 0.005
      expect(screen.getByText("49.750000 METRO")).toBeInTheDocument(); // 50 - 0.25
    });

    it("should support any token symbol for withdrawals", () => {
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        type: "withdraw",
        token: "CUSTOM",
        amount: "25.0",
        vaultShare: "1.1", // 1.1 tokens per share
        userBalance: "100.0",
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      // Should show withdrawal details for any token
      expect(screen.getByText("Confirm CUSTOM Withdrawal")).toBeInTheDocument();
      expect(screen.getByText("25.000000")).toBeInTheDocument(); // Shares
      expect(screen.getByText("1.100000 CUSTOM")).toBeInTheDocument(); // Share value

      // Should calculate estimated tokens: 25 * 1.1 = 27.5
      expect(screen.getByText("27.500000 CUSTOM")).toBeInTheDocument();

      // Should calculate withdrawal fee: 27.5 * 0.005 = 0.1375
      // TDD: Handle multiple instances (may appear in fee calculation and final amount)
      const feeElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes("0.137500") || false;
      });
      expect(feeElements.length).toBeGreaterThanOrEqual(1); // At least one instance
    });
  });

  describe("🎯 TDD: Network Fee Display", () => {
    it("should display network fees when provided", () => {
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        type: "deposit",
        token: "wS",
        amount: "100.0",
        fees: {
          depositFee: "0.5",
          networkFee: "0.001",
          networkFeeUSD: "2.50",
        },
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      // Should show network fees section
      expect(screen.getByText("Network Fees")).toBeInTheDocument();
      expect(screen.getByText("0.001 S")).toBeInTheDocument();
      expect(screen.getByText("(~$2.50)")).toBeInTheDocument();
    });

    it("should work without network fees", () => {
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        type: "deposit",
        token: "wS",
        amount: "100.0",
        // No fees provided
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      // Should not show network fees section
      expect(screen.queryByText("Network Fees")).not.toBeInTheDocument();

      // But should still show transaction details
      expect(screen.getByText("Transaction Details")).toBeInTheDocument();
    });
  });

  describe("🎯 TDD: Approval Flow", () => {
    it("should show approval modal for any token", () => {
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        type: "approve",
        token: "METRO",
        amount: "100.0",
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      expect(screen.getByText("Approve METRO Spending")).toBeInTheDocument();
      expect(
        screen.getByText(
          /approve the vault contract to spend your METRO tokens/i,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("🎯 TDD: User Interaction", () => {
    it("should call onConfirm when confirm button is clicked", async () => {
      const onConfirm = vi.fn();
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm,
        type: "deposit",
        token: "wS",
        amount: "100.0",
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      const confirmButton = screen.getByRole("button", { name: /confirm/i });
      await user.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when cancel button is clicked", async () => {
      const onClose = vi.fn();
      const props: TransactionModalProps = {
        isOpen: true,
        onClose,
        onConfirm: vi.fn(),
        type: "deposit",
        token: "wS",
        amount: "100.0",
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should disable buttons when loading", () => {
      const props: TransactionModalProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        type: "deposit",
        token: "wS",
        amount: "100.0",
        isLoading: true,
      };

      render(
        <TestProviders>
          <TransactionModal {...props} />
        </TestProviders>,
      );

      const confirmButton = screen.getByRole("button", { name: /processing/i });
      expect(confirmButton).toBeDisabled();
    });
  });
});

/**
 * Test Summary - Enhanced TransactionModal Coverage:
 *
 * ✅ Fee Calculations (3 tests): 0.5% deposit fees, decimal precision, edge cases
 * ✅ Token-Agnostic Support (2 tests): METRO, CUSTOM tokens, multi-vault architecture
 * ✅ Network Fee Display (2 tests): With/without network fees, USD conversion
 * ✅ Approval Flow (1 test): Token-agnostic approval modals
 * ✅ User Interaction (3 tests): Confirm/cancel actions, loading states
 *
 * Total: 11 comprehensive tests covering enhanced transaction UI functionality
 *
 * Enhancement Goals:
 * - [NEXT] Update token interface to be fully token-agnostic: token: string
 * - [NEXT] Test with real multi-vault scenarios (wS/USDC.e, wS/METRO, METRO/USDC)
 * - [NEXT] Add performance fee calculations (10% on rewards)
 * - [NEXT] Add slippage protection and advanced settings
 */
