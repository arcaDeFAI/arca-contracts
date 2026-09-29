'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { formatUnits } from 'viem';
import { CheckIcon } from '@heroicons/react/20/solid';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { ERC20_ABI } from '@/lib/contracts';
import { getToken } from '@/lib/tokenRegistry';
import { getTokenLogo, getTokenPrice } from '@/lib/tokenHelpers';
import { formatTokenAmount, formatUSD, parseTokenAmount, cn } from '@/lib/utils';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { usePrices } from '@/contexts/PriceContext';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useTx } from '@/hooks/useTx';
import { formatDuration, useVaultFees } from '@/hooks/useVaultFees';
import { penaltyRate, usePoints } from '@/hooks/usePoints';
import { Button, Card, ConnectWalletButton, Notice, Segmented, Spinner } from '@/components/ui';

type Tab = 'deposit' | 'withdraw';

const TAB_OPTIONS = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw' },
] as const;

export function DepositWithdrawPanel({ config, userShares }: { config: VaultConfig; userShares: bigint }) {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>('deposit');

  return (
    <Card className="p-5">
      <div className="mb-5">
        <Segmented options={TAB_OPTIONS} value={tab} onChange={setTab} />
      </div>
      {!isConnected ? (
        <div className="py-6 text-center">
          <p className="mb-4 text-sm text-arca-text-secondary">Connect your wallet to {tab}.</p>
          <ConnectWalletButton />

        </div>
      ) : tab === 'deposit' ? (
        <DepositForm config={config} />
      ) : (
        <WithdrawForm config={config} userShares={userShares} />
      )}
    </Card>
  );
}

// ─── Deposit ─────────────────────────────────────────────────────────────────

type StepStatus = 'waiting' | 'active' | 'done';
interface Step {
  key: string;
  label: string;
  status: StepStatus;
}

function safeParse(amount: string, token: string): bigint {
  if (!amount || Number(amount) <= 0) return 0n;
  try {
    return parseTokenAmount(amount, token);
  } catch {
    return 0n;
  }
}

