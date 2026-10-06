'use client';

import { useState } from 'react';
import { usePublicClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, type Hash } from 'viem';

// Vault revert reasons (BaseVault__* on Metropolis, ShadowVault__* on Shadow) in plain words
const REVERT_MESSAGES: Record<string, string> = {
  WithdrawLocked: 'Withdrawals are locked for a short time after each deposit. Please try again later.',
  InvalidRound: "This withdrawal isn't ready yet — it will be after the next rebalance.",
  NoQueuedWithdrawal: 'There is nothing left to claim for this withdrawal.',
  MaxSharesExceeded: 'That is more than you have queued for withdrawal.',
  InsufficientShares: 'Price moved while depositing. Please try again.',
  ZeroShares: 'Enter an amount first.',
};

function describeError(err: unknown): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return 'Transaction rejected in wallet.';
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      const reason = revert.data.errorName.split('__').pop() ?? '';
      if (REVERT_MESSAGES[reason]) return REVERT_MESSAGES[reason];
    }
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : 'Transaction failed.';
}

/**
 * Sends a transaction, waits for it to be mined, then refreshes every on-chain query so
 * balances, rewards and withdrawals update without a page reload.
 *
 * `pending` holds the key of the action in flight, so each button can show its own spinner.
 */
export function useTx() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(key: string, write: () => Promise<Hash>): Promise<boolean> {
    if (!publicClient) return false;
    setPending(key);
    setError(null);
    try {
      const hash = await write();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted.');
      await queryClient.invalidateQueries();
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    } finally {
      setPending(null);
    }
  }

  return { send, pending, error, clearError: () => setError(null) };
}
