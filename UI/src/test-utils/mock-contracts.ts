import { parseEther } from "viem";
import { vi } from "vitest";
import {
  type UseAccountReturnType,
  type UseWriteContractReturnType,
  type UseReadContractsReturnType,
} from "wagmi";
import { SUPPORTED_CHAINS } from "../config/chains";

// Token-agnostic mock contract factory
export function createMockVaultConfig(
  tokenXSymbol: string,
  tokenYSymbol: string,
  vaultAddress = "0x1234567890123456789012345678901234567890",
) {
  return {
    address: vaultAddress,
    tokenX: {
      symbol: tokenXSymbol,
      address: `0x${tokenXSymbol.replace(/\./g, "").padEnd(40, "0")}` as const,
      decimals: 18,
    },
    tokenY: {
      symbol: tokenYSymbol,
      address: `0x${tokenYSymbol.replace(/\./g, "").padEnd(40, "1")}` as const,
      decimals: 18,
    },
    name: `Arca ${tokenXSymbol}-${tokenYSymbol} Vault`,
    platform: "DLMM" as const,
    chain: "Localhost" as const,
    isActive: true,
  };
}

// Token-agnostic mock vault data
export function createMockVaultData(
  vaultConfig: ReturnType<typeof createMockVaultConfig>,
) {
  return {
    vaultBalanceX: parseEther("1000"), // 1000 TokenX
    vaultBalanceY: parseEther("1000"), // 1000 TokenY
    userSharesX: parseEther("10"), // 10 shares TokenX
    userSharesY: parseEther("10"), // 10 shares TokenY
    pricePerShareX: parseEther("1.1"), // 1.1 tokens per share
    pricePerShareY: parseEther("1.05"), // 1.05 tokens per share
    userBalanceX: parseEther("100"), // User has 100 TokenX
    userBalanceY: parseEther("100"), // User has 100 TokenY
    allowanceX: parseEther("1000"), // High allowance
    allowanceY: parseEther("1000"), // High allowance
    pendingDeposits: 5n,
    pendingWithdraws: 2n,
    totalCompoundedX: parseEther("50"), // 50 TokenX compounded
    totalCompoundedY: parseEther("75"), // 75 TokenY compounded
  };
}

// Mock system contracts
export const MOCK_SYSTEM_CONTRACTS = {
  registry: "0x9876543210987654321098765432109876543210",
  rewardClaimer: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
  queueHandler: "0x1234567890ABCDEF1234567890ABCDEF12345678",
  feeManager: "0xFEEDFACEFEEDFACEFEEDFACEFEEDFACEFEEDFACE",
};

// Mock deployment addresses matching the DeploymentAddresses interface
export const MOCK_DEPLOYMENT_ADDRESSES = {
  registry: MOCK_SYSTEM_CONTRACTS.registry,
  networkTokens: {
    rewardToken: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321", // METRO
    wrappedNative: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS
  },
  metropolis: {
    lbRouter: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    lbFactory: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  },
};

// Create token-agnostic mock contracts
export const createMockContracts = (
  vaultConfig: ReturnType<typeof createMockVaultConfig>,
) => ({
  vault: vaultConfig.address,
  registry: MOCK_SYSTEM_CONTRACTS.registry,
  tokens: {
    [vaultConfig.tokenX.symbol]: vaultConfig.tokenX.address,
    [vaultConfig.tokenY.symbol]: vaultConfig.tokenY.address,
  },
  rewardClaimer: MOCK_SYSTEM_CONTRACTS.rewardClaimer,
  queueHandler: MOCK_SYSTEM_CONTRACTS.queueHandler,
  feeManager: MOCK_SYSTEM_CONTRACTS.feeManager,
});

// Mock transaction hash
export const MOCK_TX_HASH =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

// Helper to create mock contract read response
export function createMockReadContract<T = unknown>(
  data: T,
  overrides: Partial<{
    isError: boolean;
    isLoading: boolean;
    error: Error | null;
  }> = {},
) {
  return {
    data,
    isError: false,
    isLoading: false,
    error: null,
    isPending: false,
    isLoadingError: false,
    isRefetchError: false,
    isSuccess: data !== undefined,
    status: data !== undefined ? "success" : "idle",
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: "idle",
    isFetched: data !== undefined,
    isFetchedAfterMount: data !== undefined,
    isFetching: false,
    isInitialLoading: false,
    isRefetching: false,
    isStale: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
    queryKey: ["mock-read-contract"],
    errorUpdateCount: 0,
    isPaused: false,
    promise: Promise.resolve(data),
    ...overrides,
  };
}

