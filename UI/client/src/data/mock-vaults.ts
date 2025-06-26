import type { Vault } from "../types/vault";

// Legacy mock vault structure - kept for compatibility during transition
export const realVaults: Vault[] = [
  {
    id: 1,
    name: "wS-USDC.e",
    platform: "Arca DLMM",
    chain: "Sonic",
    earnings: 0, // Will be fetched from contracts
    poolTvl: 0, // Will be fetched from Metropolis pool
    farmTvl: 0, // Will be calculated from our vault
    apr: 0, // Will be calculated
    aprDaily: 0, // Will be calculated
    tokens: ["wS", "USDC.e"],
    description:
      "Automated liquidity provision for Sonic/USDC.e on Metropolis DLMM",
    contractAddress: "", // Will be set based on chain
    isActive: true,
  },
];

// Note: Use useRealVaults() hook instead of this static data
// This is kept for components that haven't been migrated yet

// Keep mock vaults for testing/comparison
export const mockVaults: Vault[] = [
  {
    id: 101,
    name: "ETH-USDC (Demo)",
    platform: "DLMM",
    chain: "Sonic",
    earnings: 0,
    poolTvl: 566140,
    farmTvl: 290620,
    apr: 62.05,
    aprDaily: 0.17,
    tokens: ["ETH", "USDC"],
    description: "Demo vault for testing",
    contractAddress: "0x0000000000000000000000000000000000000000",
    isActive: false,
  },
];

export const platforms = ["All Platforms", "DLMM", "Uniswap", "SushiSwap"];
export const chains = ["Sonic", "Ethereum", "Polygon", "Arbitrum"];
export const sortOptions = ["APR ↓", "APR ↑", "TVL ↓", "TVL ↑"];
