// Contract addresses for Arca Vault system
export const CONTRACTS = {
  // Sonic Mainnet addresses (to be updated when deployed)
  146: {
    vault: "0x0000000000000000000000000000000000000000", // TODO: Update with mainnet deployment
    feeManager: "0x0000000000000000000000000000000000000000",
    queueHandler: "0x0000000000000000000000000000000000000000",
    rewardClaimer: "0x0000000000000000000000000000000000000000",
    registry: "0x0000000000000000000000000000000000000000",
    tokens: {
      wS: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
      usdce: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
      metro: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321",
    },
    metropolis: {
      lbRouter: "0x67803fe6d76409640efDC9b7ABcD2c6c2E7cBa48",
      lbFactory: "0x39D966c1BaFe7D3F1F53dA4845805E15f7D6EE43",
      pool: "0x11d899dec22fb03a0047212b1a20a7ad8d699420", // wS/USDC.e pool
    },
  },
  // Sonic Fork addresses (from our successful deployment)
  31337: {
    vault: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
    feeManager: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
    queueHandler: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
    rewardClaimer: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
    registry: "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1",
    tokens: {
      wS: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
      usdce: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
      metro: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321",
    },
    metropolis: {
      lbRouter: "0x67803fe6d76409640efDC9b7ABcD2c6c2E7cBa48",
      lbFactory: "0x39D966c1BaFe7D3F1F53dA4845805E15f7D6EE43",
      pool: "0x11d899dec22fb03a0047212b1a20a7ad8d699420", // wS/USDC.e pool
    },
  },
} as const;

// Helper to get contracts for current chain
export function getContracts(chainId: number) {
  return CONTRACTS[chainId as keyof typeof CONTRACTS];
}

// Contract ABIs (basic functions we need for UI)
export const VAULT_ABI = [
  // Read functions
  "function tokenBalance(uint8 tokenType) external view returns (uint256)",
  "function getPricePerFullShare(uint8 tokenType) external view returns (uint256)",
  "function getShares(address user, uint8 tokenType) external view returns (uint256)",
  "function totalSupply(uint8 tokenType) external view returns (uint256)",

  // Write functions
  "function depositToken(uint256 amount, uint8 tokenType) external",
  "function withdrawTokenShares(uint256[2] calldata shareAmounts) external",
  "function withdrawAll() external",

  // Events
  "event Deposit(address indexed user, uint8 indexed tokenType, uint256 amount, uint256 shares)",
  "event Withdraw(address indexed user, uint8 indexed tokenType, uint256 amount, uint256 shares)",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
] as const;

export const QUEUE_HANDLER_ABI = [
  "function getPendingDepositsCount() external view returns (uint256)",
  "function getPendingWithdrawsCount() external view returns (uint256)",
  "function getQueuedToken(uint8 tokenType) external view returns (uint256)",
] as const;
