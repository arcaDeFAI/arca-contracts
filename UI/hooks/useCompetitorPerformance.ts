'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { parseAbi, type PublicClient } from 'viem';
import { getCompetitors, type Competitor } from '@/lib/competitors';
import { getTokenAddress, getTokenDecimals } from '@/lib/tokenHelpers';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { type SnapshotRaw } from '@/hooks/useVaultPerformance';

const MOO_ABI = parseAbi([
  'function getPricePerFullShare() view returns (uint256)',
  'function want() view returns (address)',
]);
const CLM_ABI = parseAbi([
  'function balances() view returns (uint256, uint256)',
  'function wants() view returns (address, address)',
  'function totalSupply() view returns (uint256)',
]);
const ICHI_ABI = parseAbi([
  'function getTotalAmounts() view returns (uint256, uint256)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)',
]);

export interface CompetitorResult {
  name: string;
  /** Net vs holding over the window, as a fraction (same definition as our vault's) */
  vsHold: number;
}

/** Amounts of our tokenX / tokenY behind one Beefy vault share at `blockNumber`, in token units. */
async function basketAt(
  client: PublicClient,
  c: Competitor,
  blockNumber: bigint,
  x: { address: string; decimals: number },
  y: { address: string; decimals: number },
): Promise<[number, number]> {
  const [ppfs, want] = await Promise.all([
    client.readContract({ address: c.vault, abi: MOO_ABI, functionName: 'getPricePerFullShare', blockNumber }),
    client.readContract({ address: c.vault, abi: MOO_ABI, functionName: 'want', blockNumber }),
  ]);
  const [[a0, a1], [t0, t1], supply] =
    c.kind === 'clm'
      ? await Promise.all([
          client.readContract({ address: want, abi: CLM_ABI, functionName: 'balances', blockNumber }),
          client.readContract({ address: want, abi: CLM_ABI, functionName: 'wants', blockNumber }),
          client.readContract({ address: want, abi: CLM_ABI, functionName: 'totalSupply', blockNumber }),
        ])
      : await Promise.all([
          client.readContract({ address: want, abi: ICHI_ABI, functionName: 'getTotalAmounts', blockNumber }),
          Promise.all([
            client.readContract({ address: want, abi: ICHI_ABI, functionName: 'token0', blockNumber }),
            client.readContract({ address: want, abi: ICHI_ABI, functionName: 'token1', blockNumber }),
          ]),
          client.readContract({ address: want, abi: ICHI_ABI, functionName: 'totalSupply', blockNumber }),
        ]);
  if (supply === 0n) return [0, 0];
  // per 1 Beefy share: ppfs underlying (1e18 scale) x the underlying's balance per unit
  const amount = (token: string, decimals: number) => {
    const raw = token.toLowerCase() === t0.toLowerCase() ? a0 : token.toLowerCase() === t1.toLowerCase() ? a1 : 0n;
    return (Number(raw) * Number(ppfs)) / Number(supply) / 10 ** decimals;
  };
  return [amount(x.address, x.decimals), amount(y.address, y.decimals)];
}

/**
 * Other vaults on the same pair, measured exactly like ours: their share
 * composition read on-chain at the blocks of our window's first and last
 * rebalance, valued at our snapshot prices. Their share price includes the
 * rewards they compound, so "net vs holding" is comparable.
 */
export function useCompetitorPerformance(config: VaultConfig, first?: SnapshotRaw, last?: SnapshotRaw) {
  const client = usePublicClient({ chainId: 146 });
  const competitors = getCompetitors(config.vaultAddress);

  return useQuery({
    queryKey: ['competitors', config.vaultAddress, first?.blockNumber, last?.blockNumber],
    enabled: !!client && competitors.length > 0 && !!first && !!last,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<CompetitorResult[]> => {
      const x = { address: getTokenAddress(config.tokenX), decimals: getTokenDecimals(config.tokenX) };
      const y = { address: getTokenAddress(config.tokenY), decimals: getTokenDecimals(config.tokenY) };
      const [px0, py0, px1, py1] = [first!.priceXUsd, first!.priceYUsd, last!.priceXUsd, last!.priceYUsd].map(Number);
      const results = await Promise.all(
        competitors.map(async (c): Promise<CompetitorResult | null> => {
          try {
            const [[x0, y0], [x1, y1]] = await Promise.all([
              basketAt(client!, c, BigInt(first!.blockNumber), x, y),
              basketAt(client!, c, BigInt(last!.blockNumber), x, y),
            ]);
            const v0 = x0 * px0 + y0 * py0;
            if (v0 <= 0) return null; // did not exist yet at the start of the window
            const share = (x1 * px1 + y1 * py1) / v0 - 1;
            const hold = (x0 * px1 + y0 * py1) / v0 - 1;
            return { name: c.name, vsHold: share - hold };
          } catch {
            return null; // not deployed yet at that block, or RPC without history
          }
        }),
      );
      return results.filter((r): r is CompetitorResult => r !== null);
    },
  });
}
