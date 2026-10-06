'use client';

import { useReadContract } from 'wagmi';
import { parseAbi } from 'viem';
import { type VaultConfig } from '@/lib/vaultConfigs';

const STRATEGY_ABI = parseAbi(['function getAumAnnualFee() view returns (uint256)']);
const VAULT_ABI = parseAbi(['function getFactory() view returns (address)']);
const FACTORY_ABI = parseAbi(['function getDepositToWithdrawCooldown() view returns (uint256)']);

/**
 * On-chain fee + withdrawal rules for a vault.
 *
 * AUM fee: an annual % of the vault's total assets (both tokens). At every rebalance the strategy
 * sends `fee × time since last rebalance` (counted up to 1 day) to the fee recipient. Max 30% by contract.
 *
 * Cooldown: after each deposit, a wallet can't queue a withdrawal until this many seconds have passed.
 */
export function useVaultFees(config: VaultConfig) {
  const { data: aumBps } = useReadContract({
    address: config.stratAddress as `0x${string}`,
    abi: STRATEGY_ABI,
    functionName: 'getAumAnnualFee',
    query: { staleTime: 10 * 60 * 1000 },
  });

  const { data: factory } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'getFactory',
    query: { staleTime: Infinity },
  });

  const { data: cooldown } = useReadContract({
    address: factory,
    abi: FACTORY_ABI,
    functionName: 'getDepositToWithdrawCooldown',
    query: { enabled: !!factory, staleTime: 10 * 60 * 1000 },
  });

  return {
    /** e.g. 1 for 1% per year; null while loading */
    aumFeePct: aumBps !== undefined ? Number(aumBps) / 100 : null,
    cooldownSeconds: cooldown !== undefined ? Number(cooldown) : null,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'no wait';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 2 * 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} days`;
}