// Helper to create mock write contract return
export function createMockWriteContract(
  overrides: Partial<UseWriteContractReturnType> & {
    writeContract?: ReturnType<typeof vi.fn>;
  } = {},
): UseWriteContractReturnType {
  const mockWriteContract = overrides.writeContract || vi.fn();
  const mockWriteContractAsync = vi.fn().mockResolvedValue(MOCK_TX_HASH);
  const mockVariables = undefined;

  return {
    writeContract: mockWriteContract,
    writeContractAsync: mockWriteContractAsync,
    data: overrides.data || undefined,
    isPending: overrides.isPending || false,
    isSuccess: overrides.isSuccess || false,
    isError: overrides.isError || false,
    isIdle: overrides.isIdle !== undefined ? overrides.isIdle : !overrides.data,
    error: null,
    variables: mockVariables,
    reset: vi.fn(),
    context: undefined,
    status: overrides.status || (overrides.data ? "success" : "idle"),
    submittedAt: overrides.data ? Date.now() : 0,
    isPaused: false,
    failureCount: 0,
    failureReason: null,
    ...overrides,
  } as UseWriteContractReturnType;
}

// Helper to create mock wait for transaction receipt
export function createMockWaitForTransactionReceipt(isConfirming = false) {
  if (isConfirming) {
    return {
      data: undefined,
      isLoading: true as const,
      isPending: true as const,
      isSuccess: false as const,
      isError: false as const,
      isLoadingError: false as const,
      isRefetchError: false as const,
      isPlaceholderData: false as const,
      error: null,
      status: "pending" as const,
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: "fetching" as const,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isInitialLoading: true,
      isRefetching: false as const,
      isStale: false as const,
      refetch: vi.fn(),
      remove: vi.fn(),
      queryKey: ["mock-wait-for-receipt"] as readonly unknown[],
      errorUpdateCount: 0,
      isPaused: false as const,
      promise: Promise.resolve(undefined),
    };
  } else {
    return {
      data: undefined,
      isLoading: false as const,
      isPending: false as const,
      isSuccess: false as const,
      isError: false as const,
      isLoadingError: false as const,
      isRefetchError: false as const,
      isPlaceholderData: false as const,
      error: null,
      status: "idle" as const,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle" as const,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: false,
      isInitialLoading: false,
      isRefetching: false as const,
      isStale: false as const,
      refetch: vi.fn(),
      remove: vi.fn(),
      queryKey: ["mock-wait-for-receipt"] as readonly unknown[],
      errorUpdateCount: 0,
      isPaused: false as const,
      promise: Promise.resolve(undefined),
    };
  }
}

// Helper to create mock UseAccount return
export function createMockUseAccount(
  address?: string,
  chainId: number = SUPPORTED_CHAINS.localhost.id,
): UseAccountReturnType {
  // Let's try "reconnecting" since that's what TypeScript keeps suggesting
  if (address) {
    return {
      address: address as `0x${string}`,
      addresses: [address as `0x${string}`] as readonly `0x${string}`[],
      chain: undefined,
      chainId: chainId,
      connector: undefined,
      status: "reconnecting",
      isConnecting: false,
      isReconnecting: true,
      isConnected: false,
      isDisconnected: false,
    };
  } else {
    return {
      address: undefined,
      addresses: undefined,
      chain: undefined,
      chainId: chainId,
      connector: undefined,
      status: "reconnecting",
      isConnecting: false,
      isReconnecting: true,
      isConnected: false,
      isDisconnected: false,
    };
  }
}

// Helper to create mock useReadContracts return
export function createMockUseReadContracts(
  data: { result: unknown }[],
  overrides: Partial<UseReadContractsReturnType> = {},
): UseReadContractsReturnType {
  return {
    data,
    isLoading: false,
    isPending: false,
    isSuccess: true,
    isError: false,
    error: null,
    status: "success",
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: "idle",
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isInitialLoading: false,
    isRefetching: false,
    isStale: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
    queryKey: ["mock-read-contracts"],
    errorUpdateCount: 0,
    isPaused: false,
    isLoadingError: false,
    isRefetchError: false,
    ...overrides,
  } as UseReadContractsReturnType;
}
