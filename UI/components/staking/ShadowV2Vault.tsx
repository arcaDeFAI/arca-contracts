'use client';

import { useState } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { SHADOW_V2_VAULT_ABI } from '@/lib/abis/shadowV2Abis';
import { COMPOUND, SHADOW_V2, V2_GAS, v2PositionLabel, v2Token } from '@/lib/shadowV2';
import { useShadowV2 } from '@/hooks/useShadowV2';
import { CompoundButton } from '@/components/staking/CompoundButton';
import { useTx } from '@/hooks/useTx';
import { cn } from '@/lib/utils';
import { Button, Card, ConnectWalletButton, Notice, Segmented, Skeleton, Stat } from '@/components/ui';

const WS = '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38';
const USDC = '0x29219dd400f2Bf60E5a23d13Be72B486D4038894';
const EXPLORER = 'https://sonicscan.org/address/';

const WRAP_ABI = [
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
] as const;

// Typed ERC-20 subset: the shared ERC20_ABI has no stateMutability, so viem
// types its results as unknown.
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

function fmt(amount: bigint, decimals: number, maxFraction = 4): string {
  const value = Number(formatUnits(amount, decimals));
  if (value === 0) return '0';
  if (value < 10 ** -maxFraction) return `<${10 ** -maxFraction}`;
  return value.toLocaleString('en-US', { maximumFractionDigits: maxFraction });
}

function fmtUsdc(amount: bigint | null): string {
  return amount === null ? '—' : `$${fmt(amount, 6, 4)}`;
}

function safeParse(value: string, decimals: number): bigint {
  try {
    return value.trim() === '' ? 0n : parseUnits(value.trim(), decimals);
  } catch {
    return 0n;
  }
}

function TokenIcon({ address, size = 20 }: { address: string; size?: number }) {
  return <img src={v2Token(address).logo} alt="" width={size} height={size} className="rounded-full" />;
}

export function ShadowV2Vault() {
  const { address, isConnected } = useAccount();
  const data = useShadowV2(address);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-arca-text">wS / USDC</h1>
          <span className="rounded-full bg-amber-500/[0.12] px-2 py-0.5 text-xs font-medium text-amber-300">Test</span>
        </div>
        <p className="text-sm text-arca-text-secondary">Deposit and withdraw anytime. Rewards are shared automatically.</p>
      </div>

      <Card className="mb-4 grid grid-cols-3 gap-4 p-5">
        <Stat label="Vault value" value={fmtUsdc(data.vaultValueUsdc)} loading={data.isLoading} />
        <Stat label="Your deposit" value={isConnected ? fmtUsdc(data.userValueUsdc) : '—'} accent loading={isConnected && data.isLoading} />
        <Stat label="Fee" value={`${Number(data.aumFeeBps) / 100}%`} loading={data.isLoading} />
      </Card>

      <ActionsCard data={data} isConnected={isConnected} />

      {/* Test vault: details are shown to everyone so the strategy can be checked live */}
      <div className="mt-10 flex flex-col gap-4">
        <div className="text-xs font-medium uppercase tracking-wide text-arca-text-secondary">
          Vault details ·{' '}
          <a className="hover:text-arca-green" href={EXPLORER + SHADOW_V2.vault} target="_blank" rel="noreferrer">
            vault ↗
          </a>{' '}
          <a className="hover:text-arca-green" href={EXPLORER + SHADOW_V2.strategy} target="_blank" rel="noreferrer">
            strategy ↗
          </a>
        </div>
        {/* harvest() is public on-chain: on this test page any connected wallet can trigger it */}
        <PositionsCard data={data} canHarvest={isConnected} />
      </div>
    </div>
  );
}

type V2Data = ReturnType<typeof useShadowV2>;

// ─── Position math (display only, floating point) ──────────────────────────────

const Q96 = 2 ** 96;

/** Human price of token0 in token1 at a tick. */
function priceAtTick(tick: number, decimals0: number, decimals1: number): number {
  return 1.0001 ** tick * 10 ** (decimals0 - decimals1);
}

/** Human price of token0 in token1 from sqrtPriceX96. */
function priceFromSqrt(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const sqrt = Number(sqrtPriceX96) / Q96;
  return sqrt * sqrt * 10 ** (decimals0 - decimals1);
}

