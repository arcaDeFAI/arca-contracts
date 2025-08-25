'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { METRO_VAULT_ABI } from '@/abi/MetroVault.abi';
import { ERC20_ABI, CONTRACTS } from '@/lib/contracts';
import { formatTokenAmount, parseTokenAmount } from '@/lib/utils';
import { formatUnits } from 'viem';
import { DECIMALS } from '@/lib/contracts';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface DepositModalProps {
  vaultAddress: string;
  stratAddress: string;
  vaultName: string;
  sonicBalance: bigint;
  usdcBalance: bigint;
  onClose: () => void;
}

export function DepositModal({ 
  vaultAddress, 
  stratAddress, 
  vaultName, 
  sonicBalance, 
  usdcBalance, 
  onClose 
}: DepositModalProps) {
  const [sonicAmount, setSonicAmount] = useState('');
  const [usdcAmount, setUsdcAmount] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [currentTx, setCurrentTx] = useState<'none' | 'approve' | 'deposit'>('none');

  const { writeContract, data: txHash, isPending } = useWriteContract();

  // Only track the current transaction
  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleMaxSonic = () => {
    // Use the raw balance converted to string for max precision
    const maxAmount = formatUnits(sonicBalance, DECIMALS.SONIC);
    setSonicAmount(maxAmount);
  };

  const handleMaxUsdc = () => {
    // Use the raw balance converted to string for max precision
    const maxAmount = formatUnits(usdcBalance, DECIMALS.USDC);
    setUsdcAmount(maxAmount);
  };

  // Handle transaction success
  if (txSuccess) {
    if (currentTx === 'approve') {
      setIsApproved(true);
      setCurrentTx('none');
    } else if (currentTx === 'deposit') {
      onClose();
    }
  }

  const handleApprove = async () => {
    setCurrentTx('approve');
    
    // Only approve USDC (S tokens don't need approval for depositNative)
    if (usdcAmount && parseFloat(usdcAmount) > 0) {
      writeContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [vaultAddress as `0x${string}`, parseTokenAmount(usdcAmount, 'USDC')],
      });
    }
  };

  const handleDeposit = () => {
    setCurrentTx('deposit');
    writeContract({
      address: vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'depositNative',
      args: [
        sonicAmount ? parseTokenAmount(sonicAmount, 'SONIC') : BigInt(0),
        usdcAmount ? parseTokenAmount(usdcAmount, 'USDC') : BigInt(0),
        BigInt(0),
      ],
      value: sonicAmount ? parseTokenAmount(sonicAmount, 'SONIC') : BigInt(0),
    });
  };

  const isValidAmount = (amount: string, balance: bigint, token: 'SONIC' | 'USDC') => {
    if (!amount || parseFloat(amount) <= 0) return false;
    try {
      const parsed = parseTokenAmount(amount, token);
      return parsed <= balance;
    } catch {
      return false;
    }
  };

  const canProceed = 
    (sonicAmount && isValidAmount(sonicAmount, sonicBalance, 'SONIC')) ||
    (usdcAmount && isValidAmount(usdcAmount, usdcBalance, 'USDC'));

  // Check if USDC approval is needed
  const needsUsdcApproval = usdcAmount && parseFloat(usdcAmount) > 0 && !isApproved;
  
  // Determine button text and action
  const getButtonText = () => {
    if (isPending || txLoading) {
      return currentTx === 'deposit' ? 'Depositing...' : 'Approving...';
    }
    if (needsUsdcApproval) {
      return 'Approve USDC';
    }
    return 'Deposit';
  };

  const handleButtonClick = () => {
    if (needsUsdcApproval) {
      handleApprove();
    } else {
      handleDeposit();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-arca-gray rounded-lg p-6 w-full max-w-md border border-arca-light-gray">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Deposit to {vaultName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* SONIC Input */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">S Amount</label>
              <span className="text-sm text-gray-400">
                Balance: {formatTokenAmount(sonicBalance, 'SONIC')}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={sonicAmount}
                onChange={(e) => setSonicAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-arca-dark border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-arca-green focus:outline-none"
              />
              <button
                onClick={handleMaxSonic}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-arca-green text-sm font-semibold hover:text-arca-green/80"
              >
                MAX
              </button>
            </div>
          </div>

          {/* USDC Input */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">USDC Amount</label>
              <span className="text-sm text-gray-400">
                Balance: {formatTokenAmount(usdcBalance, 'USDC')}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={usdcAmount}
                onChange={(e) => setUsdcAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-arca-dark border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-arca-green focus:outline-none"
              />
              <button
                onClick={handleMaxUsdc}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-arca-green text-sm font-semibold hover:text-arca-green/80"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleButtonClick}
            disabled={!canProceed || isPending || txLoading}
            className="w-full bg-arca-green text-black font-semibold py-3 px-4 rounded-lg hover:bg-arca-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {getButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
}
