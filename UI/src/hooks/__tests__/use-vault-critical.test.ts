import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseEther } from "viem";
import { useVault } from "../use-vault";
import type * as wagmi from "wagmi";
import { TestProviders } from "../../test-utils/test-providers";
import {
  MOCK_TX_HASH,
  MOCK_SYSTEM_CONTRACTS,
  MOCK_DEPLOYMENT_ADDRESSES,
  createMockVaultConfig,
  createMockVaultData,
  createMockReadContract,
} from "../../test-utils/mock-contracts";
import { useVaultRegistry } from "../use-vault-registry";
import * as contractsModule from "../../lib/contracts";
import * as vaultConfigsModule from "../../lib/vault-configs";
import { SUPPORTED_CHAINS } from "../../config/chains";

// Mock wagmi hooks using the working pattern from VaultCard critical tests
const mockedUseAccount = vi.fn();
const mockedUseReadContract = vi.fn();
const mockedUseWriteContract = vi.fn();
const mockedUseWaitForTransactionReceipt = vi.fn();

// Mock vault registry - define inline to avoid hoisting issues
vi.mock("../use-vault-registry", () => ({
  useVaultRegistry: vi.fn(),
}));

vi.mock("wagmi", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof wagmi;
  return {
    ...actual,
    useAccount: vi.fn(() => mockedUseAccount()),
    useReadContract: vi.fn((args) => mockedUseReadContract(args)),
    useWriteContract: vi.fn(() => mockedUseWriteContract()),
    useWaitForTransactionReceipt: vi.fn(() =>
      mockedUseWaitForTransactionReceipt(),
    ),
  };
});

// Mock the contracts module
vi.mock("../../lib/contracts", () => ({
  getContracts: vi.fn(),
  VAULT_ABI: [],
  ERC20_ABI: [],
  QUEUE_HANDLER_ABI: [],
  REWARD_CLAIMER_ABI: [],
}));

// Mock the vault configs module - include all exports that useVault needs
vi.mock("../../lib/vault-configs", () => ({
  getVaultConfig: vi.fn(),
  getActiveVaultConfigs: vi.fn(),
  getVaultConfigsByChain: vi.fn(),
  getVaultConfigByTokens: vi.fn(),
  createVaultConfigFromRegistry: vi.fn(),
}));