/** Token amounts (human units) held by `liquidity` in [tickLower, tickUpper] at the current price. */
function positionAmounts(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  decimals0: number,
  decimals1: number,
): [number, number] {
  const L = Number(liquidity);
  const sp = Number(sqrtPriceX96) / Q96;
  const sa = 1.0001 ** (tickLower / 2);
  const sb = 1.0001 ** (tickUpper / 2);
  let raw0 = 0;
  let raw1 = 0;
  if (sp <= sa) raw0 = (L * (sb - sa)) / (sa * sb);
  else if (sp >= sb) raw1 = L * (sb - sa);
  else {
    raw0 = (L * (sb - sp)) / (sp * sb);
    raw1 = L * (sp - sa);
  }
  return [raw0 / 10 ** decimals0, raw1 / 10 ** decimals1];
}

/** USDC price of every token reachable from USDC through the vault pools. */
function usdcPrices(pools: V2Data['poolPrices']): Record<string, number> {
  const prices: Record<string, number> = { [USDC.toLowerCase()]: 1 };
  for (let pass = 0; pass < 3; pass++) {
    for (const pool of Object.values(pools)) {
      const t0 = pool.token0.toLowerCase();
      const t1 = pool.token1.toLowerCase();
      const p = priceFromSqrt(pool.sqrtPriceX96, v2Token(t0).decimals, v2Token(t1).decimals);
      if (prices[t1] !== undefined && prices[t0] === undefined) prices[t0] = p * prices[t1];
      if (prices[t0] !== undefined && prices[t1] === undefined) prices[t1] = prices[t0] / p;
    }
  }
  return prices;
}

