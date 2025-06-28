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
  {
    name: "tokenBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenType", type: "uint8", internalType: "uint8" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "getPricePerFullShare",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenType", type: "uint8", internalType: "uint8" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "getShares",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "tokenType", type: "uint8", internalType: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenType", type: "uint8", internalType: "uint8" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "depositToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "tokenType", type: "uint8", internalType: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "withdrawTokenShares",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shareAmounts", type: "uint256[2]", internalType: "uint256[2]" },
    ],
    outputs: [],
  },
  {
    name: "withdrawAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

// Event signatures for filtering blockchain logs
export const VAULT_EVENT_SIGNATURES = {
  Deposit: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", // Example - would need real signatures
  Withdraw:
    "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", // Example - would need real signatures
} as const;

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
] as const;

export const QUEUE_HANDLER_ABI = [
  {
    name: "getPendingDepositsCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "getPendingWithdrawsCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "getQueuedToken",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenType", type: "uint8", internalType: "uint8" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
] as const;

export const REGISTRY_ABI = [
  {
    name: "getActiveVaults",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address[]",
        internalType: "address[]",
      },
    ],
  },
  {
    name: "getVaultInfo",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "vault",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct ArcaVaultRegistry.VaultInfo",
        components: [
          { name: "vault", type: "address", internalType: "address" },
          { name: "rewardClaimer", type: "address", internalType: "address" },
          { name: "queueHandler", type: "address", internalType: "address" },
          { name: "feeManager", type: "address", internalType: "address" },
          { name: "tokenX", type: "address", internalType: "address" },
          { name: "tokenY", type: "address", internalType: "address" },
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          {
            name: "deploymentTimestamp",
            type: "uint256",
            internalType: "uint256",
          },
          { name: "deployer", type: "address", internalType: "address" },
          { name: "isActive", type: "bool", internalType: "bool" },
          { name: "isProxy", type: "bool", internalType: "bool" },
        ],
      },
    ],
  },
  {
    name: "isActiveVault",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "vault",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
  },
] as const;
