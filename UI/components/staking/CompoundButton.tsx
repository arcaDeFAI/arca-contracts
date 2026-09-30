'use client';

import { useState } from 'react';
import { useAccount, useCapabilities, useConfig, usePublicClient, useSendCalls, useSendTransaction } from 'wagmi';
import { waitForCallsStatus } from 'wagmi/actions';
import { useQueryClient } from '@tanstack/react-query';
import { encodeFunctionData, encodePacked, formatUnits, type Hex } from 'viem';
import { SHADOW_V2_VAULT_ABI } from '@/lib/abis/shadowV2Abis';
import { COMPOUND, SHADOW_V2, V2_GAS } from '@/lib/shadowV2';
import { useTx } from '@/hooks/useTx';
import { Button, Notice } from '@/components/ui';

const SONIC_CHAIN_ID = 146;

const ERC20_APPROVE_ABI = [
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

// Shadow (Ramses V3) SwapRouter: the path is token | tickSpacing (3 bytes) | token ...
const ROUTER_ABI = [
  {
    type: 'function',
    name: 'exactInput',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'path', type: 'bytes' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

const POOL_ABI = [
  {
    type: 'function',
    name: 'slot0',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
  { type: 'function', name: 'fee', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint24' }] },
] as const;

interface Step {
  label: string;
  to: `0x${string}`;
  data: Hex;
  gas: bigint;
}

/**
 * Claim & compound: claim the vault rewards, swap the SHADOW to wS on Shadow
 * (via USDC, cheaper than the direct pools), deposit the wS back into the vault.
 *
 * With a wallet that supports atomic batches (EIP-5792 wallet_sendCalls,
 * e.g. a MetaMask smart account) it is ONE signature and all-or-nothing.
 * Otherwise the same steps are sent one by one with fixed gas limits (Sonic's
 * gas estimate is too low for deposits).
 *
 * The swap minimum and the deposit amount are fixed before signing from the
 * pool prices (minus both pool fees and a 2% margin), so the ~2% margin of wS
 * stays in the wallet when the swap does better than its minimum.
 */
export function CompoundButton({ shadowAmount }: { shadowAmount: bigint }) {
  const { address } = useAccount();
  const config = useConfig();
  const publicClient = usePublicClient({ chainId: SONIC_CHAIN_ID });
  const queryClient = useQueryClient();
  const { data: caps } = useCapabilities({ chainId: SONIC_CHAIN_ID });
  const { sendCallsAsync } = useSendCalls();
  const { sendTransactionAsync } = useSendTransaction();
  const tx = useTx();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const atomicStatus = caps?.atomic?.status;
  const canBatch = atomicStatus === 'supported' || atomicStatus === 'ready';

  async function buildSteps(): Promise<{ steps: Step[]; minWs: bigint }> {
    if (!publicClient || !address) throw new Error('Wallet not connected.');
    const read = (pool: `0x${string}`) =>
      Promise.all([
        publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: 'slot0' }),
        publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: 'fee' }),
      ]);
    const [[slotA, feeA], [slotB, feeB]] = await Promise.all([
      read(COMPOUND.shadowUsdcPool),
      read(COMPOUND.wsUsdcPool),
    ]);
    const q192 = 2n ** 192n;
    const afterFee = (x: bigint, fee: number) => (x * (1_000_000n - BigInt(fee))) / 1_000_000n;
    // hop 1: SHADOW (token1) -> USDC (token0): out = in * 2^192 / sqrtP^2
    const usdc = afterFee((shadowAmount * q192) / (slotA[0] * slotA[0]), feeA);
    // hop 2: USDC (token1) -> wS (token0): same direction, same formula
    const ws = afterFee((usdc * q192) / (slotB[0] * slotB[0]), feeB);
    const minWs = (ws * (10_000n - COMPOUND.swapSlippageBps)) / 10_000n;
    if (minWs === 0n) throw new Error('Rewards too small to swap.');

    const shares = await publicClient.readContract({
      address: SHADOW_V2.vault,
      abi: SHADOW_V2_VAULT_ABI,
      functionName: 'previewDeposit',
      args: [minWs, 0n],
    });
    const minShares = (shares * (10_000n - COMPOUND.shareSlippageBps)) / 10_000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
    const path = encodePacked(
      ['address', 'uint24', 'address', 'uint24', 'address'],
      [COMPOUND.shadow, COMPOUND.shadowUsdcSpacing, COMPOUND.usdc, COMPOUND.wsUsdcSpacing, COMPOUND.ws],
    );

    // Approvals the wallet already gave are skipped: fewer confirmations, and
    // some wallets (Rabby) show misleading simulation errors on them.
    const [shadowAllowance, wsAllowance] = await Promise.all([
      publicClient.readContract({
        address: COMPOUND.shadow, abi: ERC20_APPROVE_ABI, functionName: 'allowance', args: [address, COMPOUND.router],
      }),
      publicClient.readContract({
        address: COMPOUND.ws, abi: ERC20_APPROVE_ABI, functionName: 'allowance', args: [address, SHADOW_V2.vault],
      }),
    ]);

    const steps: Step[] = [
      {
        label: 'Claim rewards',
        to: SHADOW_V2.vault,
        data: encodeFunctionData({ abi: SHADOW_V2_VAULT_ABI, functionName: 'claim' }),
        gas: V2_GAS.claim,
      },
      {
        label: 'Approve SHADOW',
        to: COMPOUND.shadow,
        data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: 'approve', args: [COMPOUND.router, shadowAmount] }),
        gas: V2_GAS.approve,
      },
      {
        label: 'Swap SHADOW → USDC → wS',
        to: COMPOUND.router,
        data: encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: 'exactInput',
          args: [{ path, recipient: address, deadline, amountIn: shadowAmount, amountOutMinimum: minWs }],
        }),
        gas: V2_GAS.swap,
      },
      {
        label: 'Approve wS',
        to: COMPOUND.ws,
        data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: 'approve', args: [SHADOW_V2.vault, minWs] }),
        gas: V2_GAS.approve,
      },
      {
        label: 'Deposit',
        to: SHADOW_V2.vault,
        data: encodeFunctionData({
          abi: SHADOW_V2_VAULT_ABI,
          functionName: 'deposit',
          args: [minWs, 0n, minShares],
        }),
        gas: V2_GAS.deposit,
      },
    ];
    return {
      steps: steps.filter(
        (step) =>
          !(step.label === 'Approve SHADOW' && shadowAllowance >= shadowAmount) &&
          !(step.label === 'Approve wS' && wsAllowance >= minWs),
      ),
      minWs,
    };
  }

  async function compound() {
    setBusy(true);
    setError(null);
    try {
      const { steps, minWs } = await buildSteps();
      const wsOut = Number(formatUnits(minWs, 18)).toLocaleString('en-US', { maximumFractionDigits: 4 });
      if (canBatch) {
        setStatus(`One signature: claim, swap and deposit ≥ ${wsOut} wS`);
        const { id } = await sendCallsAsync({
          chainId: SONIC_CHAIN_ID,
          forceAtomic: true,
          calls: steps.map((s) => ({ to: s.to, data: s.data })),
        });
        const result = await waitForCallsStatus(config, { id });
        if (result.status !== 'success') throw new Error('The batch was not executed (nothing changed).');
      } else {
        for (const [i, s] of steps.entries()) {
          setStatus(`Step ${i + 1}/${steps.length}: ${s.label}`);
          const ok = await tx.send(`compound-${i}`, () =>
            sendTransactionAsync({ to: s.to, data: s.data, gas: s.gas, chainId: SONIC_CHAIN_ID }),
          );
          if (!ok) throw new Error(`Stopped at step ${i + 1} (${s.label}).`);
        }
      }
      setStatus(`Compounded: ≥ ${wsOut} wS deposited back into the vault.`);
      await queryClient.invalidateQueries();
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : 'Compound failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <Button className="w-full" loading={busy} disabled={busy || shadowAmount === 0n} onClick={compound}>
        Claim & compound into wS
      </Button>
      <p className="mt-1.5 text-xs text-arca-text-secondary">
        {canBatch
          ? 'One signature: claim → swap to wS → deposit, all or nothing.'
          : 'Your wallet can’t batch: one confirmation per step (claim, swap, deposit, plus any missing approval).'}
      </p>
      {status && <p className="mt-1.5 text-xs text-arca-text">{status}</p>}
      {(error || tx.error) && (
        <div className="mt-2">
          <Notice tone="error">{error ?? tx.error}</Notice>
        </div>
      )}
    </div>
  );
}