function num(value: number, digits = 4): string {
  if (value === 0) return '0';
  if (Math.abs(value) < 10 ** -digits) return `<${10 ** -digits}`;
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function sigPrice(value: number): string {
  return Number(value.toPrecision(5)).toString();
}

function PositionsCard({ data, canHarvest }: { data: V2Data; canHarvest: boolean }) {
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();
  const prices = usdcPrices(data.poolPrices);

  // Idle = total held minus what the positions hold (display approximation)
  const inPositions: Record<string, number> = {};

  const rows = data.positions.map((p, i) => {
    const t0 = p.token0 ? v2Token(p.token0) : null;
    const t1 = p.token1 ? v2Token(p.token1) : null;
    let a0 = 0;
    let a1 = 0;
    const ready = t0 !== null && t1 !== null && p.liquidity !== null && p.sqrtPriceX96 !== null;
    if (t0 && t1 && p.token0 && p.token1 && p.liquidity !== null && p.sqrtPriceX96 !== null) {
      [a0, a1] = positionAmounts(p.liquidity, p.sqrtPriceX96, p.tickLower, p.tickUpper, t0.decimals, t1.decimals);
      const k0 = p.token0.toLowerCase();
      const k1 = p.token1.toLowerCase();
      inPositions[k0] = (inPositions[k0] ?? 0) + a0;
      inPositions[k1] = (inPositions[k1] ?? 0) + a1;
    }
    const price0 = p.token0 ? prices[p.token0.toLowerCase()] : undefined;
    const price1 = p.token1 ? prices[p.token1.toLowerCase()] : undefined;
    const valueUsdc = price0 !== undefined && price1 !== undefined ? a0 * price0 + a1 * price1 : null;
    return { p, i, t0, t1, a0, a1, valueUsdc, ready };
  });

  const idle = data.holdings
    .map((h) => {
      const meta = v2Token(h.token);
      const total = Number(formatUnits(h.amount, meta.decimals));
      const amount = Math.max(0, total - (inPositions[h.token.toLowerCase()] ?? 0));
      const price = prices[h.token.toLowerCase()];
      return { token: h.token, meta, amount, value: price === undefined ? null : amount * price };
    })
    // hide rounding noise
    .filter((h) => (h.value ?? h.amount) > 0.0001);

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-arca-text">Positions</h2>
      {data.positions.length === 0 && (
        <p className="text-sm text-arca-text-secondary">No open position: everything is idle until the next rebalance.</p>
      )}
      <div className="flex flex-col gap-3">
        {rows.map(({ p, i, t0, t1, a0, a1, valueUsdc, ready }) => (
          <div key={p.tokenId.toString()} className="rounded-xl bg-white/[0.03] p-3.5 text-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex-1 font-medium text-arca-text">{v2PositionLabel(i)}</span>
              <span className="tabular-nums text-arca-text">{valueUsdc === null ? '…' : `$${num(valueUsdc, 4)}`}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  p.inRange === null && 'bg-white/[0.06] text-arca-text-secondary',
                  p.inRange === true && 'bg-arca-green/[0.12] text-arca-green',
                  p.inRange === false && 'bg-amber-500/[0.12] text-amber-300',
                )}
              >
                {p.inRange === null ? '…' : p.inRange ? 'In range' : 'Out of range'}
              </span>
            </div>
            {ready && t0 && t1 && p.token0 && p.token1 ? (
              <>
                <div className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-arca-text">
                  <span className="flex items-center gap-1.5">
                    <TokenIcon address={p.token0} size={14} /> {num(a0)} {t0.symbol}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <TokenIcon address={p.token1} size={14} /> {num(a1)} {t1.symbol}
                  </span>
                </div>
                <div className="text-xs tabular-nums text-arca-text-secondary">
                  Range {sigPrice(priceAtTick(p.tickLower, t0.decimals, t1.decimals))} –{' '}
                  {sigPrice(priceAtTick(p.tickUpper, t0.decimals, t1.decimals))} {t1.symbol} per {t0.symbol}
                  {p.sqrtPriceX96 !== null && ` · now ${sigPrice(priceFromSqrt(p.sqrtPriceX96, t0.decimals, t1.decimals))}`}
                </div>
              </>
            ) : (
              <Skeleton className="h-8 w-full" />
            )}
            {canHarvest && (
              <Button
                variant="secondary"
                className="mt-2.5 px-3 py-1.5 text-xs"
                loading={tx.pending === `harvest-${i}`}
                disabled={tx.pending !== null}
                onClick={() =>
                  tx.send(`harvest-${i}`, () =>
                    writeContractAsync({
                      address: SHADOW_V2.vault,
                      abi: SHADOW_V2_VAULT_ABI,
                      functionName: 'harvest',
                      args: [1n << BigInt(i)],
                      gas: V2_GAS.harvest,
                    }),
                  )
                }
              >
                Harvest gauge
              </Button>
            )}
          </div>
        ))}

        {idle.length > 0 && (
          <div className="rounded-xl border border-dashed border-white/[0.08] p-3.5 text-sm">
            <div className="mb-1.5 font-medium text-arca-text-secondary">Idle (not in a position)</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-arca-text">
              {idle.map((h) => (
                <span key={h.token} className="flex items-center gap-1.5">
                  <TokenIcon address={h.token} size={14} /> {num(h.amount)} {h.meta.symbol}
                  {h.value !== null && <span className="text-arca-text-secondary">(${num(h.value, 4)})</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {tx.error && (
        <div className="mt-3">
          <Notice tone="error">{tx.error}</Notice>
        </div>
      )}
    </Card>
  );
}

type Tab = 'deposit' | 'withdraw';
const TABS = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw' },
] as const;

function ActionsCard({ data, isConnected }: { data: V2Data; isConnected: boolean }) {
  const [tab, setTab] = useState<Tab>('deposit');
  return (
    <Card className="p-5">
      <div className="mb-5">
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </div>
      {!isConnected ? (
        <div className="py-6 text-center">
          <ConnectWalletButton />
        </div>
      ) : tab === 'deposit' ? (
        <DepositForm data={data} />
      ) : (
        <WithdrawForm data={data} />
      )}
      {isConnected && <RewardsLine data={data} />}
    </Card>
  );
}

function AmountInput({
  token,
  value,
  onChange,
  balance,
}: {
  token: `0x${string}`;
  value: string;
  onChange: (v: string) => void;
  balance: bigint | undefined;
}) {
  const meta = v2Token(token);
  return (
    <div className="rounded-xl bg-white/[0.04] p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-arca-text-secondary">
        <span className="flex items-center gap-1.5">
          <TokenIcon address={token} size={16} /> {meta.symbol}
        </span>
        <button
          className="hover:text-arca-green"
          onClick={() => balance !== undefined && onChange(formatUnits(balance, meta.decimals))}
        >
          Balance {balance === undefined ? '…' : fmt(balance, meta.decimals)}
        </button>
      </div>
      <input
        inputMode="decimal"
        placeholder="0.0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-xl font-semibold tabular-nums text-arca-text outline-none placeholder:text-arca-text-secondary/40"
      />
    </div>
  );
}

function useErc20(token: `0x${string}`, owner: `0x${string}` | undefined) {
  const balance = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [owner ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: !!owner },
  });
  const allowance = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner ?? '0x0000000000000000000000000000000000000000', SHADOW_V2.vault],
    query: { enabled: !!owner },
  });
  return { balance: balance.data, allowance: allowance.data ?? 0n };
}