function DepositForm({ config }: { config: VaultConfig }) {
  const { address } = useAccount();
  const { prices } = usePrices();
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();
  const vault = config.vaultAddress as `0x${string}`;

  const tokenXDef = getToken(config.tokenX);
  const tokenYDef = getToken(config.tokenY);
  const isNativeX = tokenXDef?.isNative ?? false;

  const [amountX, setAmountX] = useState('');
  const [amountY, setAmountY] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [done, setDone] = useState(false);

  const balanceX = (useTokenBalance(tokenXDef?.address ?? null, address).data as bigint | undefined) ?? 0n;
  const balanceY = (useTokenBalance(tokenYDef?.address ?? null, address).data as bigint | undefined) ?? 0n;

  const { data: allowances } = useReadContracts({
    contracts: [
      { address: tokenXDef?.address ?? undefined, abi: ERC20_ABI, functionName: 'allowance', args: [address as `0x${string}`, vault] },
      { address: tokenYDef?.address ?? undefined, abi: ERC20_ABI, functionName: 'allowance', args: [address as `0x${string}`, vault] },
    ],
    query: { enabled: !!address },
  });
  // ERC20_ABI is a legacy `constant` ABI, so wagmi can't infer the uint256 return type
  const allowanceX = (allowances?.[0]?.result as bigint | undefined) ?? 0n;
  const allowanceY = (allowances?.[1]?.result as bigint | undefined) ?? 0n;

  const parsedX = safeParse(amountX, config.tokenX);
  const parsedY = safeParse(amountY, config.tokenY);
  const overX = parsedX > balanceX;
  const overY = parsedY > balanceY;
  const usdValue =
    (Number(parsedX) / 10 ** (tokenXDef?.decimals ?? 18)) * getTokenPrice(config.tokenX, prices) +
    (Number(parsedY) / 10 ** (tokenYDef?.decimals ?? 18)) * getTokenPrice(config.tokenY, prices);

  const canDeposit = (parsedX > 0n || parsedY > 0n) && !overX && !overY && tx.pending === null;

  async function handleDeposit() {
    setDone(false);
    const needApproveX = !isNativeX && parsedX > 0n && allowanceX < parsedX;
    const needApproveY = parsedY > 0n && allowanceY < parsedY;

    const plan: Step[] = [
      ...(needApproveX ? [{ key: 'approveX', label: `Approve ${config.tokenX}`, status: 'waiting' as const }] : []),
      ...(needApproveY ? [{ key: 'approveY', label: `Approve ${config.tokenY}`, status: 'waiting' as const }] : []),
      { key: 'deposit', label: 'Deposit', status: 'waiting' },
    ];
    setSteps(plan);

    const mark = (key: string, status: StepStatus) =>
      setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status } : s)));

    for (const step of plan) {
      mark(step.key, 'active');
      let ok = false;
      if (step.key === 'approveX' && tokenXDef?.address) {
        ok = await tx.send('approveX', () =>
          writeContractAsync({ address: tokenXDef.address!, abi: ERC20_ABI, functionName: 'approve', args: [vault, parsedX] }),
        );
      } else if (step.key === 'approveY' && tokenYDef?.address) {
        ok = await tx.send('approveY', () =>
          writeContractAsync({ address: tokenYDef.address!, abi: ERC20_ABI, functionName: 'approve', args: [vault, parsedY] }),
        );
      } else if (step.key === 'deposit') {
        ok = await tx.send('deposit', () =>
          isNativeX
            ? writeContractAsync({ address: vault, abi: METRO_VAULT_ABI, functionName: 'depositNative', args: [parsedX, parsedY, 0n], value: parsedX })
            : writeContractAsync({ address: vault, abi: METRO_VAULT_ABI, functionName: 'deposit', args: [parsedX, parsedY, 0n] }),
        );
      }
      if (!ok) {
        setSteps([]);
        return;
      }
      mark(step.key, 'done');
    }

    setAmountX('');
    setAmountY('');
    setSteps([]);
    setDone(true);
  }

  return (
    <div className="space-y-3">
      <AmountInput
        token={config.tokenX}
        value={amountX}
        onChange={setAmountX}
        balance={balanceX}
        invalid={overX}
      />
      <AmountInput
        token={config.tokenY}
        value={amountY}
        onChange={setAmountY}
        balance={balanceY}
        invalid={overY}
      />
      <p className="px-1 text-xs text-arca-text-secondary">
        You can deposit either token or both. The vault balances them for you.
      </p>

      {steps.length > 0 && <StepList steps={steps} />}
      {tx.error && <Notice tone="error">{tx.error}</Notice>}
      {done && <Notice>Deposit confirmed. Your balance will update in a few seconds.</Notice>}

      <Button className="w-full py-3" onClick={handleDeposit} disabled={!canDeposit} loading={tx.pending !== null}>
        {overX || overY ? 'Insufficient balance' : usdValue > 0 ? `Deposit ${formatUSD(usdValue)}` : 'Deposit'}
      </Button>
    </div>
  );
}

