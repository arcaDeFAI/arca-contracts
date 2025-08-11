import type { Vault } from "../types/vault";

export const mockVaults: Vault[] = [
  {
    id: 1,
    name: "S/USDC",
    tokens: ["S", "USDC"],
    platform: "Metropolis",
    chain: "Sonic",
    apr: 12.5,
    aprDaily: 0.34,
    poolTvl: 2500000,
    farmTvl: 1800000,
    earnings: 0,
  },
  {
    id: 2,
    name: "S/USDC-CL",
    tokens: ["S", "USDC"],
    platform: "Shadow",
    chain: "Sonic",
    apr: 18.7,
    aprDaily: 0.51,
    poolTvl: 1200000,
    farmTvl: 850000,
    earnings: 0,
  },
];

export const platforms = ["All Platforms", "Metropolis", "Shadow", "TraderJoe"];
export const chains = ["Sonic", "Ethereum", "Polygon", "Arbitrum"];
export const sortOptions = ["APR ↓", "APR ↑", "TVL ↓", "TVL ↑"];