function DepositForm({ data }: { data: V2Data }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();
  const [wsInput, setWsInput] = useState('');
  const [usdcInput, setUsdcInput] = useState('');
  const [wrapInput, setWrapInput] = useState('');

  const ws = useErc20(WS, address);
  const usdc = useErc20(USDC, address);
  const native = useBalance({ address });

  const amountWs = safeParse(wsInput, 18);
  const amountUsdc = safeParse(usdcInput, 6);
  const amountWrap = safeParse(wrapInput, 18);

  const preview = useReadContract({
    address: SHADOW_V2.vault,
    abi: SHADOW_V2_VAULT_ABI,
    functionName: 'previewDeposit',
    args: [amountWs, amountUsdc],
    query: { enabled: amountWs > 0n || amountUsdc > 0n },
  });
  const expectedShares = preview.data ?? 0n;
  const previewValue = data.supply > 0n ? (data.vaultValueUsdc * expectedShares) / data.supply : null;

  const needsWsApproval = amountWs > ws.allowance;
  const needsUsdcApproval = amountUsdc > usdc.allowance;
  const tooMuch = (ws.balance !== undefined && amountWs > ws.balance) || (usdc.balance !== undefined && amountUsdc > usdc.balance);
  const busy = tx.pending !== null;

  function approve(token: `0x${string}`, key: string) {
    return tx.send(key, () =>
      writeContractAsync({
        address: token,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SHADOW_V2.vault, 2n ** 256n - 1n],
        gas: V2_GAS.approve,
      }),
    );
  }

  async function deposit() {
    const ok = await tx.send('deposit', () =>
      writeContractAsync({
        address: SHADOW_V2.vault,
        abi: SHADOW_V2_VAULT_ABI,
        functionName: 'deposit',
        // 1% tolerance on the preview, the price can move until the tx lands
        args: [amountWs, amountUsdc, (expectedShares * 99n) / 100n],
        gas: V2_GAS.deposit,
      }),
    );
    if (ok) {
      setWsInput('');
      setUsdcInput('');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <AmountInput token={WS} value={wsInput} onChange={setWsInput} balance={ws.balance} />
      <AmountInput token={USDC} value={usdcInput} onChange={setUsdcInput} balance={usdc.balance} />

      <div className="flex items-center justify-between px-1 text-xs text-arca-text-secondary">
        <span>You receive</span>
        <span className="tabular-nums text-arca-text">
          {expectedShares > 0n ? `${fmt(expectedShares, data.shareDecimals, 2)} shares ≈ ${fmtUsdc(previewValue)}` : '—'}
        </span>
      </div>

      {data.depositsPaused && <Notice tone="warn">Deposits are paused on this vault.</Notice>}
      {tooMuch && <Notice tone="warn">Amount above your balance.</Notice>}

      {needsWsApproval ? (
        <Button loading={tx.pending === 'approve-ws'} disabled={busy} onClick={() => approve(WS, 'approve-ws')}>
          Approve wS
        </Button>
      ) : needsUsdcApproval ? (
        <Button loading={tx.pending === 'approve-usdc'} disabled={busy} onClick={() => approve(USDC, 'approve-usdc')}>
          Approve USDC
        </Button>
      ) : (
        <Button
          loading={tx.pending === 'deposit'}
          disabled={busy || expectedShares === 0n || tooMuch || data.depositsPaused}
          onClick={deposit}
        >
          Deposit
        </Button>
      )}

      <details className="mt-2 rounded-xl bg-white/[0.02] px-3 py-2 text-xs text-arca-text-secondary">
        <summary className="cursor-pointer">Need wS? Wrap S</summary>
        <div className="mt-2 flex gap-2">
          <input
            inputMode="decimal"
            placeholder={`S (balance ${native.data ? fmt(native.data.value, 18, 2) : '…'})`}
            value={wrapInput}
            onChange={(e) => setWrapInput(e.target.value)}
            className="min-w-0 flex-1 rounded-lg bg-white/[0.04] px-2.5 py-2 text-arca-text outline-none"
          />
          <Button
            variant="secondary"
            loading={tx.pending === 'wrap'}
            disabled={busy || amountWrap === 0n}
            onClick={() =>
              tx.send('wrap', () =>
                writeContractAsync({ address: WS, abi: WRAP_ABI, functionName: 'deposit', value: amountWrap, gas: V2_GAS.approve }),
              ).then((ok) => ok && setWrapInput(''))
            }
          >
            Wrap
          </Button>
        </div>
      </details>

      {tx.error && <Notice tone="error">{tx.error}</Notice>}
    </div>
  );
}

