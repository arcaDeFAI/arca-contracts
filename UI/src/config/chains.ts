import { defineChain, type Chain } from "viem";

// Single source of truth for all supported chains in Arca
export const SUPPORTED_CHAINS = {
  sonic: defineChain({
    id: 146,
    name: "Sonic",
    nativeCurrency: {
      decimals: 18,
      name: "Sonic",
      symbol: "S",
    },
    rpcUrls: {
      default: {
        http: ["https://rpc.soniclabs.com"],
      },
    },
    blockExplorers: {
      default: {
        name: "Sonic Explorer",
        url: "https://explorer.soniclabs.com",
      },
    },
    iconUrl:
      "https://res.cloudinary.com/dpnvhlvim/image/upload/sonic_logo_Black_xjdjoi.png",
    testnet: false,
  }),

  sonicFork: defineChain({
    id: 31338,
    name: "Sonic Fork",
    nativeCurrency: {
      decimals: 18,
      name: "Sonic",
      symbol: "S",
    },
    rpcUrls: {
      default: {
        http: ["http://127.0.0.1:8546"],
      },
    },
    blockExplorers: {
      default: {
        name: "Local Fork",
        url: "http://localhost:8546",
      },
    },
    iconUrl:
      "https://res.cloudinary.com/dpnvhlvim/image/upload/sonic_logo_Black_xjdjoi.png",
    testnet: true,
  }),

  localhost: defineChain({
    id: 31337,
    name: "Localhost",
    nativeCurrency: {
      decimals: 18,
      name: "Sonic",
      symbol: "S",
    },
    rpcUrls: {
      default: {
        http: ["http://127.0.0.1:8545"],
      },
    },
    blockExplorers: {
      default: {
        name: "Local",
        url: "http://localhost:8545",
      },
    },
    testnet: true,
  }),
} as const;

// Chain ID to chain name mapping for UI display
export const CHAIN_ID_TO_NAME: Record<number, string> = {
  146: "Sonic",
  31338: "Sonic Fork",
  31337: "Localhost",
} as const;

// Chain filter constants
export const ALL_CHAINS = "All Chains" as const;

// Chain names for filtering (matches what's used in vault data)
export const CHAIN_FILTER_OPTIONS = [
  ALL_CHAINS,
  "Sonic",
  "Sonic Fork",
  "Localhost",
] as const;

// Type exports for type safety
export type SupportedChainId = keyof typeof CHAIN_ID_TO_NAME;
export type ChainFilterOption = (typeof CHAIN_FILTER_OPTIONS)[number];

// Helper function to get chain name from ID
export function getChainName(chainId: number): string {
  return CHAIN_ID_TO_NAME[chainId as SupportedChainId] || "Unknown";
}

// Helper function to check if chain is supported
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in CHAIN_ID_TO_NAME;
}

// Get all supported chains as array (for wallet configuration)
export function getSupportedChains() {
  return [
    SUPPORTED_CHAINS.sonic,
    SUPPORTED_CHAINS.sonicFork,
    SUPPORTED_CHAINS.localhost,
  ] as const;
}
