'use client';

import { useVaultPerformance } from '@/hooks/useVaultPerformance';

// WS/USDC Shadow vault addresses
const VAULT_ADDRESS = '0x727e6D1FF1f1836Bb7Cdfad30e89EdBbef878ab5';
const STRAT_ADDRESS = '0x64efeA2531f2b1A3569555084B88bb5714f5286c';
const POOL_ADDRESS = '0x324963c267C354c7660Ce8CA3F5f167E05649970';

export function VaultPerformanceCard() {
  const perf = useVaultPerformance(VAULT_ADDRESS, STRAT_ADDRESS, POOL_ADDRESS);

  const formatUSD = (value: number) =>
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatPct = (value: number | null) => {
    if (value === null) return 'Collecting...';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatTime = (ts: number | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="bg-arca-card border border-arca-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">WS/USDC Vault Performance</h3>
          <p className="text-gray-500 text-xs">Real APR from share value growth</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${perf.inRange ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {perf.inRange ? 'In Range' : 'Out of Range'}
        </span>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-arca-dark rounded-lg p-3">
          <p className="text-arca-text-muted text-xs mb-1">Total APR</p>
          <p className={`text-2xl font-bold ${(perf.totalAPR ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPct(perf.totalAPR)}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Fee: {formatPct(perf.feeAPR)} + Rewards: {formatPct(perf.rewardAPR)}
          </p>
        </div>

        <div className="bg-arca-dark rounded-lg p-3">
          <p className="text-arca-text-muted text-xs mb-1">Impermanent Loss</p>
          <p className={`text-2xl font-bold ${(perf.il ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPct(perf.il)}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Since {perf.daysTracked}d tracking
          </p>
        </div>
      </div>

      {/* Share Value & SHADOW */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-arca-text-muted text-xs mb-1">Share Value</p>
          <p className="text-white text-lg font-semibold">{formatUSD(perf.pricePerShare)}</p>
          {perf.firstSnapshot && (
            <p className="text-gray-500 text-xs">
              Started: {formatUSD(perf.firstSnapshot.pricePerShare)}
            </p>
          )}
        </div>
        <div>
          <p className="text-arca-text-muted text-xs mb-1">Vault TVL</p>
          <p className="text-white text-lg font-semibold">{formatUSD(perf.tvl)}</p>
          <p className="text-gray-500 text-xs">
            SHADOW: {formatUSD(perf.shadowPrice)}
          </p>
        </div>
      </div>

      {/* Rewards Summary */}
      {perf.totalRewardsUSD > 0 && (
        <div className="border-t border-arca-border pt-3 mb-3">
          <p className="text-arca-text-muted text-xs mb-2">SHADOW Rewards ({perf.periodDays}d period)</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{perf.rewardEventCount} harvests</span>
            <span className="text-green-400 font-medium">{formatUSD(perf.totalRewardsUSD)}</span>
          </div>
        </div>
      )}

      {/* Position Range */}
      <div className="border-t border-arca-border pt-3 mb-3">
        <p className="text-arca-text-muted text-xs mb-2">Position Range</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 text-xs">{perf.tickLower}</span>
          <div className="flex-1 h-2 bg-gray-700 rounded-full relative">
            {perf.currentTick !== null && perf.tickUpper !== perf.tickLower && (
              <div
                className={`absolute h-2 w-1 rounded ${perf.inRange ? 'bg-green-400' : 'bg-red-400'}`}
                style={{
                  left: `${Math.max(0, Math.min(100, ((perf.currentTick - perf.tickLower) / (perf.tickUpper - perf.tickLower)) * 100))}%`,
                }}
              />
            )}
          </div>
          <span className="text-gray-400 text-xs">{perf.tickUpper}</span>
        </div>
        <p className="text-center text-xs text-gray-500 mt-1">Tick: {perf.currentTick}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-arca-border">
        <span>{perf.snapshotCount} snapshots</span>
        <span>Last: {formatTime(perf.lastUpdate)}</span>
        <button onClick={perf.reset} className="text-red-400 hover:text-red-300">Reset</button>
      </div>
    </div>
  );
}