function AmountInput({
  token,
  value,
  onChange,
  balance,
  invalid,
}: {
  token: string;
  value: string;
  onChange: (v: string) => void;
  balance: bigint;
  invalid: boolean;
}) {
  const decimals = getToken(token)?.decimals ?? 18;
  return (
    <div className={cn('rounded-xl border bg-arca-dark/60 px-3.5 py-3', invalid ? 'border-red-500/40' : 'border-white/[0.06] focus-within:border-arca-green/40')}>
      <div className="flex items-center gap-3">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(',', '.');
            if (/^\d*\.?\d*$/.test(v)) onChange(v);
          }}
          placeholder="0.0"
          aria-label={`${token} amount`}
          className="min-w-0 flex-1 bg-transparent text-lg font-medium tabular-nums text-arca-text placeholder-arca-text-tertiary outline-none"
        />
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1">
          <img src={getTokenLogo(token)} alt="" className="h-5 w-5 rounded-full" />
          <span className="text-sm font-medium text-arca-text">{token}</span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-arca-text-secondary">
        <span>Balance: {formatTokenAmount(balance, token)}</span>
        <button
          type="button"
          onClick={() => onChange(formatUnits(balance, decimals))}
          disabled={balance === 0n}
          className="font-semibold text-arca-green hover:text-arca-green/80 disabled:opacity-40"
        >
          Max
        </button>
      </div>
    </div>
  );
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-1.5 rounded-xl bg-white/[0.03] p-3">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2.5 text-sm">
          <span className="flex h-5 w-5 items-center justify-center">
            {s.status === 'done' ? (
              <CheckIcon className="h-4 w-4 text-arca-green" />
            ) : s.status === 'active' ? (
              <Spinner className="text-arca-green" />
            ) : (
              <span className="text-xs text-arca-text-tertiary">{i + 1}</span>
            )}
          </span>
          <span className={s.status === 'waiting' ? 'text-arca-text-tertiary' : 'text-arca-text'}>
            {s.label}
            {s.status === 'active' && <span className="text-arca-text-secondary"> — confirm in your wallet</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ─── Withdraw ────────────────────────────────────────────────────────────────

const PERCENT_PRESETS = [25, 50, 75, 100] as const;

function WithdrawForm({ config, userShares }: { config: VaultConfig; userShares: bigint }) {
  const { address } = useAccount();
  const { prices } = usePrices();
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();
  const vault = config.vaultAddress as `0x${string}`;

  const { cooldownSeconds } = useVaultFees(config);
  const pointsPos = usePoints(address)?.byVault.get(config.vaultAddress.toLowerCase());
  const [amountUsd, setAmountUsd] = useState('');
  const [isMax, setIsMax] = useState(false);
  const [queued, setQueued] = useState(false);

  const toUsd = (x: bigint, y: bigint) =>
    (Number(x) / 10 ** (getToken(config.tokenX)?.decimals ?? 18)) * getTokenPrice(config.tokenX, prices) +
    (Number(y) / 10 ** (getToken(config.tokenY)?.decimals ?? 18)) * getTokenPrice(config.tokenY, prices);

  // Whole position in USD — the typed amount is converted to the same fraction of the user's shares
  const { data: fullPreview } = useReadContract({
    address: vault,
    abi: METRO_VAULT_ABI,
    functionName: 'previewAmounts',
    args: [userShares],
    query: { enabled: userShares > 0n },
  });
  const positionUsd = fullPreview ? toUsd(fullPreview[0], fullPreview[1]) : 0;

  const typed = Number(amountUsd) || 0;
  const overMax = !isMax && positionUsd > 0 && typed > positionUsd * 1.0001;
  let shares = 0n;
  if (isMax) {
    shares = userShares; // exact balance, so no dust is left behind
  } else if (typed > 0 && positionUsd > 0 && !overMax) {
    const fraction = Math.min(typed / positionUsd, 1);
    shares = (userShares * BigInt(Math.round(fraction * 1_000_000))) / 1_000_000n;
  }

  const { data: preview } = useReadContract({
    address: vault,
    abi: METRO_VAULT_ABI,
    functionName: 'previewAmounts',
    args: [shares],
    query: { enabled: shares > 0n },
  });
  const [outX, outY] = shares > 0n && preview ? preview : [0n, 0n];
  const outUsd = toUsd(outX, outY);

  const pointsLost =
    pointsPos && shares > 0n && userShares > 0n
      ? pointsPos.points * (Number(shares) / Number(userShares)) * penaltyRate(Date.now() / 1000 - pointsPos.avgEntryTime)
      : 0;

  function pickPercent(p: number) {
    setIsMax(p === 100);
    setAmountUsd(positionUsd > 0 ? ((positionUsd * p) / 100).toFixed(2) : '');
  }

  if (userShares === 0n) {
    return <p className="py-6 text-center text-sm text-arca-text-secondary">You have nothing deposited in this vault.</p>;
  }

  async function handleWithdraw() {
    setQueued(false);
    const ok = await tx.send('withdraw', () =>
      writeContractAsync({ address: vault, abi: METRO_VAULT_ABI, functionName: 'queueWithdrawal', args: [shares, address as `0x${string}`] }),
    );
    if (ok) {
      setQueued(true);
      setAmountUsd('');
      setIsMax(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div
          className={cn(
            'rounded-xl border bg-arca-dark/60 px-3.5 py-3',
            overMax ? 'border-red-500/40' : 'border-white/[0.06] focus-within:border-arca-green/40',
          )}
        >
          <div className="flex items-center gap-1">
            <span className="text-lg font-medium text-arca-text-secondary">$</span>
            <input
              inputMode="decimal"
              value={amountUsd}
              onChange={(e) => {
                const v = e.target.value.replace(',', '.');
                if (/^\d*\.?\d*$/.test(v)) {
                  setIsMax(false);
                  setAmountUsd(v);
                }
              }}
              placeholder="0.00"
              aria-label="Amount to withdraw in USD"
              className="min-w-0 flex-1 bg-transparent text-lg font-medium tabular-nums text-arca-text placeholder-arca-text-tertiary outline-none"
            />
          </div>
          <div className="mt-1.5 text-xs text-arca-text-secondary">
            {overMax ? (
              <span className="text-red-300">More than your position of {formatUSD(positionUsd)}</span>
            ) : (
              <>Your position: {formatUSD(positionUsd)}</>
            )}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PERCENT_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => pickPercent(p)}
              className={cn(
                'rounded-lg py-2 text-sm font-medium transition-colors',
                (p === 100 ? isMax : !isMax && positionUsd > 0 && amountUsd === ((positionUsd * p) / 100).toFixed(2))
                  ? 'bg-white/[0.1] text-arca-text'
                  : 'bg-white/[0.04] text-arca-text-secondary hover:text-arca-text',
              )}
            >
              {p === 100 ? 'Max' : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 rounded-xl bg-white/[0.03] p-3.5 text-sm">
        <div className="mb-1 flex justify-between text-xs text-arca-text-secondary">
          <span>You receive (estimate)</span>
          <span>{formatUSD(outUsd)}</span>
        </div>
        <TokenLine token={config.tokenX} amount={outX} />
        <TokenLine token={config.tokenY} amount={outY} />
      </div>

      <Notice>
        Withdrawals are processed at the next rebalance, then you claim them here. You can cancel until then.
        {cooldownSeconds !== null && cooldownSeconds > 0 && (
          <> You can request a withdrawal {formatDuration(cooldownSeconds)} after your last deposit.</>
        )}
      </Notice>
      {pointsLost >= 1 && (
        <Notice tone="warn">
          Withdrawing this now removes about {Math.round(pointsLost).toLocaleString()} points. Points are kept after
          90 days of holding.
        </Notice>
      )}
      {tx.error && <Notice tone="error">{tx.error}</Notice>}
      {queued && <Notice>Withdrawal requested. It will be ready to claim after the next rebalance.</Notice>}

      <Button className="w-full py-3" onClick={handleWithdraw} disabled={shares === 0n} loading={tx.pending !== null}>
        Request withdrawal
      </Button>
    </div>
  );
}

function TokenLine({ token, amount }: { token: string; amount: bigint }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-arca-text-secondary">
        <img src={getTokenLogo(token)} alt="" className="h-4 w-4 rounded-full" />
        {token}
      </span>
      <span className="tabular-nums text-arca-text">{formatTokenAmount(amount, token)}</span>
    </div>
  );
}
