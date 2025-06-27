import {
  getDeploymentAddresses,
  getDeploymentStatus,
} from "./deployment-loader";

// Helper to get contracts for current chain - now uses dynamic loading
export function getContracts(chainId: number) {
  const deploymentAddresses = getDeploymentAddresses(chainId);

  if (!deploymentAddresses) {
    console.warn(
      `No contracts found for chain ${chainId}. Check deployment status.`,
    );
    return null;
  }

  return deploymentAddresses;
}

// Debug helper to check deployment status
export function getContractStatus(chainId: number) {
  return getDeploymentStatus(chainId);
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
