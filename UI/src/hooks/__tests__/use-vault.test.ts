import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { parseEther, formatEther } from "viem";
import type * as wagmi from "wagmi";
import * as contractsModule from "../../lib/contracts";
import * as vaultConfigsModule from "../../lib/vault-configs";
import { useVault } from "../use-vault";
import { TestProviders } from "../../test-utils/test-providers";
import { SUPPORTED_CHAINS } from "../../config/chains";
import {
  MOCK_SYSTEM_CONTRACTS,
  MOCK_DEPLOYMENT_ADDRESSES,
  MOCK_TX_HASH,
  createMockReadContract,
  createMockWriteContract,
  createMockWaitForTransactionReceipt,
  createMockUseAccount,
  createMockVaultConfig,
  createMockVaultData,
} from "../../test-utils/mock-contracts";
import { useVaultRegistry } from "../use-vault-registry";

// Create mocked functions
const mockedUseAccount = vi.fn();
const mockedUseReadContract = vi.fn();
const mockedUseWriteContract = vi.fn();
const mockedUseWaitForTransactionReceipt = vi.fn();

// Mock wagmi hooks
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

// Mock the vault configs module - setup after imports
vi.mock("../../lib/vault-configs", () => ({
  getVaultConfig: vi.fn(),
  getActiveVaultConfigs: vi.fn(),
  getVaultConfigsByChain: vi.fn(),
  getVaultConfigByTokens: vi.fn(),
  createVaultConfigFromRegistry: vi.fn(),
}));

