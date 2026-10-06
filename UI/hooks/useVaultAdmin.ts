'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { parseAbi } from 'viem';
import { type VaultConfig } from '@/lib/vaultConfigs';

const VAULT_ABI = parseAbi(['function getFactory() view returns (address)']);
const FACTORY_ABI = parseAbi([
  'function owner() view returns (address)',
  'function getDefaultOperator() view returns (address)',
]);
const STRATEGY_ABI = parseAbi(['function getOperator() view returns (address)']);

export type AdminRole = 'owner' | 'operator';

/**
 * Whether the connected wallet administers this vault: the VaultFactory owner, the factory's
 * default operator, or the strategy's own operator. Technical details (range, idle liquidity,
 * rebalance timing) are shown only to these wallets.
 */
export function useVaultAdmin(config: VaultConfig, userAddress?: string): { role: AdminRole | null } {
  const { data: factory } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'getFactory',
    query: { enabled: !!userAddress, staleTime: Infinity },
  });

  const { data } = useReadContracts({
    contracts: [
      { address: factory, abi: FACTORY_ABI, functionName: 'owner' },
      { address: factory, abi: FACTORY_ABI, functionName: 'getDefaultOperator' },
      { address: config.stratAddress as `0x${string}`, abi: STRATEGY_ABI, functionName: 'getOperator' },
    ],
    query: { enabled: !!userAddress && !!factory, staleTime: Infinity },
  });

  if (!userAddress || !data) return { role: null };
  const user = userAddress.toLowerCase();
  const [owner, defaultOperator, operator] = data.map((r) =>
    r.status === 'success' ? r.result.toLowerCase() : undefined,
  );

  if (owner === user) return { role: 'owner' };
  if (defaultOperator === user || operator === user) return { role: 'operator' };
  return { role: null };
}
