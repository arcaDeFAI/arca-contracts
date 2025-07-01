import { parseEther } from "viem";
import { vi } from "vitest";
import {
  type UseAccountReturnType,
  type UseWriteContractReturnType,
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
      coingeckoId: tokenXSymbol.toLowerCase(),
    },
    tokenY: {
      symbol: tokenYSymbol,
      address: `0x${tokenYSymbol.replace(/\./g, "").padEnd(40, "1")}` as const,
      decimals: tokenYSymbol.includes("USDC") ? 6 : 18,
      coingeckoId: tokenYSymbol.toLowerCase(),
    },
    name: `${tokenXSymbol}-${tokenYSymbol}`,
    platform: "DLMM",
    chain: "Test Network",
    isActive: true,
  };
}

// Base system contracts (vault infrastructure)
export const MOCK_SYSTEM_CONTRACTS = {
  registry: "0x5678901234567890123456789012345678901234" as const,
  networkTokens: {
    rewardToken: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321" as const,
    wrappedNative: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38" as const,
  },
  metropolis: {
    lbRouter: "0x9012345678901234567890123456789012345678" as const,
    lbFactory: "0x0123456789012345678901234567890123456789" as const,
  },
  // Vault-specific contracts for testing
  queueHandler: "0x2345678901234567890123456789012345678901" as const,
  feeManager: "0x3456789012345678901234567890123456789012" as const,
  rewardClaimer: "0x4567890123456789012345678901234567890123" as const,
};

// Mock reward data for testing real reward calculations
export const MOCK_REWARD_DATA = {
  totalCompoundedX: parseEther("50"), // 50 tokens compounded for TokenX
  totalCompoundedY: parseEther("75"), // 75 tokens compounded for TokenY
  metroPrice: 2.5, // $2.50 per METRO
  dlmmFeesCollected: parseEther("25"), // 25 tokens worth of DLMM fees
};

// Legacy MOCK_CONTRACTS for backward compatibility (will be phased out)
export const MOCK_CONTRACTS = {
  ...MOCK_SYSTEM_CONTRACTS,
  tokens: {
    wS: "0x6789012345678901234567890123456789012345" as const,
    usdce: "0x7890123456789012345678901234567890123456" as const,
    metro: "0x8901234567890123456789012345678901234567" as const,
  },
};

// Token-agnostic mock data generator
export function createMockVaultData(
  vaultConfig: ReturnType<typeof createMockVaultConfig>,
) {
  return {
    // Vault balances (token-agnostic)
    vaultBalanceX: parseEther("1000"),
    vaultBalanceY: parseEther("1000"),

    // User shares (token-agnostic)
    userSharesX: parseEther("10"),
    userSharesY: parseEther("10"),

    // Price per share (token-agnostic)
    pricePerShareX: parseEther("1.1"),
    pricePerShareY: parseEther("1.05"),

    // User token balances (based on vault config)
    userBalanceX: parseEther("100"), // User balance for tokenX
    userBalanceY: parseEther("100"), // User balance for tokenY

    // Allowances (based on vault config)
    allowanceX: parseEther("1000"), // Allowance for tokenX
    allowanceY: parseEther("1000"), // Allowance for tokenY

    // Queue status
    pendingDeposits: 5n,
    pendingWithdraws: 2n,

    // Reward data from ArcaRewardClaimerV1 contract
    totalCompoundedX: MOCK_REWARD_DATA.totalCompoundedX,
    totalCompoundedY: MOCK_REWARD_DATA.totalCompoundedY,

    // Token addresses for mock resolution
    tokenXAddress: vaultConfig.tokenX.address,
    tokenYAddress: vaultConfig.tokenY.address,
    vaultAddress: vaultConfig.address,
  };
}

// Legacy MOCK_VAULT_DATA for backward compatibility (will be phased out)
export const MOCK_VAULT_DATA = {
  // Vault balances
  vaultBalanceX: parseEther("1000"),
  vaultBalanceY: parseEther("1000"),

  // User shares
  userSharesX: parseEther("10"),
  userSharesY: parseEther("10"),

  // Price per share
  pricePerShareX: parseEther("1.1"),
  pricePerShareY: parseEther("1.05"),

  // Legacy hardcoded balances (being phased out)
  userBalanceWS: parseEther("100"),
  userBalanceUSDC: parseEther("100"),
  allowanceWS: parseEther("1000"),
  allowanceUSDC: parseEther("1000"),

  // Queue status
  pendingDeposits: 5n,
  pendingWithdraws: 2n,
};

