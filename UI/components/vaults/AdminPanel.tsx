'use client';

import { useReadContract } from 'wagmi';
import { parseAbi } from 'viem';
import { ShieldCheckIcon } from '@heroicons/react/20/solid';
import { useVaultPositionData } from '@/hooks/useVaultPositionData';
import { type SubgraphMetrics } from '@/hooks/useSubgraphMetrics';
import { useVaultHistory } from '@/hooks/useVaultHistory';
import { type AdminRole } from '@/hooks/useVaultAdmin';
import { usePrices } from '@/contexts/PriceContext';
import { METRO_STRAT_ABI } from '@/lib/typechain';
import { getTokenDecimals, getTokenPrice } from '@/lib/tokenHelpers';
import { cn, formatApr, formatUSD } from '@/lib/utils';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { Card } from '@/components/ui';

const LAST_REBALANCE_ABI = parseAbi(['function getLastRebalance() view returns (uint256)']);
const EXPLORER = 'https://sonicscan.org/address/';

function formatPrice(p: number | null): string {
  if (p === null) return '—';
  if (p >= 1000) return p.toFixed(0);
  if (p >= 1) return p.toFixed(4);
  return p.toPrecision(4);
}

function timeAgo(unixSeconds: number): string {
  const mins = Math.floor((Date.now() / 1000 - unixSeconds) / 60);
  if (mins < 60) return `${mins} min ago`;
  if (mins < 48 * 60) return `${Math.floor(mins / 60)} h ago`;
  return `${Math.floor(mins / 1440)} days ago`;
}

function pct(v: number | null): string {
  return v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export function AdminPanel({ config, role, metrics }: { config: VaultConfig; role: AdminRole; metrics: SubgraphMetrics | undefined }) {
  const { prices } = usePrices();
  const position = useVaultPositionData({
    vaultAddress: config.vaultAddress,
    stratAddress: config.stratAddress,
    lbBookAddress: config.lbBookAddress,
    clpoolAddress: config.clpoolAddress,
    name: config.name,
    tokenX: config.tokenX,
    tokenY: config.tokenY,
  });
  const { unpricedRewardEvents } = useVaultHistory(config.vaultAddress);

  const strat = config.stratAddress as `0x${string}`;
  const { data: balances } = useReadContract({ address: strat, abi: METRO_STRAT_ABI, functionName: 'getBalances' });
  const { data: idle } = useReadContract({ address: strat, abi: METRO_STRAT_ABI, functionName: 'getIdleBalances' });
  const { data: lastRebalance } = useReadContract({ address: strat, abi: LAST_REBALANCE_ABI, functionName: 'getLastRebalance' });

  const toUsd = (x: bigint, y: bigint) =>
    (Number(x) / 10 ** getTokenDecimals(config.tokenX)) * getTokenPrice(config.tokenX, prices) +
    (Number(y) / 10 ** getTokenDecimals(config.tokenY)) * getTokenPrice(config.tokenY, prices);
  const totalUsd = balances ? toUsd(balances[0], balances[1]) : 0;
  const idleUsd = idle ? toUsd(idle[0], idle[1]) : 0;
  const activePct = totalUsd > 0 ? ((totalUsd - idleUsd) / totalUsd) * 100 : null;

  const pool = config.lbBookAddress ?? config.clpoolAddress;

  return (
    <Card className="border-arca-green/20 p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheckIcon className="h-4 w-4 text-arca-green" />
        <h2 className="font-semibold text-arca-text">Vault management</h2>
        <span className="ml-auto rounded-md bg-white/[0.06] px-2 py-0.5 text-xs capitalize text-arca-text-secondary">{role}</span>
      </div>

      {/* Range */}
      <div className="mb-4 rounded-xl bg-white/[0.03] p-3.5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-arca-text-secondary">Range</span>
          {position.hasData && (
            <span className={cn('text-xs font-medium', position.inRange ? 'text-arca-green' : 'text-red-400')}>
              {position.inRange ? 'In range' : 'Out of range'}
            </span>
          )}
        </div>
        <div className="relative h-2 rounded-full bg-white/[0.06]">
          <div
            className="absolute h-full rounded-full bg-arca-green/50"
            style={{ left: `${position.rangeStart}%`, width: `${position.rangeEnd - position.rangeStart}%` }}
          />
          {position.hasData && (
            <div
              className="absolute -top-1 h-4 w-0.5 rounded bg-arca-text"
              style={{ left: `${position.pricePosition}%` }}
              aria-label="Current price"
            />
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs tabular-nums text-arca-text-secondary">
          <span>{formatPrice(position.lowerPrice)}</span>
          <span className="text-arca-text">{formatPrice(position.currentPrice)}</span>
          <span>{formatPrice(position.upperPrice)}</span>
        </div>
        <div className="mt-1 text-center text-[11px] text-arca-text-tertiary">
          {config.tokenY} per {config.tokenX}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Item label="Liquidity active" value={activePct === null ? '—' : `${activePct.toFixed(0)}%`} />
        <Item label="Idle" value={formatUSD(idleUsd)} />
        <Item label="Last rebalance" value={lastRebalance ? timeAgo(Number(lastRebalance)) : '—'} />
        <Item label="Snapshots" value={metrics ? String(metrics.snapshotCount) : '—'} />
        <Item label={`Reward APR (${metrics?.periodLabel ?? '—'})`} value={formatApr(metrics?.rewardApr ?? null)} />
        <Item label={`Fee APR (${metrics?.periodLabel ?? '—'})`} value={formatApr(metrics?.feeApr ?? null)} />
        <Item label="vs HODL (since start)" value={pct(metrics?.vsHodl ?? null)} />
        <Item label="IL (since start)" value={pct(metrics?.il ?? null)} />
      </dl>

      {unpricedRewardEvents > 0 && (
        <p className="mt-4 text-xs text-amber-300/90">
          {unpricedRewardEvents} reward event{unpricedRewardEvents === 1 ? '' : 's'} had no price source in the
          subgraph and are excluded from the APR history.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.06] pt-3 text-xs">
        <a href={EXPLORER + config.vaultAddress} target="_blank" rel="noreferrer" className="text-arca-text-secondary hover:text-arca-green">Vault ↗</a>
        <a href={EXPLORER + config.stratAddress} target="_blank" rel="noreferrer" className="text-arca-text-secondary hover:text-arca-green">Strategy ↗</a>
        {pool && (
          <a href={EXPLORER + pool} target="_blank" rel="noreferrer" className="text-arca-text-secondary hover:text-arca-green">Pool ↗</a>
        )}
      </div>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-arca-text-secondary">{label}</dt>
      <dd className="tabular-nums text-arca-text">{value}</dd>
    </div>
  );
}
