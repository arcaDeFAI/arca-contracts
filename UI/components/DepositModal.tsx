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
  wsBalance: bigint;
  usdcBalance: bigint;
  onClose: () => void;
}

export function DepositModal({ 
  vaultAddress, 
  stratAddress, 
  vaultName, 
  sonicBalance,
  wsBalance,
  usdcBalance, 
  onClose 
}: DepositModalProps) {
  const isShadowVault = vaultName.includes('Shadow');
  
  const [tokenAmount, setTokenAmount] = useState('');
  const [usdcAmount, setUsdcAmount] = useState('');
  const [tokenApproved, setTokenApproved] = useState(false);
  const [usdcApproved, setUsdcApproved] = useState(false);
  const [currentTx, setCurrentTx] = useState<'approve-token' | 'approve-usdc' | 'deposit' | null>(null);

  const { writeContract, data: txHash, isPending } = useWriteContract();

  // Only track the current transaction
  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const currentTokenBalance = isShadowVault ? wsBalance : sonicBalance;
  const currentTokenType = isShadowVault ? 'WS' : 'SONIC';

  const handleMaxToken = () => {
    const decimals = isShadowVault ? DECIMALS.WS : DECIMALS.SONIC;
    const maxAmount = formatUnits(currentTokenBalance, decimals);
    setTokenAmount(maxAmount);
  };

  const handleMaxUsdc = () => {
    const maxAmount = formatUnits(usdcBalance, DECIMALS.USDC);
    setUsdcAmount(maxAmount);
  };

  // Handle transaction success
  if (txSuccess) {
    if (currentTx === 'approve-token') {
      setTokenApproved(true);
      setCurrentTx(null);
    } else if (currentTx === 'approve-usdc') {
      setUsdcApproved(true);
      setCurrentTx(null);
    } else if (currentTx === 'deposit') {
      onClose();
    }
  }

  const handleTokenApprove = () => {
    setCurrentTx('approve-token');
    writeContract({
      address: CONTRACTS.WS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [vaultAddress, parseTokenAmount(tokenAmount, 'WS')],
    });
  };

  const handleUsdcApprove = () => {
    setCurrentTx('approve-usdc');
    writeContract({
      address: CONTRACTS.USDC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [vaultAddress, parseTokenAmount(usdcAmount, 'USDC')],
    });
  };

  const handleDeposit = () => {
    setCurrentTx('deposit');
    
    if (isShadowVault) {
      // Shadow vault uses deposit function with wS tokens
      writeContract({
        address: vaultAddress as `0x${string}`,
        abi: METRO_VAULT_ABI,
        functionName: 'deposit',
        args: [
          tokenAmount ? parseTokenAmount(tokenAmount, 'WS') : BigInt(0),
          usdcAmount ? parseTokenAmount(usdcAmount, 'USDC') : BigInt(0),
          BigInt(0),
        ],
      });
    } else {
      // Metro vault uses depositNative with S tokens
      writeContract({
        address: vaultAddress as `0x${string}`,
        abi: METRO_VAULT_ABI,
        functionName: 'depositNative',
        args: [
          tokenAmount ? parseTokenAmount(tokenAmount, 'SONIC') : BigInt(0),
          usdcAmount ? parseTokenAmount(usdcAmount, 'USDC') : BigInt(0),
          BigInt(0),
        ],
        value: tokenAmount ? parseTokenAmount(tokenAmount, 'SONIC') : BigInt(0),
      });
    }
  };

  const isValidAmount = (amount: string, balance: bigint, token: 'SONIC' | 'WS' | 'USDC') => {
    if (!amount || parseFloat(amount) <= 0) return false;
    try {
      const parsed = parseTokenAmount(amount, token);
      return parsed <= balance;
    } catch {
      return false;
    }
  };

  const canProceed = 
    (tokenAmount && isValidAmount(tokenAmount, currentTokenBalance, currentTokenType)) ||
    (usdcAmount && isValidAmount(usdcAmount, usdcBalance, 'USDC'));

  // Check if approvals are needed
  const needsTokenApproval = isShadowVault && tokenAmount && parseFloat(tokenAmount) > 0 && !tokenApproved;
  const needsUsdcApproval = usdcAmount && parseFloat(usdcAmount) > 0 && !usdcApproved;
  
  // Determine button text and action
  const getButtonText = () => {
    if (isPending || txLoading) {
      return currentTx === 'deposit' ? 'Depositing...' : 'Approving...';
    }
    if (needsTokenApproval) {
      return 'Approve wS';
    }
    if (needsUsdcApproval) {
      return 'Approve USDC';
    }
    return 'Deposit';
  };

  const handleButtonClick = () => {
    if (needsTokenApproval) {
      handleTokenApprove();
    } else if (needsUsdcApproval) {
      handleUsdcApprove();
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
          {/* Token Input - wS for Shadow, S for Metro */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">
                {isShadowVault ? 'wS Amount' : 'S Amount'}
              </label>
              <span className="text-sm text-gray-400">
                Balance: {formatTokenAmount(currentTokenBalance, currentTokenType)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-arca-dark border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-arca-green focus:outline-none"
              />
              <button
                onClick={handleMaxToken}
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