// Mock transaction responses
export const MOCK_TX_HASH =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
export const MOCK_TX_RECEIPT = {
  blockHash:
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  blockNumber: 12345678n,
  status: "success" as const,
  transactionHash: MOCK_TX_HASH,
};

// Helper to create mock read contract response
export function createMockReadContract<T>(
  data: T,
  overrides?: Record<string, unknown>,
) {
  return {
    data,
    isLoading: false as const,
    isPending: false as const,
    isError: false as const,
    isSuccess: true as const,
    isLoadingError: false as const,
    isRefetchError: false as const,
    isPlaceholderData: false as const,
    error: null,
    status: "success" as const,
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: "idle" as const,
    isFetched: true as const,
    isFetchedAfterMount: true as const,
    isFetching: false as const,
    isInitialLoading: false as const,
    isRefetching: false as const,
    isStale: false as const,
    refetch: vi.fn(),
    remove: vi.fn(),
    queryKey: ["mock-query"] as readonly unknown[],
    errorUpdateCount: 0,
    isPaused: false as const,
    promise: Promise.resolve(data),
    ...overrides,
  };
}

// Helper to create mock write contract response
export function createMockWriteContract(
  overrides: Partial<UseWriteContractReturnType> = {},
): UseWriteContractReturnType {
  const mockVariables = {
    abi: [],
    functionName: "mockFunction",
    args: [],
    address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
  };

  return {
    writeContract: vi.fn().mockResolvedValue(MOCK_TX_HASH),
    writeContractAsync: vi.fn().mockResolvedValue(MOCK_TX_HASH),
    data: MOCK_TX_HASH as `0x${string}`,
    isPending: false,
    isError: false,
    isSuccess: true,
    status: "success",
    error: null,
    failureCount: 0,
    failureReason: null,
    variables: mockVariables,
    reset: vi.fn(),
    submittedAt: Date.now(),
    context: undefined,
    isPaused: false,
    isIdle: false,
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
      data: MOCK_TX_RECEIPT,
      isLoading: false as const,
      isPending: false as const,
      isSuccess: true as const,
      isError: false as const,
      isLoadingError: false as const,
      isRefetchError: false as const,
      isPlaceholderData: false as const,
      error: null,
      status: "success" as const,
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle" as const,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isRefetching: false as const,
      isStale: false as const,
      refetch: vi.fn(),
      remove: vi.fn(),
      queryKey: ["mock-wait-for-receipt"] as readonly unknown[],
      errorUpdateCount: 0,
      isPaused: false as const,
      promise: Promise.resolve(MOCK_TX_RECEIPT),
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

// Mock vault hook data for testing
export function createMockVaultHook(
  overrides?: Partial<typeof MOCK_VAULT_DATA>,
) {
  const data = { ...MOCK_VAULT_DATA, ...overrides };

  return {
    contracts: MOCK_CONTRACTS,

    // Formatted balances (as strings)
    vaultBalanceX: parseEther("1000").toString(),
    vaultBalanceY: parseEther("1000").toString(),
    userSharesX: parseEther("10").toString(),
    userSharesY: parseEther("10").toString(),
    pricePerShareX: parseEther("1.1").toString(),
    pricePerShareY: parseEther("1.05").toString(),
    userBalanceWS: parseEther("100").toString(),
    userBalanceUSDC: parseEther("100").toString(),

    // Queue status
    pendingDeposits: "5",
    pendingWithdraws: "2",

    // Transaction state
    isWritePending: false,
    isConfirming: false,
    isConfirmed: false,
    lastOperation: null,
    hash: undefined,

    // Actions
    approveWS: vi.fn(),
    approveUSDC: vi.fn(),
    depositWS: vi.fn(),
    depositUSDC: vi.fn(),
    withdrawShares: vi.fn(),
    withdrawAll: vi.fn(),
    hasAllowance: vi.fn().mockReturnValue(true),
    formatBalance: vi.fn((val) => val?.toString() || "0"),
  };
}
