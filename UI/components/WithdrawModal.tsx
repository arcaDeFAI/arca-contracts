'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract } from 'wagmi';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { formatTokenAmount, formatShares, parseShares, getShareDecimals } from '@/lib/utils';
import { formatUnits } from 'viem';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface WithdrawModalProps {
  vaultAddress: string;
  vaultName: string;
  userShares: bigint;
  tokenX?: string;
  tokenY?: string;
  onClose: () => void;
}

export function WithdrawModal({
  vaultAddress,
  vaultName,
  userShares,
  tokenX = 'S',
  tokenY = 'USDC',
  onClose
}: WithdrawModalProps) {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showClaim, setShowClaim] = useState(false);
  const { address } = useAccount();

  const { writeContract, data: txHash, isPending } = useWriteContract();

  const { isLoading: txLoading, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess && !showClaim) {
      setShowClaim(true);
    } else if (isSuccess && showClaim) {
      onClose();
    }
  }, [isSuccess, showClaim, onClose]);

  const handleMaxWithdraw = () => {
    const decimals = getShareDecimals(tokenY);
    const maxAmount = formatUnits(userShares, decimals);
    setWithdrawAmount(maxAmount);
  };

  const handleWithdraw = () => {
    writeContract({
      address: vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'queueWithdrawal',
      args: [withdrawAmount ? parseShares(withdrawAmount, tokenX, tokenY) : BigInt(0), address as `0x${string}`],
    });
  };

  const handleClaim = () => {
    writeContract({
      address: vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'claim',
    });
  };

  const isValidAmount = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) return false;
    try {
      const parsed = parseShares(amount, tokenX, tokenY);
      return parsed <= userShares;
    } catch {
      return false;
    }
  };

  const canProceed = withdrawAmount && isValidAmount(withdrawAmount);

  const withdrawShares = withdrawAmount ? parseShares(withdrawAmount, tokenX, tokenY) : 0n;

  const { data: previewData } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'previewAmounts',
    args: [withdrawShares],
    query: { enabled: withdrawShares > 0n }
  });

  const estimatedS = previewData ? previewData[0] : 0n;
  const estimatedUsdc = previewData ? previewData[1] : 0n;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fade-in">
      <div className="bg-arca-gray rounded-2xl p-6 w-full max-w-md border border-white/[0.06] shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-arca-text">
            {showClaim ? 'Claim Withdrawal' : `Withdraw from ${vaultName}`}
          </h2>
          <button
            onClick={onClose}
            className="text-arca-text-tertiary hover:text-arca-text transition-colors p-1 rounded-lg hover:bg-white/[0.04]"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {!showClaim ? (
          <div className="space-y-4">
            {/* Shares Input */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs text-arca-text-secondary font-medium">Shares to Withdraw</label>
                <span className="text-xs text-arca-text-tertiary">
                  Available: {formatShares(userShares, tokenX, tokenY)}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-arca-surface border border-white/[0.06] rounded-xl px-4 py-3 text-arca-text placeholder-arca-text-tertiary focus:border-arca-green/40 focus:outline-none focus:ring-1 focus:ring-arca-green/20 transition-all text-sm"
                />
                <button
                  onClick={handleMaxWithdraw}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-arca-green text-xs font-semibold hover:text-arca-green/80 transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Estimated Receive */}
            <div className="bg-arca-surface rounded-xl p-4 space-y-2 border border-white/[0.04]">
              <div className="text-xs text-arca-text-secondary mb-2">You will receive approximately:</div>
              <div className="flex justify-between">
                <span className="text-arca-text-secondary text-sm">{tokenX}:</span>
                <span className="text-arca-text font-medium text-sm">
                  {formatTokenAmount(estimatedS, tokenX.toUpperCase())}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-arca-text-secondary text-sm">{tokenY}:</span>
                <span className="text-arca-text font-medium text-sm">
                  {formatTokenAmount(estimatedUsdc, tokenY.toUpperCase())}
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-500/[0.06] border border-amber-500/[0.12] rounded-xl p-3">
              <p className="text-amber-400/80 text-xs leading-relaxed">
                ⚠️ Withdrawals are ONLY cancelable while QUEUED. You&apos;ll be able to claim on the DASHBOARD once ready (Next Rebalance).
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleWithdraw}
              disabled={!canProceed || isPending || txLoading}
              className="w-full bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-3 px-4 rounded-xl text-sm hover:bg-red-500/30 hover:border-red-500/40 transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending || txLoading ? 'Requesting Withdrawal...' : 'Request Withdrawal'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success State */}
            <div className="bg-arca-surface rounded-xl p-5 text-center border border-white/[0.04]">
              <div className="w-10 h-10 rounded-full bg-arca-green/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-arca-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-arca-text font-semibold mb-1">Withdrawal Ready!</p>
              <p className="text-arca-text-secondary text-xs">
                Your withdrawal has been processed and is ready to claim.
              </p>
            </div>

            {/* Claim Details */}
            <div className="bg-arca-surface rounded-xl p-4 space-y-2 border border-white/[0.04]">
              <div className="text-xs text-arca-text-secondary mb-2">You can claim:</div>
              <div className="flex justify-between">
                <span className="text-arca-text-secondary text-sm">SONIC:</span>
                <span className="text-arca-text font-medium text-sm">
                  {formatTokenAmount(estimatedS, 'SONIC')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-arca-text-secondary text-sm">USDC:</span>
                <span className="text-arca-text font-medium text-sm">
                  {formatTokenAmount(estimatedUsdc, 'USDC')}
                </span>
              </div>
            </div>

            {/* Claim Button */}
            <button
              onClick={handleClaim}
              disabled={isPending || txLoading}
              className="w-full bg-arca-green text-arca-dark font-semibold py-3 px-4 rounded-xl text-sm hover:bg-arca-green/90 hover:shadow-glow-green transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending || txLoading ? 'Claiming...' : 'Claim Withdrawal'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