// Mock the vault registry hook
vi.mock("../use-vault-registry", () => ({
  useVaultRegistry: vi.fn(() => ({
    vaults: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Using the mocked functions defined above

describe("🎯 TDD: Token-Agnostic useVault Hook", () => {
  // Test different token pairs to ensure true token-agnostic behavior
  const testVaultConfigs = [
    { tokenX: "wS", tokenY: "USDC.e", description: "Sonic-USDC vault" },
    { tokenX: "wS", tokenY: "METRO", description: "Sonic-Metro vault" },
    { tokenX: "METRO", tokenY: "USDC", description: "Metro-USDC vault" },
    { tokenX: "ALPHA", tokenY: "BETA", description: "Arbitrary token vault" },
  ];

  let currentVaultConfig: ReturnType<typeof createMockVaultConfig>;
  let currentMockData: ReturnType<typeof createMockVaultData>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default to first test config
    currentVaultConfig = createMockVaultConfig(
      testVaultConfigs[0].tokenX,
      testVaultConfigs[0].tokenY,
    );
    currentMockData = createMockVaultData(currentVaultConfig);

    // Mock the vault registry to return current vault
    vi.mocked(useVaultRegistry).mockReturnValue({
      vaults: [
        {
          vault: currentVaultConfig.address,
          tokenX: currentVaultConfig.tokenX.address,
          tokenY: currentVaultConfig.tokenY.address,
          name: currentVaultConfig.name,
          symbol: "ARCA-V1",
          isActive: true,
          queueHandler: MOCK_SYSTEM_CONTRACTS.queueHandler,
          rewardClaimer: MOCK_SYSTEM_CONTRACTS.rewardClaimer,
          feeManager: MOCK_SYSTEM_CONTRACTS.feeManager,
        },
      ],
      isLoading: false,
      error: null,
      registryAddress: MOCK_SYSTEM_CONTRACTS.registry,
    });

    // Mock createVaultConfigFromRegistry to return the current config
    vi.mocked(
      vaultConfigsModule.createVaultConfigFromRegistry,
    ).mockImplementation((vaultInfo, chainId) => {
      return currentVaultConfig;
    });

    // Set default mock implementations
    mockedUseAccount.mockReturnValue({
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      chainId: SUPPORTED_CHAINS.localhost.id,
    });

    mockedUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockedUseWriteContract.mockReturnValue({
      writeContract: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    });

    mockedUseWaitForTransactionReceipt.mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
    });

    // Mock the getContracts function to handle supported/unsupported chains
    vi.mocked(contractsModule.getContracts).mockImplementation(
      (chainId: number) => {
        // Business Requirement: Return null for unsupported chains (graceful failure)
        const supportedChainIds: number[] = Object.values(SUPPORTED_CHAINS).map(
          (chain) => chain.id,
        );
        if (!supportedChainIds.includes(chainId)) {
          return null;
        }

        // Return contracts for supported chains
        return MOCK_DEPLOYMENT_ADDRESSES;
      },
    );

    // Mock the vault config lookup to return current test config
    vi.mocked(vaultConfigsModule.getVaultConfig).mockReturnValue(
      currentVaultConfig,
    );
  });

  // Helper to set up specific vault config for a test
  function setupVaultConfig(tokenX: string, tokenY: string) {
    currentVaultConfig = createMockVaultConfig(tokenX, tokenY);
    currentMockData = createMockVaultData(currentVaultConfig);
    vi.mocked(vaultConfigsModule.getVaultConfig).mockReturnValue(
      currentVaultConfig,
    );

    // Update vault registry mock
    vi.mocked(useVaultRegistry).mockReturnValue({
      vaults: [
        {
          vault: currentVaultConfig.address,
          tokenX: currentVaultConfig.tokenX.address,
          tokenY: currentVaultConfig.tokenY.address,
          name: currentVaultConfig.name,
          symbol: "ARCA-V1",
          isActive: true,
          queueHandler: MOCK_SYSTEM_CONTRACTS.queueHandler,
          rewardClaimer: MOCK_SYSTEM_CONTRACTS.rewardClaimer,
          feeManager: MOCK_SYSTEM_CONTRACTS.feeManager,
        },
      ],
      isLoading: false,
      error: null,
      registryAddress: MOCK_SYSTEM_CONTRACTS.registry,
    });

    // Update createVaultConfigFromRegistry mock
    vi.mocked(
      vaultConfigsModule.createVaultConfigFromRegistry,
    ).mockImplementation((vaultInfo, chainId) => {
      return currentVaultConfig;
    });
  }

  describe("🎯 TDD: Contract Data Reading (Token-Agnostic)", () => {
    it("should return formatted vault balances for any token pair", () => {
      // Mock vault balance queries using current vault config
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          const args = params?.args;
          if (functionName === "tokenBalance") {
            if (args?.[0] === 0)
              return createMockReadContract(currentMockData.vaultBalanceX);
            if (args?.[0] === 1)
              return createMockReadContract(currentMockData.vaultBalanceY);
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.vaultBalanceX).toBe("1000.0");
      expect(result.current.vaultBalanceY).toBe("1000.0");
      // Verify token symbols come from vault config
      expect(result.current.tokenXSymbol).toBe(
        currentVaultConfig.tokenX.symbol,
      );
      expect(result.current.tokenYSymbol).toBe(
        currentVaultConfig.tokenY.symbol,
      );
    });

    // TDD: Test that the system works with multiple different token pairs
    testVaultConfigs.forEach(({ tokenX, tokenY, description }) => {
      it(`should handle vault balances for ${description} (${tokenX}-${tokenY})`, () => {
        setupVaultConfig(tokenX, tokenY);

        // Mock vault balance queries using current vault config
        mockedUseReadContract.mockImplementation(
          (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
            const functionName = params?.functionName;
            const args = params?.args;
            if (functionName === "tokenBalance") {
              if (args?.[0] === 0)
                return createMockReadContract(currentMockData.vaultBalanceX);
              if (args?.[0] === 1)
                return createMockReadContract(currentMockData.vaultBalanceY);
            }
            return createMockReadContract(undefined);
          },
        );

        const { result } = renderHook(
          () => useVault(currentVaultConfig.address),
          {
            wrapper: TestProviders,
          },
        );

        // Should work regardless of token pair
        expect(result.current.vaultBalanceX).toBe("1000.0");
        expect(result.current.vaultBalanceY).toBe("1000.0");
        expect(result.current.tokenXSymbol).toBe(tokenX);
        expect(result.current.tokenYSymbol).toBe(tokenY);
      });
    });

    it("should return user share balances", () => {
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          const args = params?.args;
          if (functionName === "getShares") {
            if (args?.[1] === 0)
              return createMockReadContract(currentMockData.userSharesX);
            if (args?.[1] === 1)
              return createMockReadContract(currentMockData.userSharesY);
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.userSharesX).toBe("10.0");
    });

    it("should calculate price per share correctly", () => {
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          const args = params?.args;
          if (functionName === "getPricePerFullShare") {
            if (args?.[0] === 0)
              return createMockReadContract(currentMockData.pricePerShareX);
            if (args?.[0] === 1)
              return createMockReadContract(currentMockData.pricePerShareY);
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.pricePerShareX).toBe("1.1");
    });

    it("should return user token balances", () => {
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          const address = params?.address;
          if (functionName === "balanceOf") {
            if (address === currentVaultConfig.tokenX.address)
              return createMockReadContract(currentMockData.userBalanceX);
            if (address === currentVaultConfig.tokenY.address)
              return createMockReadContract(currentMockData.userBalanceY);
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.userBalanceX).toBe("100.0"); // Token-agnostic: userBalanceX for any tokenX
    });

    it("should handle loading states correctly", () => {
      mockedUseReadContract.mockReturnValue({
        ...createMockReadContract(undefined),
        isLoading: true,
        isPending: true,
        isSuccess: false,
        status: "pending",
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.vaultBalanceX).toBe("0.0"); // Consistent formatting
      expect(result.current.vaultBalanceY).toBe("0.0");
    });

    it("should handle error states gracefully", () => {
      mockedUseReadContract.mockReturnValue({
        ...createMockReadContract(undefined),
        isError: true,
        isSuccess: false,
        status: "error",
        isRefetchError: true,
        error: {
          name: "ContractFunctionExecutionError",
          message: "Contract read failed",
          abi: [],
          functionName: "testFunction",
          details: "Contract read failed",
          shortMessage: "Contract read failed",
          version: "1.0.0",
          walk: vi.fn(),
          cause: {
            name: "ContractFunctionRevertedError",
            message: "Contract read failed",
            details: "Contract read failed",
            shortMessage: "Contract read failed",
            version: "1.0.0",
            walk: vi.fn(),
          },
        },
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.vaultBalanceX).toBe("0.0"); // Consistent formatting
      expect(result.current.userSharesX).toBe("0.0");
    });
  });

  describe("🎯 TDD: Token-Agnostic Deposit Operations", () => {
    it("should approve and deposit tokenX for any token pair", async () => {
      const mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH);

      mockedUseWriteContract.mockReturnValue({
        ...createMockWriteContract(),
        writeContract: mockWriteContract,
      });

      mockedUseWaitForTransactionReceipt.mockReturnValue(
        createMockWaitForTransactionReceipt(false),
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Test approval (uses tokenX address from vault config)
      await result.current.approveTokenX("100");

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: currentVaultConfig.tokenX.address, // Dynamic token address
        abi: expect.any(Array),
        functionName: "approve",
        args: [currentVaultConfig.address, parseEther("100")],
      });

      // Test deposit (token-agnostic with token index)
      await result.current.depositTokenX("100");

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: currentVaultConfig.address,
        abi: expect.any(Array),
        functionName: "depositToken",
        args: [parseEther("100"), 0], // 0 = tokenX index
      });
    });

    // TDD: Test deposit operations with different token pairs
    testVaultConfigs.slice(0, 2).forEach(({ tokenX, tokenY, description }) => {
      it(`should handle deposits for ${description} (${tokenX}-${tokenY})`, async () => {
        setupVaultConfig(tokenX, tokenY);

        const mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH);
        mockedUseWriteContract.mockReturnValue({
          ...createMockWriteContract(),
          writeContract: mockWriteContract,
        });

        const { result } = renderHook(
          () => useVault(currentVaultConfig.address),
          {
            wrapper: TestProviders,
          },
        );

        // Test tokenY deposit
        await result.current.depositTokenY("50");

        expect(mockWriteContract).toHaveBeenCalledWith({
          address: currentVaultConfig.address,
          abi: expect.any(Array),
          functionName: "depositToken",
          args: [parseEther("50"), 1], // 1 = tokenY index
        });

        // Verify correct token symbols are available
        expect(result.current.tokenXSymbol).toBe(tokenX);
        expect(result.current.tokenYSymbol).toBe(tokenY);
      });
    });

    it("should check allowance before deposit (token-agnostic)", () => {
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          if (functionName === "allowance") {
            return createMockReadContract(parseEther("50"));
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Should have allowance for 50 tokens (using token index)
      expect(result.current.hasAllowance(0, "50")).toBe(true); // tokenX = index 0
      expect(result.current.hasAllowance(0, "100")).toBe(false); // insufficient allowance
      expect(result.current.hasAllowance(1, "50")).toBe(true); // tokenY = index 1
    });

    it("should approve and deposit tokenY (second token)", async () => {
      const mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH);

      mockedUseWriteContract.mockReturnValue({
        ...createMockWriteContract(),
        writeContract: mockWriteContract,
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Test tokenY approval and deposit
      await result.current.approveTokenY("250");
      await result.current.depositTokenY("250");

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: currentVaultConfig.tokenY.address, // Use dynamic address from vault config
        abi: expect.any(Array),
        functionName: "approve",
        args: [currentVaultConfig.address, parseEther("250")],
      });

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: currentVaultConfig.address, // Use dynamic vault address
        abi: expect.any(Array),
        functionName: "depositToken",
        args: [parseEther("250"), 1], // 1 = tokenY index
      });
    });

    it("should handle deposit transaction states", async () => {
      mockedUseWriteContract.mockReturnValue(
        createMockWriteContract({
          writeContract: vi.fn().mockResolvedValue(MOCK_TX_HASH),
          data: undefined,
          isPending: true,
          isSuccess: false,
          status: "pending",
        }),
      );

      mockedUseWaitForTransactionReceipt.mockReturnValue(
        createMockWaitForTransactionReceipt(true),
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.isWritePending).toBe(true);
      expect(result.current.isConfirming).toBe(true);
      expect(result.current.isConfirmed).toBe(false);
    });
  });

  describe("Withdraw Operations", () => {
    it("should withdraw shares correctly (token-agnostic)", async () => {
      const mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH);

      mockedUseWriteContract.mockReturnValue({
        ...createMockWriteContract(),
        writeContract: mockWriteContract,
      });

      // Note: Using existing beforeEach setup for contracts and vault config

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      await act(async () => {
        await result.current.withdrawShares("5", "5");
      });

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: currentVaultConfig.address, // Use dynamic vault address
        abi: expect.any(Array),
        functionName: "withdrawTokenShares", // Match actual implementation
        args: [[parseEther("5"), parseEther("5")]], // Array parameter for shares
      });

      expect(result.current.lastOperation).toBe("withdraw");
    });

    it("should handle withdrawAll operation", async () => {
      const mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH);

      mockedUseWriteContract.mockReturnValue({
        ...createMockWriteContract(),
        writeContract: mockWriteContract,
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      await result.current.withdrawAll();

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: currentVaultConfig.address, // Use dynamic vault address
        abi: expect.any(Array),
        functionName: "withdrawAll",
      });
    });
  });

  describe("Token-Agnostic Validation Functions", () => {
    it("should validate balance correctly for both tokens", () => {
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          if (functionName === "balanceOf") {
            return createMockReadContract(parseEther("100")); // User has 100 tokens
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Validate sufficient balance
      expect(result.current.validateBalance(0, "50")).toBe(true); // tokenX: 50 <= 100
      expect(result.current.validateBalance(1, "100")).toBe(true); // tokenY: 100 <= 100

      // Validate insufficient balance
      expect(result.current.validateBalance(0, "150")).toBe(false); // tokenX: 150 > 100
      expect(result.current.validateBalance(1, "200")).toBe(false); // tokenY: 200 > 100
    });

    it("should validate connection correctly", () => {
      mockedUseAccount.mockReturnValue(
        createMockUseAccount(
          "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          SUPPORTED_CHAINS.localhost.id,
        ),
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.validateConnection()).toBe(true);
    });

    it("should return false for validateConnection when no user address", () => {
      mockedUseAccount.mockReturnValue(
        createMockUseAccount(undefined, SUPPORTED_CHAINS.localhost.id),
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.validateConnection()).toBe(false);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle missing user address", () => {
      mockedUseAccount.mockReturnValue(
        createMockUseAccount(undefined, SUPPORTED_CHAINS.localhost.id),
      );

      // Mock contract queries to return undefined when no user address
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          return createMockReadContract(undefined); // No data when no user
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Should return zero values when no user connected (token-agnostic)
      expect(result.current.userSharesX).toBe("0.0");
      expect(result.current.userSharesY).toBe("0.0");
      expect(result.current.userBalanceX).toBe("0.0");
      expect(result.current.userBalanceY).toBe("0.0");
    });

    it("should handle unsupported chain", () => {
      mockedUseAccount.mockReturnValue(
        createMockUseAccount("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 1), // Ethereum mainnet - not supported
      );

      // Mock vault registry to return empty vaults for unsupported chain
      vi.mocked(useVaultRegistry).mockReturnValue({
        vaults: [],
        isLoading: false,
        error: null,
        registryAddress: undefined,
      });

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // When on unsupported chain, vaultConfig should be null
      expect(result.current.vaultConfig).toBeNull();
    });

    it("should format balance with various bigint values", () => {
      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.formatBalance(parseEther("1.5"))).toBe("1.5");
      expect(result.current.formatBalance(parseEther("0.000001"))).toBe(
        "0.000001",
      );
      expect(result.current.formatBalance(0n)).toBe("0.0");
      expect(result.current.formatBalance(undefined)).toBe("0.0");
      expect(result.current.formatBalance("not a bigint")).toBe("0.0");
    });

    it("should handle zero allowance correctly", () => {
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          if (functionName === "allowance") {
            return createMockReadContract(0n);
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.hasAllowance(0, "0.000001")).toBe(false); // tokenX = index 0
      expect(result.current.hasAllowance(1, "100")).toBe(false); // tokenY = index 1
    });
  });

  describe("Queue Status", () => {
    it("should return queue status as strings", () => {
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          if (functionName === "getPendingDepositsCount") {
            return createMockReadContract(3n); // Return count directly
          }
          if (functionName === "getPendingWithdrawsCount") {
            return createMockReadContract(2n); // Return count directly
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.pendingDeposits).toBe("3");
      expect(result.current.pendingWithdraws).toBe("2");
    });

    it("should handle missing queue data", () => {
      mockedUseReadContract.mockImplementation(() =>
        createMockReadContract(undefined),
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      expect(result.current.pendingDeposits).toBe("0");
      expect(result.current.pendingWithdraws).toBe("0");
    });
  });

  describe("🎯 TDD: Real Reward Data Integration", () => {
    it("should read total compounded rewards from ArcaRewardClaimerV1 contract", () => {
      // BUSINESS REQUIREMENT: Read real reward data from reward claimer contract
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          const args = params?.args;
          const address = params?.address;
          // Mock reward claimer contract calls
          if (address === MOCK_SYSTEM_CONTRACTS.rewardClaimer) {
            if (functionName === "getTotalCompounded") {
              if (args?.[0] === 0) {
                // TokenX rewards
                return createMockReadContract(currentMockData.totalCompoundedX);
              }
              if (args?.[0] === 1) {
                // TokenY rewards
                return createMockReadContract(currentMockData.totalCompoundedY);
              }
            }
          }

          // Mock vault contract calls (required for basic vault functionality)
          if (address === currentVaultConfig.address) {
            if (functionName === "tokenBalance") {
              if (args?.[0] === 0)
                return createMockReadContract(currentMockData.vaultBalanceX);
              if (args?.[0] === 1)
                return createMockReadContract(currentMockData.vaultBalanceY);
            }
            if (functionName === "getShares") {
              if (args?.[1] === 0)
                return createMockReadContract(currentMockData.userSharesX);
              if (args?.[1] === 1)
                return createMockReadContract(currentMockData.userSharesY);
            }
            if (functionName === "getPricePerFullShare") {
              if (args?.[0] === 0)
                return createMockReadContract(currentMockData.pricePerShareX);
              if (args?.[0] === 1)
                return createMockReadContract(currentMockData.pricePerShareY);
            }
          }

          // Mock token contract calls (required for user balances and allowances)
          if (address === currentVaultConfig.tokenX.address) {
            if (functionName === "balanceOf")
              return createMockReadContract(currentMockData.userBalanceX);
            if (functionName === "allowance")
              return createMockReadContract(currentMockData.allowanceX);
          }
          if (address === currentVaultConfig.tokenY.address) {
            if (functionName === "balanceOf")
              return createMockReadContract(currentMockData.userBalanceY);
            if (functionName === "allowance")
              return createMockReadContract(currentMockData.allowanceY);
          }

          // Mock queue handler calls
          if (address === MOCK_SYSTEM_CONTRACTS.queueHandler) {
            if (functionName === "getPendingDepositsCount")
              return createMockReadContract(currentMockData.pendingDeposits);
            if (functionName === "getPendingWithdrawsCount")
              return createMockReadContract(currentMockData.pendingWithdraws);
          }

          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Should provide formatted reward data
      expect(result.current.totalCompoundedX).toBe("50.0"); // 50 tokens compounded
      expect(result.current.totalCompoundedY).toBe("75.0"); // 75 tokens compounded
    });

    it("should handle reward claimer contract unavailable gracefully", () => {
      // BUSINESS REQUIREMENT: Graceful fallback when reward claimer unavailable
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const address = params?.address;
          if (address === MOCK_SYSTEM_CONTRACTS.rewardClaimer) {
            return createMockReadContract(undefined, {
              isError: true,
              error: new Error("Contract not found"),
            });
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Should return default values when reward claimer unavailable
      expect(result.current.totalCompoundedX).toBe("0.0");
      expect(result.current.totalCompoundedY).toBe("0.0");
      expect(result.current.rewardDataAvailable).toBe(false);
    });

    it("should provide reward claimer contract address from registry", () => {
      // BUSINESS REQUIREMENT: Get reward claimer address dynamically from registry
      mockedUseReadContract.mockImplementation(
        (params: Parameters<typeof wagmi.useReadContract>[0] | undefined) => {
          const functionName = params?.functionName;
          const address = params?.address;
          if (
            address === MOCK_SYSTEM_CONTRACTS.registry &&
            functionName === "getVaultInfo"
          ) {
            return createMockReadContract({
              vault: currentVaultConfig.address,
              rewardClaimer: MOCK_SYSTEM_CONTRACTS.rewardClaimer,
              queueHandler: MOCK_SYSTEM_CONTRACTS.queueHandler,
              feeManager: MOCK_SYSTEM_CONTRACTS.feeManager,
              tokenX: currentVaultConfig.tokenX.address,
              tokenY: currentVaultConfig.tokenY.address,
              name: currentVaultConfig.name,
              symbol: currentVaultConfig.name,
              deploymentTimestamp: BigInt(Date.now()),
              deployer: "0x1234567890123456789012345678901234567890",
              isActive: true,
              isProxy: true,
            });
          }
          return createMockReadContract(undefined);
        },
      );

      const { result } = renderHook(
        () => useVault(currentVaultConfig.address),
        {
          wrapper: TestProviders,
        },
      );

      // Should expose reward claimer address for other hooks to use
      expect(result.current.rewardClaimerAddress).toBe(
        MOCK_SYSTEM_CONTRACTS.rewardClaimer,
      );
    });

    it("should support any token pair for reward data (token-agnostic)", () => {
      // TDD: Test reward system works with different token pairs
      testVaultConfigs
        .slice(0, 2)
        .forEach(({ tokenX, tokenY, description }) => {
          setupVaultConfig(tokenX, tokenY);

          mockedUseReadContract.mockImplementation(
            (
              params: Parameters<typeof wagmi.useReadContract>[0] | undefined,
            ) => {
              const functionName = params?.functionName;
              const args = params?.args;
              const address = params?.address;
              if (
                address === MOCK_SYSTEM_CONTRACTS.rewardClaimer &&
                functionName === "getTotalCompounded"
              ) {
                return createMockReadContract(parseEther("100")); // Same reward amount regardless of token pair
              }
              return createMockReadContract(undefined);
            },
          );

          const { result } = renderHook(
            () => useVault(currentVaultConfig.address),
            {
              wrapper: TestProviders,
            },
          );

          // Reward system should work with any token pair
          expect(result.current.totalCompoundedX).toBe("100.0");
          expect(result.current.totalCompoundedY).toBe("100.0");
          expect(result.current.tokenXSymbol).toBe(tokenX);
          expect(result.current.tokenYSymbol).toBe(tokenY);
        });
    });
  });
});