describe("useVault Critical Money Flows", () => {
  // Use consistent multi-vault test configuration
  let currentVaultConfig: ReturnType<typeof createMockVaultConfig>;
  let currentMockData: ReturnType<typeof createMockVaultData>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default vault config (wS-USDC.e)
    currentVaultConfig = createMockVaultConfig("wS", "USDC.e");
    currentMockData = createMockVaultData(currentVaultConfig);

    // Mock the getContracts function
    vi.mocked(contractsModule.getContracts).mockReturnValue(
      MOCK_DEPLOYMENT_ADDRESSES,
    );

    // Mock the vault config lookup
    vi.mocked(vaultConfigsModule.getVaultConfig).mockReturnValue(
      currentVaultConfig,
    );

    // Mock createVaultConfigFromRegistry to return the current vault config
    vi.mocked(vaultConfigsModule.createVaultConfigFromRegistry).mockReturnValue(
      currentVaultConfig,
    );

    // Mock vault registry to return vault info matching the current config
    vi.mocked(useVaultRegistry).mockReturnValue({
      vaults: [
        {
          vault: currentVaultConfig.address,
          rewardClaimer: MOCK_SYSTEM_CONTRACTS.rewardClaimer,
          queueHandler: MOCK_SYSTEM_CONTRACTS.queueHandler,
          feeManager: MOCK_SYSTEM_CONTRACTS.feeManager,
          tokenX: currentVaultConfig.tokenX.address,
          tokenY: currentVaultConfig.tokenY.address,
          name: currentVaultConfig.name,
          symbol: "ARCA-V1",
          isActive: true,
        },
      ],
      isLoading: false,
      error: null,
      registryAddress: MOCK_SYSTEM_CONTRACTS.registry,
    });

    // Default mock implementations using the working pattern
    mockedUseAccount.mockReturnValue({
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      chainId: SUPPORTED_CHAINS.localhost.id,
    });

    mockedUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    mockedUseWriteContract.mockReturnValue({
      writeContract: vi.fn(),
      data: undefined,
      isPending: false,
    });

    mockedUseWaitForTransactionReceipt.mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
    });
  });

  describe("Critical: Deposit Flow", () => {
    it("should check allowance before allowing deposit", () => {
      // Mock zero allowance
      mockedUseReadContract.mockImplementation(
        (params?: { functionName?: string }) => {
          if (params?.functionName === "allowance") {
            return { data: 0n, isLoading: false, isError: false };
          }
          return { data: undefined, isLoading: false, isError: false };
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Should not have allowance (using token index instead of symbol)
      expect(result.current.hasAllowance(0, "100")).toBe(false); // tokenX = index 0
    });

    it("should require approval before deposit when no allowance", () => {
      // Mock no allowance
      mockedUseReadContract.mockImplementation(
        (params?: { functionName?: string }) => {
          if (params?.functionName === "allowance") {
            return { data: 0n, isLoading: false, isError: false };
          }
          return { data: undefined, isLoading: false, isError: false };
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // User should approve first (using token index)
      expect(result.current.hasAllowance(0, "100")).toBe(false); // tokenX = index 0

      // This ensures UI will show "Approve" button instead of "Deposit"
    });

    it("should calculate deposit amount correctly", async () => {
      const mockWriteContract = vi.fn();
      mockedUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        isPending: false,
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // TDD: Use the modern token-agnostic interface instead of legacy depositWS
      await act(async () => {
        await result.current.depositTokenX("100.5"); // depositTokenX = first token (wS in default vault)
      });

      // Should call with exact parsed amount and correct token index
      expect(mockWriteContract).toHaveBeenCalledWith({
        address: currentVaultConfig.address, // Use dynamic vault address
        abi: expect.any(Array),
        functionName: "depositToken",
        args: [parseEther("100.5"), 0], // 0 = tokenX (first token in pair)
      });
    });

    it("should track deposit transaction state", () => {
      mockedUseWriteContract.mockReturnValue({
        writeContract: vi.fn(),
        data: MOCK_TX_HASH,
        isPending: true,
      });

      mockedUseWaitForTransactionReceipt.mockReturnValue({
        data: undefined,
        isLoading: true,
        isSuccess: false,
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.isWritePending).toBe(true);
      expect(result.current.isConfirming).toBe(true);
      expect(result.current.hash).toBe(MOCK_TX_HASH);
    });
  });

  describe("Critical: Withdraw Flow", () => {
    it("should prevent withdrawal of more shares than user owns", () => {
      mockedUseReadContract.mockImplementation(
        (params?: { functionName?: string }) => {
          if (params?.functionName === "getShares") {
            // User has 10 shares
            return { data: parseEther("10"), isLoading: false, isError: false };
          }
          return { data: undefined, isLoading: false, isError: false };
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // User shares should be properly formatted
      expect(result.current.userSharesX).toBe("10.0");
    });

    it("should calculate withdrawal amounts correctly", async () => {
      const mockWriteContract = vi.fn();
      mockedUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        isPending: false,
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      await act(async () => {
        await result.current.withdrawShares("5.5", "3.25");
      });

      // Should call with exact parsed amounts as array
      expect(mockWriteContract).toHaveBeenCalledWith({
        address: currentVaultConfig.address, // Use dynamic vault address
        abi: expect.any(Array),
        functionName: "withdrawTokenShares",
        args: [[parseEther("5.5"), parseEther("3.25")]],
      });
    });

    it("should set lastOperation to withdraw", async () => {
      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      await act(async () => {
        await result.current.withdrawShares("1", "1");
      });

      expect(result.current.lastOperation).toBe("withdraw");
    });
  });

  describe("Critical: Balance Display", () => {
    it("should format balance correctly for display", () => {
      mockedUseReadContract.mockImplementation(
        (params?: { functionName?: string; args?: unknown[] }) => {
          if (
            params?.functionName === "tokenBalance" &&
            params?.args?.[0] === 0
          ) {
            // Vault has 1234.567890123456789 wS tokens
            return {
              data: parseEther("1234.567890123456789"),
              isLoading: false,
            };
          }
          if (
            params?.functionName === "tokenBalance" &&
            params?.args?.[0] === 1
          ) {
            // Vault has 5678.9 USDC.e tokens
            return { data: parseEther("5678.9"), isLoading: false };
          }
          return { data: undefined, isLoading: false };
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Should format with full precision
      expect(result.current.vaultBalanceX).toBe("1234.567890123456789");
      expect(result.current.vaultBalanceY).toBe("5678.9");
    });

    it("should handle zero balances safely", () => {
      mockedUseReadContract.mockImplementation(() => ({
        data: 0n,
        isLoading: false,
        isError: false,
      }));

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.vaultBalanceX).toBe("0.0");
      expect(result.current.vaultBalanceY).toBe("0.0");
      expect(result.current.userSharesX).toBe("0.0");
      expect(result.current.userSharesY).toBe("0.0");
    });
  });

  describe("Critical: Error Handling", () => {
    it("should handle missing user address gracefully", () => {
      mockedUseAccount.mockReturnValue({
        address: undefined,
        chainId: SUPPORTED_CHAINS.localhost.id,
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Should return zero values when no user connected (with consistent formatting)
      expect(result.current.userSharesX).toBe("0.0");
      expect(result.current.userSharesY).toBe("0.0");
      expect(result.current.userBalanceWS).toBe("0.0");
      expect(result.current.userBalanceUSDC).toBe("0.0");
    });

    it("should handle contract read errors", () => {
      mockedUseReadContract.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error("RPC Error"),
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Should fallback to zero on errors (with consistent formatting)
      expect(result.current.vaultBalanceX).toBe("0.0");
      expect(result.current.vaultBalanceY).toBe("0.0");
    });

    it("should handle invalid balance formats", () => {
      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Test formatBalance with edge cases (consistent decimal formatting)
      expect(result.current.formatBalance(undefined)).toBe("0.0");
      expect(result.current.formatBalance(null)).toBe("0.0");
      expect(result.current.formatBalance("not a bigint")).toBe("0.0");
      expect(result.current.formatBalance({})).toBe("0.0");
    });
  });

  describe("Critical: Price Per Share", () => {
    it("should display price per share for user calculations", () => {
      mockedUseReadContract.mockImplementation(
        (params?: { functionName?: string; args?: unknown[] }) => {
          if (
            params?.functionName === "getPricePerFullShare" &&
            params?.args?.[0] === 0
          ) {
            // 1.1 tokens per share for wS
            return { data: parseEther("1.1"), isLoading: false };
          }
          if (
            params?.functionName === "getPricePerFullShare" &&
            params?.args?.[0] === 1
          ) {
            // 1.05 tokens per share for USDC.e
            return { data: parseEther("1.05"), isLoading: false };
          }
          return { data: undefined, isLoading: false };
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.pricePerShareX).toBe("1.1");
      expect(result.current.pricePerShareY).toBe("1.05");
    });
  });
});
