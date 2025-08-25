'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract } from 'wagmi';
import { METRO_VAULT_ABI } from '@/abi/MetroVault.abi';
import { formatTokenAmount, parseTokenAmount, formatShares, parseShares } from '@/lib/utils';
import { formatUnits } from 'viem';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface WithdrawModalProps {
  vaultAddress: string;
  vaultName: string;
  userShares: bigint;
  userSBalance: bigint;
  userUsdcBalance: bigint;
  onClose: () => void;
}

export function WithdrawModal({ 
  vaultAddress, 
  vaultName, 
  userShares,
  userSBalance,
  userUsdcBalance,
  onClose 
}: WithdrawModalProps) {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showClaim, setShowClaim] = useState(false);
  const { address } = useAccount();

  const { writeContract, data: txHash, isPending } = useWriteContract();

  const { isLoading: txLoading, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Handle transaction success
  if (isSuccess && !showClaim) {
    setShowClaim(true);
  } else if (isSuccess && showClaim) {
    onClose();
  }

  const handleMaxWithdraw = () => {
    // Use the raw shares converted to string for max precision
    const maxAmount = formatUnits(userShares, 10); // 10^-10 decimals for shares
    setWithdrawAmount(maxAmount);
  };

  const handleWithdraw = () => {
    writeContract({
      address: vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'queueWithdrawal',
      args: [withdrawAmount ? parseShares(withdrawAmount) : BigInt(0), address as `0x${string}`],
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
      const parsed = parseShares(amount);
      return parsed <= userShares;
    } catch {
      return false;
    }
  };

  const canProceed = withdrawAmount && isValidAmount(withdrawAmount);

  // Get preview amounts from contract
  const withdrawShares = withdrawAmount ? parseShares(withdrawAmount) : 0n;
  
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-arca-gray rounded-lg p-6 w-full max-w-md border border-arca-light-gray">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {showClaim ? 'Claim Withdrawal' : `Withdraw from ${vaultName}`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {!showClaim ? (
          <div className="space-y-4">
            {/* Shares Input */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm text-gray-400">Shares to Withdraw</label>
                <span className="text-sm text-gray-400">
                  Available: {formatShares(userShares)}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-arca-dark border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-arca-green focus:outline-none"
                />
                <button
                  onClick={handleMaxWithdraw}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-arca-green text-sm font-semibold hover:text-arca-green/80"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Estimated Withdrawal */}
            <div className="bg-arca-dark rounded-lg p-4 space-y-2">
              <div className="text-sm text-gray-400 mb-2">You will receive approximately:</div>
              <div className="flex justify-between">
                <span className="text-gray-400">SONIC:</span>
                <span className="text-white font-semibold">
                  {formatTokenAmount(estimatedS, 'SONIC')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">USDC:</span>
                <span className="text-white font-semibold">
                  {formatTokenAmount(estimatedUsdc, 'USDC')}
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3">
              <p className="text-yellow-400 text-sm">
                ⚠️ Withdrawals are queued and may take some time to process. You'll be able to claim once ready.
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleWithdraw}
              disabled={!canProceed || isPending || txLoading}
              className="w-full bg-red-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || txLoading ? 'Requesting Withdrawal...' : 'Request Withdrawal'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Claim Status */}
            <div className="bg-arca-dark rounded-lg p-4 text-center">
              <div className="text-arca-green text-2xl mb-2">✓</div>
              <p className="text-white font-semibold mb-2">Withdrawal Ready!</p>
              <p className="text-gray-400 text-sm">
                Your withdrawal has been processed and is ready to claim.
              </p>
            </div>

            {/* Claim Details */}
            <div className="bg-arca-dark rounded-lg p-4 space-y-2">
              <div className="text-sm text-gray-400 mb-2">You can claim:</div>
              <div className="flex justify-between">
                <span className="text-gray-400">SONIC:</span>
                <span className="text-white font-semibold">
                  {formatTokenAmount(estimatedS, 'SONIC')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">USDC:</span>
                <span className="text-white font-semibold">
                  {formatTokenAmount(estimatedUsdc, 'USDC')}
                </span>
              </div>
            </div>

            {/* Claim Button */}
            <button
              onClick={handleClaim}
              disabled={isPending || txLoading}
              className="w-full bg-arca-green text-black font-semibold py-3 px-4 rounded-lg hover:bg-arca-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || txLoading ? 'Claiming...' : 'Claim Withdrawal'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
