/**
 * Shadow V2 test vault (branch shadow-v2 of arca-contracts, worktree
 * ../arca-contracts-v2), single-pool version. Deployed on Sonic mainnet
 * 2026-09-29 with a test
 * wallet as owner, operator and fee recipient: a test deployment, not a
 * listed production vault.
 */

export const SHADOW_V2 = {
  // redeployed 2026-09-30 with the one-transaction claim & compound zap;
  // previous test vaults 0x1aff5cF6…378a and 0x0B7896e7…F5 are emptied
  vault: '0x07431fe0Ca9F631762E8D9680c41Cf9FB6dcD8e9',
  strategy: '0x944171A27928fB5ac17E376320D19eb8e9259EdF',
  zap: '0xcF6843f5Ad429C1826Fd17D5Ec7d60e64F53230B',
  pool: '0x324963c267C354c7660Ce8CA3F5f167E05649970',
} as const satisfies Record<string, `0x${string}`>;

export interface V2Token {
  symbol: string;
  decimals: number;
  logo: string;
}

/** Every token the vault can hold or pay out, keyed by lowercase address. */
export const V2_TOKENS: Record<string, V2Token> = {
  '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38': { symbol: 'wS', decimals: 18, logo: '/SonicLogoRound.png' },
  '0x29219dd400f2bf60e5a23d13be72b486d4038894': { symbol: 'USDC', decimals: 6, logo: '/USDCLogo.png' },
  '0x000000000eccff26b795f73fb0a70d48da657fef': { symbol: 'USSD', decimals: 18, logo: '/UssdLogo.svg' },
  '0xe5da20f15420ad15de0fa650600afc998bbe3955': { symbol: 'stS', decimals: 18, logo: '/SonicLogoRound.png' },
  // Gauge reward tokens (verified on-chain)
  '0x3333b97138d4b086720b5ae8a7844b1345a33333': { symbol: 'SHADOW', decimals: 18, logo: '/SHadowLogo.jpg' },
  '0x5050bc082ff4a74fb6b0b04385defddb114b2424': { symbol: 'xSHADOW', decimals: 18, logo: '/SHadowLogo.jpg' },
  '0x3333111a391cc08fa51353e9195526a70b333333': { symbol: 'x33', decimals: 18, logo: '/SHadowLogo.jpg' },
  '0x5555b2733602ded58d47b8d3d989e631cbee5555': { symbol: 'GEMS', decimals: 18, logo: '/arca-logo.png' },
};

/** Falls back to a neutral entry for tokens not listed above (18 decimals). */
export function v2Token(address: string): V2Token {
  return V2_TOKENS[address.toLowerCase()] ?? { symbol: `${address.slice(0, 6)}…`, decimals: 18, logo: '/arca-logo.png' };
}

/** Positions are opened in order: the main range, then the alt range for the leftover. */
export function v2PositionLabel(index: number): string {
  return index === 0 ? 'Main range' : 'Alt range (leftover)';
}

/**
 * "Claim & compound": claimed SHADOW is swapped to wS on Shadow and deposited
 * back. Route SHADOW -(ts 100, 1% fee)-> USDC -(ts 50, ~0.24%)-> wS: ~1.24%
 * in fees, cheaper than the direct SHADOW/wS pools (2% / 2.05%).
 * Verified on-chain 2026-09-29: the router shares the NPM's deployer
 * (0x8bbdc157…) and wraps wS; token order is USDC < SHADOW and wS < USDC.
 */
export const COMPOUND = {
  shadow: '0x3333b97138D4b086720b5aE8A7844b1345a33333',
  usdc: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  ws: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38',
  shadowUsdcPool: '0x779cA4E7F14d10489cd32655fc513641bA3a8d8F', // token0 USDC, token1 SHADOW
  shadowUsdcSpacing: 100,
  wsUsdcPool: '0x324963c267C354c7660Ce8CA3F5f167E05649970', // token0 wS, token1 USDC
  wsUsdcSpacing: 50,
  swapSlippageBps: 200n, // on top of the pool fees
  shareSlippageBps: 100n,
} as const;

/**
 * Fixed gas limits: Sonic's eth_estimateGas under-estimates calls that read
 * the pool oracle (a deposit estimated at 281,657 ran out of gas at 338,440 on
 * mainnet). Only the gas used is paid, so a generous limit costs nothing.
 * Measured on mainnet / fork: deposit 273k-392k, withdraw 1.17M (3 positions),
 * claim 554k, gauge harvest ~7M per fresh position. Sonic caps a transaction
 * at 2**24 (~16.78M).
 */
export const V2_GAS = {
  compound: 3_000_000n, // zap: claim + two-hop swap + deposit (774k measured on a fork)
  approve: 200_000n,
  deposit: 2_000_000n,
  withdraw: 4_000_000n,
  claim: 1_500_000n,
  harvest: 12_000_000n,
} as const;
