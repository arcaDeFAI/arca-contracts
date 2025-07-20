import type { Vault } from "../types/vault";

export const mockVaults: Vault[] = [
  {
    id: 0,
    name: "S/USDC",
    platform: "DLMM",
    chain: "Sonic",
    earnings: 0,
    poolTvl: 1250000,
    farmTvl: 850000,
    apr: 18.5,
    aprDaily: 0.051,
    tokens: ["S", "USDC"],
  },
];

export const platforms = ["All Platforms", "DLMM", "Uniswap", "SushiSwap"];
export const chains = ["Sonic", "Ethereum", "Polygon", "Arbitrum"];
export const sortOptions = ["APR ↓", "APR ↑", "TVL ↓", "TVL ↑"];
