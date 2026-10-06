'use client';

import { useAccount, useWriteContract } from 'wagmi';
import { METRO_VAULT_ABI, SHADOW_VAULT_ABI } from '@/lib/typechain';
import { getTokenByAddress } from '@/lib/tokenRegistry';
import { getTokenPrice } from '@/lib/tokenHelpers';
import { formatTokenAmount, formatUSD } from '@/lib/utils';
import { isShadowVault, type VaultConfig } from '@/lib/vaultConfigs';
import { usePrices } from '@/contexts/PriceContext';
import { useVaultPosition, type PendingReward } from '@/hooks/useVaultPosition';
import { useTx } from '@/hooks/useTx';
import { Button, Card, Notice } from '@/components/ui';

export function rewardsUsd(rewards: PendingReward[], prices: Record<string, number>): number {
  return rewards.reduce((sum, r) => {
    const def = getTokenByAddress(r.token);
    if (!def) return sum;
    return sum + (Number(r.amount) / 10 ** def.decimals) * getTokenPrice(def.symbol, prices);
  }, 0);
}

/** Below this, claiming isn't worth a click (gas is ~$0.0005 on Sonic); rewards keep accruing. */
export const MIN_CLAIM_USD = 0.01;

/**
 * Whether rewards are worth claiming. If any pending reward token has no USD price, claiming
 * stays allowed so a missing price feed never blocks real rewards.
 */
export function canClaimRewards(rewards: PendingReward[], prices: Record<string, number>): boolean {
  const pending = rewards.filter((r) => r.amount > 0n);
  if (pending.length === 0) return false;
  const unpriced = pending.some((r) => {
    const def = getTokenByAddress(r.token);
    return !def || getTokenPrice(def.symbol, prices) <= 0;
  });
  return unpriced || rewardsUsd(pending, prices) >= MIN_CLAIM_USD;
}

interface PositionCardProps {
  config: VaultConfig;
  depositUsd: number;
  shareRatio: number;
}

export function PositionCard({ config, depositUsd, shareRatio }: PositionCardProps) {
  const { address } = useAccount();
  const { prices } = usePrices();
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();
  const position = useVaultPosition(config, address, shareRatio);

  const vault = config.vaultAddress as `0x${string}`;
  const abi = isShadowVault(config) ? SHADOW_VAULT_ABI : METRO_VAULT_ABI;
  const pendingUsd = rewardsUsd(position.pendingRewards, prices);
  const claimable = canClaimRewards(position.pendingRewards, prices);
  const hasWithdrawals = position.queuedShares > 0n || position.claimableWithdrawals.length > 0;

  if (!address || (depositUsd < 0.01 && !position.hasPendingRewards && !hasWithdrawals)) return null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-semibold text-arca-text">Your position</h2>
        <span className="text-xl font-semibold tabular-nums text-arca-text">{formatUSD(depositUsd)}</span>
      </div>

      {/* Rewards */}
      <div className="rounded-xl bg-white/[0.03] p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-arca-text-secondary">Rewards to claim</span>
          <span className="text-sm font-semibold tabular-nums text-arca-green">{formatUSD(pendingUsd)}</span>
        </div>
        {position.pendingRewards
          .filter((r) => r.amount > 0n)
          .map((r) => {
            const def = getTokenByAddress(r.token);
            return (
              <div key={r.token} className="flex justify-between text-xs text-arca-text-secondary">
                <span>{def?.displayName ?? 'Token'}</span>
                <span className="tabular-nums">{def ? formatTokenAmount(r.amount, def.symbol) : r.amount.toString()}</span>
              </div>
            );
          })}
        {position.hasPendingRewards && !claimable && (
          <p className="mt-2 text-[11px] text-arca-text-tertiary">You can claim once rewards reach {formatUSD(MIN_CLAIM_USD)}.</p>
        )}
        <Button
          variant="secondary"
          className="mt-3 w-full"
          disabled={!claimable}
          loading={tx.pending === 'claim'}
          onClick={() => tx.send('claim', () => writeContractAsync({ address: vault, abi, functionName: 'claim' }))}
        >
          Claim rewards
        </Button>
      </div>

      {/* Withdrawals */}
      {position.claimableWithdrawals.map((w) => (
        <div key={w.round.toString()} className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-arca-green/[0.06] p-3.5">
          <span className="text-sm text-arca-text">Withdrawal ready</span>
          <Button
            loading={tx.pending === `redeem-${w.round}`}
            disabled={tx.pending !== null}
            onClick={() =>
              tx.send(`redeem-${w.round}`, () =>
                writeContractAsync({ address: vault, abi, functionName: 'redeemQueuedWithdrawal', args: [w.round, address] }),
              )
            }
          >
            Claim
          </Button>
        </div>
      ))}

      {position.queuedShares > 0n && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3.5">
          <div>
            <div className="text-sm text-arca-text">Withdrawal pending</div>
            <div className="text-xs text-arca-text-secondary">Processed at the next rebalance</div>
          </div>
          <Button
            variant="ghost"
            loading={tx.pending === 'cancel'}
            disabled={tx.pending !== null}
            onClick={() =>
              tx.send('cancel', () =>
                writeContractAsync({ address: vault, abi, functionName: 'cancelQueuedWithdrawal', args: [position.queuedShares] }),
              )
            }
          >
            Cancel
          </Button>
        </div>
      )}

      {tx.error && (
        <div className="mt-3">
          <Notice tone="error">{tx.error}</Notice>
        </div>
      )}
    </Card>
  );
}
