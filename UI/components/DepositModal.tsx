'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { ERC20_ABI } from '@/lib/contracts';
import { formatTokenAmount, parseTokenAmount } from '@/lib/utils';
import { formatUnits } from 'viem';
import { getTokenAddress, getTokenDecimals, getTokenBalance } from '@/lib/tokenHelpers';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface DepositModalProps {
  vaultAddress: string;
  stratAddress: string;
  vaultName: string;
  sonicBalance: bigint;
  wsBalance: bigint;
  usdcBalance: bigint;
  wethBalance?: bigint;
  tokenX?: string;
  tokenY?: string;
  onClose: () => void;
}

export function DepositModal({ 
  vaultAddress, 
  stratAddress, 
  vaultName, 
  sonicBalance,
  wsBalance,
  usdcBalance,
  wethBalance = 0n,
  tokenX = 'S',
  tokenY = 'USDC',
  onClose 
}: DepositModalProps) {
  const isShadowVault = vaultName.includes('Shadow');
  
  const [tokenAmount, setTokenAmount] = useState('');
  const [token2Amount, setToken2Amount] = useState('');
  const [tokenApproved, setTokenApproved] = useState(false);
  const [token2Approved, setToken2Approved] = useState(false);
  const [currentTx, setCurrentTx] = useState<'approve-token' | 'approve-token2' | 'deposit' | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [processedTxHash, setProcessedTxHash] = useState<string | null>(null);
  
  type Step = { label: string; status: 'pending' | 'processing' | 'complete' | 'error' };
  const [steps, setSteps] = useState<Step[]>([]);

  const { writeContract, data: txHash, isPending } = useWriteContract();

  // Only track the current transaction
  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Get balances using shared helper
  const balances = { sonicBalance, wsBalance, usdcBalance, wethBalance };
  const currentTokenBalance = getTokenBalance(tokenX, balances);
  const currentToken2Balance = getTokenBalance(tokenY, balances);
  const currentTokenType = tokenX.toUpperCase();
  const currentToken2Type = tokenY.toUpperCase();

  const handleMaxToken = () => {
    const decimals = getTokenDecimals(tokenX);
    const maxAmount = formatUnits(currentTokenBalance, decimals);
    setTokenAmount(maxAmount);
  };

  const handleMaxToken2 = () => {
    const decimals = getTokenDecimals(tokenY);
    const maxAmount = formatUnits(currentToken2Balance, decimals);
    setToken2Amount(maxAmount);
  };

  // Handle transaction success - update step status and continue
  useEffect(() => {
    // Only process if we have a new successful transaction
    if (txSuccess && showProgress && currentStep < steps.length && currentTx && txHash && txHash !== processedTxHash) {
      // Mark this transaction as processed
      setProcessedTxHash(txHash);
      
      // Mark current step as complete and next step as processing in one update
      const updatedSteps = [...steps];
      updatedSteps[currentStep] = { ...updatedSteps[currentStep], status: 'complete' };
      
      // Update approval states
      if (currentTx === 'approve-token') {
        setTokenApproved(true);
      } else if (currentTx === 'approve-token2') {
        setToken2Approved(true);
      }
      
      // Move to next step
      const nextStep = currentStep + 1;
      setCurrentTx(null); // Clear current tx
      
      if (nextStep < steps.length) {
        // Mark next step as processing in the same update
        updatedSteps[nextStep] = { ...updatedSteps[nextStep], status: 'processing' };
        
        // Update steps once with both changes
        setSteps(updatedSteps);
        setCurrentStep(nextStep);
        
        // Execute next step after a brief delay
        setTimeout(() => executeStep(nextStep), 500);
      } else {
        // All done! Update final step and close
        setSteps(updatedSteps);
        setTimeout(() => onClose(), 1500);
      }
    }
  }, [txSuccess, txHash]);

  const handleTokenApprove = () => {
    setCurrentTx('approve-token');
    writeContract({
      address: getTokenAddress(tokenX),
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [vaultAddress, parseTokenAmount(tokenAmount, tokenX.toUpperCase() as any)],
    });
  };

  const handleToken2Approve = () => {
    setCurrentTx('approve-token2');
    writeContract({
      address: getTokenAddress(tokenY),
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [vaultAddress, parseTokenAmount(token2Amount, tokenY.toUpperCase() as any)],
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
          tokenAmount ? parseTokenAmount(tokenAmount, tokenX.toUpperCase() as any) : BigInt(0),
          token2Amount ? parseTokenAmount(token2Amount, tokenY.toUpperCase() as any) : BigInt(0),
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
          tokenAmount ? parseTokenAmount(tokenAmount, tokenX.toUpperCase() as any) : BigInt(0),
          token2Amount ? parseTokenAmount(token2Amount, tokenY.toUpperCase() as any) : BigInt(0),
          BigInt(0),
        ],
        value: tokenAmount ? parseTokenAmount(tokenAmount, tokenX.toUpperCase() as any) : BigInt(0),
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
    (tokenAmount && isValidAmount(tokenAmount, currentTokenBalance, currentTokenType as any)) ||
    (token2Amount && isValidAmount(token2Amount, currentToken2Balance, currentToken2Type as any));

  // Check if approvals are needed
  const needsTokenApproval = isShadowVault && tokenAmount && parseFloat(tokenAmount) > 0 && !tokenApproved;
  const needsToken2Approval = token2Amount && parseFloat(token2Amount) > 0 && !token2Approved;
  
  // Execute a specific step (status is already set to 'processing' before calling this)
  const executeStep = (stepIndex: number) => {
    if (!steps || stepIndex >= steps.length) return;
    
    // Determine which transaction to execute based on step label
    const stepLabel = steps[stepIndex].label;
    if (stepLabel.includes(`Approve ${currentTokenType}`)) {
      handleTokenApprove();
    } else if (stepLabel.includes(`Approve ${currentToken2Type}`)) {
      handleToken2Approve();
    } else {
      handleDeposit();
    }
  };
  
  // Initialize deposit flow - show all steps that will happen
  const handleInitiateDeposit = () => {
    const depositSteps: Step[] = [];
    
    if (needsTokenApproval) {
      depositSteps.push({ label: `Approve ${currentTokenType}`, status: 'pending' });
    }
    if (needsToken2Approval) {
      depositSteps.push({ label: `Approve ${currentToken2Type}`, status: 'pending' });
    }
    depositSteps.push({ label: `Add liquidity to ${tokenX}/${tokenY}`, status: 'pending' });
    
    setSteps(depositSteps);
    setShowProgress(true);
    setCurrentStep(0);
    
    // Start executing first step immediately
    // Mark first step as processing
    depositSteps[0].status = 'processing';
    setSteps([...depositSteps]);
    
    // Execute the first transaction
    setTimeout(() => {
      if (needsTokenApproval) {
        handleTokenApprove();
      } else if (needsToken2Approval) {
        handleToken2Approve();
      } else {
        handleDeposit();
      }
    }, 300);
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
          {/* Token Input - Dynamic based on tokenX */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">
                {currentTokenType} Amount
              </label>
              <span className="text-sm text-gray-400">
                Balance: {formatTokenAmount(currentTokenBalance, currentTokenType as any)}
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

          {/* Token 2 Input */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">{currentToken2Type} Amount</label>
              <span className="text-sm text-gray-400">
                Balance: {formatTokenAmount(currentToken2Balance, currentToken2Type as any)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={token2Amount}
                onChange={(e) => setToken2Amount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-arca-dark border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-arca-green focus:outline-none"
              />
              <button
                onClick={handleMaxToken2}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-arca-green text-sm font-semibold hover:text-arca-green/80"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Progress Steps or Deposit Button */}
          {showProgress ? (
            <div className="space-y-3 mt-6">
              <h3 className="text-white font-semibold mb-4">Add Liquidity</h3>
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-arca-dark border border-gray-700"
                >
                  {step.status === 'complete' ? (
                    <div className="text-arca-green text-xl">✓</div>
                  ) : step.status === 'processing' ? (
                    <div className="text-orange-400 text-xl animate-spin">⟳</div>
                  ) : (
                    <div className="text-gray-500 text-xl">○</div>
                  )}
                  <span className={`flex-1 ${
                    step.status === 'complete' ? 'text-gray-400' :
                    step.status === 'processing' ? 'text-white' :
                    'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={handleInitiateDeposit}
              disabled={!canProceed}
              className="w-full bg-arca-green text-black font-semibold py-3 px-4 rounded-lg hover:bg-arca-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Deposit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
