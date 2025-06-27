import { parseEther } from "viem";
import { vi } from "vitest";

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
    platform: "Arca DLMM",
    chain: "Test Network",
    isActive: true,
  };
}

// Base system contracts (vault infrastructure)
export const MOCK_SYSTEM_CONTRACTS = {
  vault: "0x1234567890123456789012345678901234567890" as const,
  queueHandler: "0x2345678901234567890123456789012345678901" as const,
  feeManager: "0x3456789012345678901234567890123456789012" as const,
  rewardClaimer: "0x4567890123456789012345678901234567890123" as const,
  registry: "0x5678901234567890123456789012345678901234" as const,
  metropolis: {
    lbRouter: "0x9012345678901234567890123456789012345678" as const,
    lbFactory: "0x0123456789012345678901234567890123456789" as const,
    pool: "0x1234567890123456789012345678901234567890" as const,
  },
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
export function createMockReadContract(data: any) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

// Helper to create mock write contract response
export function createMockWriteContract() {
  return {
    writeContract: vi.fn().mockResolvedValue(MOCK_TX_HASH),
    data: MOCK_TX_HASH,
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  };
}

// Helper to create mock wait for transaction receipt
export function createMockWaitForTransactionReceipt(isConfirming = false) {
  return {
    data: isConfirming ? undefined : MOCK_TX_RECEIPT,
    isLoading: isConfirming,
    isSuccess: !isConfirming,
    isError: false,
    error: null,
  };
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
