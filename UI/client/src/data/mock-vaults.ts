import type { Vault } from '../types/vault';

export const mockVaults: Vault[] = [
  {
    id: 1,
    name: 'ETH-USDC',
    platform: 'DLMM',
    chain: 'Sonic',
    earnings: 0,
    poolTvl: 566140,
    farmTvl: 290620,
    apr: 62.05,
    aprDaily: 0.17,
    tokens: ['ETH', 'USDC']
  },
  {
    id: 2,
    name: 'ANON-USDC',
    platform: 'DLMM',
    chain: 'Sonic',
    earnings: 0,
    poolTvl: 422302,
    farmTvl: 323899,
    apr: 73.18,
    aprDaily: 0.20,
    tokens: ['ANON', 'USDC']
  },
  {
    id: 3,
    name: 'S-ANON',
    platform: 'DLMM',
    chain: 'Sonic',
    earnings: 0,
    poolTvl: 406747,
    farmTvl: 376788,
    apr: 52.30,
    aprDaily: 0.14,
    tokens: ['S', 'ANON']
  }
];

export const platforms = ['All Platforms', 'DLMM', 'Uniswap', 'SushiSwap'];
export const chains = ['Sonic', 'Ethereum', 'Polygon', 'Arbitrum'];
export const sortOptions = ['APR ↓', 'APR ↑', 'TVL ↓', 'TVL ↑'];
