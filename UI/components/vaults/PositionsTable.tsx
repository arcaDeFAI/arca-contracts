'use client';

import Link from 'next/link';
import { useAccount, useWriteContract } from 'wagmi';
import { METRO_VAULT_ABI, SHADOW_VAULT_ABI } from '@/lib/typechain';
import { cn, formatApr, formatUSD } from '@/lib/utils';
import { isShadowVault } from '@/lib/vaultConfigs';
import { usePrices } from '@/contexts/PriceContext';
import { type VaultOverview } from '@/hooks/useVaultsOverview';
import { useVaultPosition } from '@/hooks/useVaultPosition';
import { useTx } from '@/hooks/useTx';
import { Card } from '@/components/ui';
import { VaultIdentity } from './VaultList';
import { canClaimRewards, MIN_CLAIM_USD, rewardsUsd } from './PositionCard';

// Vault | Value | APR | Rewards | Withdrawal
const COLS = 'md:grid-cols-[minmax(0,1fr)_96px_72px_176px_184px]';

/** Aave-style "Your positions": one line per vault with claim / cancel / redeem inline. */
export function PositionsTable({ vaults, emptyHint }: { vaults: VaultOverview[]; emptyHint: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3 text-sm font-semibold text-arca-text">Your positions</div>
      <div className={cn('hidden gap-4 border-b border-white/[0.06] px-4 py-2 text-[11px] text-arca-text-secondary md:grid', COLS)}>
        <span>Vault</span>
        <span className="text-right">Value</span>
        <span className="text-right">APR</span>
        <span className="text-right">Rewards</span>
        <span className="text-right">Withdrawal</span>
      </div>
      {emptyHint && (
        <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm text-arca-text-secondary">
          <span>You don&apos;t have any deposits yet.</span>
          <Link href="/vaults" className="rounded-lg bg-arca-green px-3 py-1.5 text-xs font-semibold text-arca-dark hover:bg-arca-green/90">
            Browse vaults
          </Link>
        </div>
      )}
      {/* Rows hide themselves when a vault has no deposit, rewards or withdrawal */}
      {[...vaults]
        .sort((a, b) => b.userUsd - a.userUsd)
        .map((v) => (
          <PositionRow key={v.config.vaultAddress} vault={v} />
        ))}
    </Card>
  );
}

function PositionRow({ vault }: { vault: VaultOverview }) {
  const { config, userUsd, apr, userShares, totalSupply } = vault;
  const { address } = useAccount();
  const { prices } = usePrices();
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();
  const shareRatio = totalSupply > 0n ? Number(userShares) / Number(totalSupply) : 0;
  const position = useVaultPosition(config, address, shareRatio);

  const hasWithdrawal = position.queuedShares > 0n || position.claimableWithdrawals.length > 0;
  if (!address || (userUsd < 0.01 && !position.hasPendingRewards && !hasWithdrawal)) return null;

  const vaultAddr = config.vaultAddress as `0x${string}`;
  const abi = isShadowVault(config) ? SHADOW_VAULT_ABI : METRO_VAULT_ABI;
  const pending = rewardsUsd(position.pendingRewards, prices);
  const claimable = canClaimRewards(position.pendingRewards, prices);
  const ready = position.claimableWithdrawals[0];

  return (
    <div className="border-b border-white/[0.04] px-4 py-2.5 last:border-b-0">
      <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 text-sm', COLS)}>
        <Link href={`/vaults/${config.vaultAddress}`} className="min-w-0 hover:opacity-80">
          <VaultIdentity vault={vault} />
        </Link>
        <span className="text-right font-medium tabular-nums text-arca-text">{formatUSD(userUsd)}</span>
        <span className="hidden text-right tabular-nums text-arca-green md:block">{formatApr(apr)}</span>

        {/* Rewards */}
        <span className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
          <span className="text-xs text-arca-text-secondary md:hidden">Rewards</span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums text-arca-text">{formatUSD(pending)}</span>
            <RowButton
              title={claimable ? undefined : `Claimable once rewards reach ${formatUSD(MIN_CLAIM_USD)}`}
              disabled={!claimable || tx.pending !== null}
              loading={tx.pending === 'claim'}
              onClick={() => tx.send('claim', () => writeContractAsync({ address: vaultAddr, abi, functionName: 'claim' }))}
            >
              Claim
            </RowButton>
          </span>
        </span>

        {/* Withdrawal */}
        <span className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
          <span className="text-xs text-arca-text-secondary md:hidden">Withdrawal</span>
          {ready ? (
            <span className="flex items-center gap-2">
              <span className="text-xs text-arca-green">Ready</span>
              <RowButton
                primary
                disabled={tx.pending !== null}
                loading={tx.pending === 'redeem'}
                onClick={() =>
                  tx.send('redeem', () =>
                    writeContractAsync({ address: vaultAddr, abi, functionName: 'redeemQueuedWithdrawal', args: [ready.round, address] }),
                  )
                }
              >
                Claim
              </RowButton>
            </span>
          ) : position.queuedShares > 0n ? (
            <span className="flex items-center gap-2">
              <span className="text-xs text-arca-text-secondary">Next rebalance</span>
              <RowButton
                disabled={tx.pending !== null}
                loading={tx.pending === 'cancel'}
                onClick={() =>
                  tx.send('cancel', () =>
                    writeContractAsync({ address: vaultAddr, abi, functionName: 'cancelQueuedWithdrawal', args: [position.queuedShares] }),
                  )
                }
              >
                Cancel
              </RowButton>
            </span>
          ) : (
            <span className="text-arca-text-tertiary">—</span>
          )}
        </span>
      </div>
      {tx.error && <p className="mt-1.5 text-xs text-red-300">{tx.error}</p>}
    </div>
  );
}

function RowButton({
  children,
  onClick,
  disabled,
  loading,
  primary = false,
  title,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        primary ? 'bg-arca-green text-arca-dark hover:bg-arca-green/90' : 'bg-white/[0.06] text-arca-text hover:bg-white/[0.1]',
      )}
    >
      {loading ? '…' : children}
    </button>
  );
}
