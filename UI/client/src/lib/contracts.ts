// Contract addresses - User-specified addresses
export const METRO_STRATEGY_ADDRESS = "0x57dcA246675137A30e91fDed19edf0CBB8708C3e";
export const METRO_VAULT_ADDRESS = "0xEA5111b3a433622aF19db31743E9C4833909094A";
export const SHADOW_VAULT_ADDRESS = "0xe3cc55e29cfa3204b810ed38be11949a91022d6b";
export const SHADOW_STRATEGY_ADDRESS = "0x874af7e836edad19fc09a777cf2c8d7e676f1d2a";

// Add CONTRACT_ADDRESS export for compatibility
export const CONTRACT_ADDRESS = {
  METRO_STRATEGY: METRO_STRATEGY_ADDRESS,
  METRO_VAULT: METRO_VAULT_ADDRESS,
  SHADOW_VAULT: SHADOW_VAULT_ADDRESS,
  SHADOW_STRATEGY: SHADOW_STRATEGY_ADDRESS,
} as const;

// Add CONTRACT_ADDRESSES export for compatibility (plural version)
export const CONTRACT_ADDRESSES = {
  ...CONTRACT_ADDRESS,
  strategies: {
    "S/USDC": METRO_STRATEGY_ADDRESS,
    "S-scUSD": SHADOW_STRATEGY_ADDRESS,
  },
  vaults: {
    "S/USDC": METRO_VAULT_ADDRESS,
    "S/USDC/CL": SHADOW_VAULT_ADDRESS,
    "S-scUSD": SHADOW_VAULT_ADDRESS,
  }
} as const;

// Standard ERC20 ABI for token operations
export const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

// Vault Strategy ABI for Metropolis vaults
export const VAULT_STRATEGY_ABI = [
  {
    inputs: [],
    name: "getVault",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [],
    name: "getTokenX",
    outputs: [{ internalType: "contract IERC20Upgradeable", name: "", type: "address" }],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [],
    name: "getTokenY",
    outputs: [{ internalType: "contract IERC20Upgradeable", name: "", type: "address" }],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [],
    name: "getRange",
    outputs: [
      { internalType: "uint24", name: "lower", type: "uint24" },
      { internalType: "uint24", name: "upper", type: "uint24" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getBalances",
    outputs: [
      { internalType: "uint256", name: "amountX", type: "uint256" },
      { internalType: "uint256", name: "amountY", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

// Shadow Strategy ABI for Shadow vaults
export const SHADOW_STRATEGY_ABI = [
  {
    inputs: [],
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "vault",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getBalances",
    outputs: [
      { internalType: "uint256", name: "balance0", type: "uint256" },
      { internalType: "uint256", name: "balance1", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

// Vault ABI for vault operations
export const VAULT_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// Shadow Vault ABI for Shadow vault operations
export const SHADOW_VAULT_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getStrategy",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getBalances",
    outputs: [
      { internalType: "uint256", name: "amountX", type: "uint256" },
      { internalType: "uint256", name: "amountY", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

// Token addresses for common tokens
export const TOKEN_ADDRESSES = {
  USDC: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0",
  TEST1: "0x46e6B680eBae63e086e6D820529Aed187465aeDA", 
  TEST2: "0xFc00C80b0000007B73004EDb00094CaD80626D8D",
  FUNKY1: "0x1DD9f2cCD4b48a274938E88E205516FF3eF6720C",
  S: "0x1DD9f2cCD4b48a274938E88E205516FF3eF6720C", // Shadow token
} as const;

// Fight Pool ABI for LBP operations and TVL calculations
export const FIGHT_POOL_ABI = [
  {
    inputs: [],
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token1", 
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "liquidity",
    outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { internalType: "uint160", name: "sqrtPriceX96", type: "uint160" },
      { internalType: "int24", name: "tick", type: "int24" },
      { internalType: "uint16", name: "observationIndex", type: "uint16" },
      { internalType: "uint16", name: "observationCardinality", type: "uint16" },
      { internalType: "uint16", name: "observationCardinalityNext", type: "uint16" },
      { internalType: "uint8", name: "feeProtocol", type: "uint8" },
      { internalType: "bool", name: "unlocked", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "fee",
    outputs: [{ internalType: "uint24", name: "", type: "uint24" }],
    stateMutability: "view",
    type: "function"
  }
] as const;