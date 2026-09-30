'use client';

import { useReadContract } from 'wagmi';
import { parseAbi } from 'viem';
import { ShieldCheckIcon } from '@heroicons/react/20/solid';
import { useVaultPositionData } from '@/hooks/useVaultPositionData';
import { useVaultHistory } from '@/hooks/useVaultHistory';
import { useVaultFees } from '@/hooks/useVaultFees';
import { formatSignedPct, useVaultPerformance } from '@/hooks/useVaultPerformance';
import { type AdminRole } from '@/hooks/useVaultAdmin';
import { usePrices } from '@/contexts/PriceContext';
import { METRO_STRAT_ABI } from '@/lib/typechain';
import { getTokenDecimals, getTokenPrice } from '@/lib/tokenHelpers';
import { cn, formatUSD } from '@/lib/utils';
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

const negate = (v: number | undefined) => (v === undefined ? undefined : -v);

function BreakdownRow({ label, a, b, strong = false }: { label: string; a?: number; b?: number; strong?: boolean }) {
  const cell = (v?: number) => (
    <td className={cn('py-1 text-right', v === undefined ? 'text-arca-text-tertiary' : v >= 0 ? 'text-arca-green' : 'text-red-400')}>
      {v === undefined ? '—' : formatSignedPct(v)}
    </td>
  );
  return (
    <tr className={cn(strong && 'border-t border-white/[0.06] font-semibold')}>
      <td className="py-1 text-arca-text-secondary">{label}</td>
      {cell(a)}
      {cell(b)}
    </tr>
  );
}

export function AdminPanel({ config, role, snapshotCount }: { config: VaultConfig; role: AdminRole; snapshotCount: number | null }) {
  const { prices } = usePrices();
  const { aumFeePct } = useVaultFees(config);
  const perf = useVaultPerformance(config, aumFeePct);
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
        <Item label="Snapshots" value={snapshotCount === null ? '—' : String(snapshotCount)} />
        <Item label="AUM fee" value={aumFeePct === null ? '—' : `${aumFeePct}% / year`} />
      </dl>

      {/* Where the depositor's return came from, vs holding the same tokens. No trading fees: gauge LPs earn emissions only. */}
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-xs text-arca-text-secondary">
            <th className="pb-1.5 text-left font-normal">vs holding</th>
            <th className="pb-1.5 text-right font-normal">30D</th>
            <th className="pb-1.5 text-right font-normal">Since start</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          <BreakdownRow label="Rewards" a={perf.windows['30d']?.rewardReturn} b={perf.windows.all?.rewardReturn} />
          <BreakdownRow label="AUM fee" a={negate(perf.windows['30d']?.aumFeeCost)} b={negate(perf.windows.all?.aumFeeCost)} />
          <BreakdownRow label="Rebalancing IL" a={perf.windows['30d']?.rebalancingIl} b={perf.windows.all?.rebalancingIl} />
          <BreakdownRow label="Net vs holding" a={perf.windows['30d']?.vsHold} b={perf.windows.all?.vsHold} strong />
        </tbody>
      </table>

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
