/**
 * Token Registry - Single source of truth for all token metadata.
 *
 * To add a new token, add ONE entry here. All helpers, components,
 * and price-fetching logic derive from this registry automatically.
 */

// --- Price source types ---

type PriceSourceDIA = {
  type: 'dia';
  chain: string;
  address: string;
};

type PriceSourceCoinGecko = {
  type: 'coingecko';
  id: string;
};

type PriceSourceFixed = {
  type: 'fixed';
  price: number;
};

export type PriceSource = PriceSourceDIA | PriceSourceCoinGecko | PriceSourceFixed;

// --- Token definition ---

export interface TokenDefinition {
  /** Symbol shown in the UI (e.g. 'S', 'WS', 'USDC') */
  symbol: string;
  /** Human-readable display name */
  displayName: string;
  /** ERC-20 contract address, or null for the native token */
  address: `0x${string}` | null;
  /** On-chain decimals */
  decimals: number;
  /** Path to logo asset */
  logo: string;
  /** True only for the chain-native gas token (S / SONIC) */
  isNative: boolean;
  /**
   * Canonical group name used for:
   *  - price deduplication (S and WS share price via 'SONIC')
   *  - dashboard allocation grouping
   */
  canonicalName: string;
  /** How to fetch this token's USD price */
  priceSource: PriceSource;
  /** Price to use when all APIs fail */
  fallbackPrice: number;
  /** Optional CoinGecko ID for address-based reverse lookup */
  coingeckoId?: string;
  /** Hex colour for portfolio allocation charts */
  chartColor: string;
  /** Share-token decimals when this token appears in a vault (WETH = 18, rest = 12) */
  shareDecimals: number;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TOKEN_REGISTRY: Record<string, TokenDefinition> = {
  // --- Sonic ecosystem ---
  S: {
    symbol: 'S',
    displayName: 'S',
    address: null,
    decimals: 18,
    logo: '/SonicLogoRound.png',
    isNative: true,
    canonicalName: 'SONIC',
    priceSource: { type: 'dia', chain: 'Sonic', address: '0x0000000000000000000000000000000000000000' },
    fallbackPrice: 0.17,
    coingeckoId: 'sonic-3',
    chartColor: '#00FFA3',
    shareDecimals: 12,
  },
  WS: {
    symbol: 'WS',
    displayName: 'WS',
    address: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38',
    decimals: 18,
    logo: '/SonicLogoRound.png',
    isNative: false,
    canonicalName: 'SONIC',
    priceSource: { type: 'dia', chain: 'Sonic', address: '0x0000000000000000000000000000000000000000' },
    fallbackPrice: 0.17,
    coingeckoId: 'sonic-3',
    chartColor: '#00FFA3',
    shareDecimals: 12,
  },

  // --- Stablecoins ---
  USDC: {
    symbol: 'USDC',
    displayName: 'USDC',
    address: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
    decimals: 6,
    logo: '/USDCLogo.png',
    isNative: false,
    canonicalName: 'USDC',
    priceSource: { type: 'fixed', price: 1.0 },
    fallbackPrice: 1.0,
    coingeckoId: 'usd-coin',
    chartColor: '#3B82F6',
    shareDecimals: 12,
  },
  USSD: {
    symbol: 'USSD',
    displayName: 'USSD',
    address: '0x000000000eCcFf26B795F73fb0A70d48da657fEf',
    decimals: 18,
    logo: '/UssdLogo.svg',
    isNative: false,
    canonicalName: 'USSD',
    priceSource: { type: 'fixed', price: 1.0 },
    fallbackPrice: 1.0,
    chartColor: '#F59E0B',
    shareDecimals: 12,
  },

  // --- ETH ---
  WETH: {
    symbol: 'WETH',
    displayName: 'WETH',
    address: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',
    decimals: 18,
    logo: '/WETH-logo.png',
    isNative: false,
    canonicalName: 'WETH',
    priceSource: { type: 'dia', chain: 'Ethereum', address: '0x0000000000000000000000000000000000000000' },
    fallbackPrice: 3400,
    coingeckoId: 'ethereum',
    chartColor: '#8B5CF6',
    shareDecimals: 18,
  },

  // --- Protocol / reward tokens ---
  METRO: {
    symbol: 'METRO',
    displayName: 'Metro',
    address: '0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321',
    decimals: 18,
    logo: '/MetropolisLogo.png',
    isNative: false,
    canonicalName: 'METRO',
    priceSource: { type: 'coingecko', id: 'metropolis' },
    fallbackPrice: 0,
    coingeckoId: 'metropolis',
    chartColor: '#EC4899',
    shareDecimals: 12,
  },
  SHADOW: {
    symbol: 'SHADOW',
    displayName: 'Shadow',
    address: '0x3333b97138D4b086720b5aE8A7844b1345a33333',
    decimals: 18,
    logo: '/SHadowLogo.jpg',
    isNative: false,
    canonicalName: 'SHADOW',
    priceSource: { type: 'coingecko', id: 'shadow-2' },
    fallbackPrice: 0,
    coingeckoId: 'shadow-2',
    chartColor: '#6366F1',
    shareDecimals: 12,
  },
  XSHADOW: {
    symbol: 'xSHADOW',
    displayName: 'xShadow',
    address: '0x5050bc082FF4A74Fb6B0B04385dEfdDB114b2424',
    decimals: 18,
    logo: '/SHadowLogo.jpg',
    isNative: false,
    canonicalName: 'SHADOW',
    priceSource: { type: 'coingecko', id: 'shadow-2' },
    fallbackPrice: 0,
    coingeckoId: 'shadow-2',
    chartColor: '#6366F1',
    shareDecimals: 12,
  },
} as const satisfies Record<string, TokenDefinition>;

// ---------------------------------------------------------------------------
// Aliases  (case-insensitive alternative names → registry key)
// ---------------------------------------------------------------------------

const ALIASES: Record<string, string> = {
  SONIC: 'S',
  ETH: 'WETH',
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Look up a token by symbol or alias (case-insensitive). */
export function getToken(symbol: string): TokenDefinition | undefined {
  const upper = symbol.toUpperCase();
  const key = ALIASES[upper] ?? upper;
  return TOKEN_REGISTRY[key];
}

/** Same as getToken but throws if the token is unknown. */
export function getTokenOrThrow(symbol: string): TokenDefinition {
  const token = getToken(symbol);
  if (!token) throw new Error(`Unknown token: ${symbol}`);
  return token;
}

/** Reverse-lookup: find a token by its contract address (case-insensitive). */
export function getTokenByAddress(address: string): TokenDefinition | undefined {
  const lower = address.toLowerCase();
  return Object.values(TOKEN_REGISTRY).find(
    (t) => t.address?.toLowerCase() === lower,
  );
}