const PERCENTS = [25, 50, 75, 100] as const;

function WithdrawForm({ data }: { data: V2Data }) {
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();
  const [percent, setPercent] = useState<number>(100);
  const shares = (data.userShares * BigInt(percent)) / 100n;

  const preview = useReadContract({
    address: SHADOW_V2.vault,
    abi: SHADOW_V2_VAULT_ABI,
    functionName: 'previewWithdraw',
    args: [shares],
    query: { enabled: shares > 0n },
  });
  const amounts = preview.data ?? [];

  async function withdraw() {
    // 1% tolerance on wS and USDC; side-pool tokens are paid in kind
    const minX = ((amounts[0] ?? 0n) * 99n) / 100n;
    const minY = ((amounts[1] ?? 0n) * 99n) / 100n;
    await tx.send('withdraw', () =>
      writeContractAsync({
        address: SHADOW_V2.vault,
        abi: SHADOW_V2_VAULT_ABI,
        functionName: 'withdraw',
        args: [shares, minX, minY],
        gas: V2_GAS.withdraw,
      }),
    );
  }

  if (data.userShares === 0n) {
    return <p className="py-6 text-center text-sm text-arca-text-secondary">You have no deposit in this vault.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {PERCENTS.map((p) => (
          <button
            key={p}
            onClick={() => setPercent(p)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium',
              percent === p ? 'bg-white/[0.08] text-arca-text' : 'bg-white/[0.03] text-arca-text-secondary hover:text-arca-text',
            )}
          >
            {p === 100 ? 'Max' : `${p}%`}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white/[0.03] p-3">
        <div className="mb-2 text-xs text-arca-text-secondary">You receive</div>
        {data.holdings.map((h, i) => {
          const token = v2Token(h.token);
          if (amounts[i] === 0n) return null;
          return (
            <div key={h.token} className="flex items-center gap-2 py-1 text-sm">
              <TokenIcon address={h.token} size={16} />
              <span className="flex-1 text-arca-text">{token.symbol}</span>
              <span className="tabular-nums text-arca-text">{amounts[i] === undefined ? '…' : fmt(amounts[i], token.decimals)}</span>
            </div>
          );
        })}
      </div>

      <Button loading={tx.pending === 'withdraw'} disabled={tx.pending !== null || shares === 0n} onClick={withdraw}>
        Withdraw
      </Button>
      {tx.error && <Notice tone="error">{tx.error}</Notice>}
    </div>
  );
}

function RewardsLine({ data }: { data: V2Data }) {
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();
  const claimable = data.pendingRewards.filter((r) => r.amount > 0n);
  if (claimable.length === 0) return null;
  const shadowPending =
    claimable.find((r) => r.token.toLowerCase() === COMPOUND.shadow.toLowerCase())?.amount ?? 0n;

  return (
    <div className="mt-5 border-t border-white/[0.06] pt-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-wrap gap-x-3 gap-y-1 text-sm">
          {claimable.map((r) => {
            const token = v2Token(r.token);
            return (
              <span key={r.token} className="flex items-center gap-1.5 tabular-nums text-arca-text">
                <TokenIcon address={r.token} size={16} />
                {fmt(r.amount, token.decimals, 6)} {token.symbol}
              </span>
            );
          })}
        </div>
        <Button
          variant="secondary"
          loading={tx.pending === 'claim'}
          disabled={tx.pending !== null}
          onClick={() =>
            tx.send('claim', () =>
              writeContractAsync({ address: SHADOW_V2.vault, abi: SHADOW_V2_VAULT_ABI, functionName: 'claim', gas: V2_GAS.claim }),
            )
          }
        >
          Claim
        </Button>
      </div>
      {shadowPending > 0n && <CompoundButton shadowAmount={shadowPending} />}
      {tx.error && <div className="mt-3"><Notice tone="error">{tx.error}</Notice></div>}
    </div>
  );
}
