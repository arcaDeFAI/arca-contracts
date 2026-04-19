'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { ERC20_ABI } from '@/lib/contracts';
import { formatTokenAmount, parseTokenAmount } from '@/lib/utils';
import { formatUnits } from 'viem';
import { getTokenAddress, getTokenDecimals } from '@/lib/tokenHelpers';
import { getToken } from '@/lib/tokenRegistry';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface DepositModalProps {
  vaultAddress: string;
  stratAddress: string;
  vaultName: string;
  tokenXBalance: bigint;
  tokenYBalance: bigint;
  tokenX: string;
  tokenY: string;
  onClose: () => void;
}

function StepStatusIcon({ status }: { status: 'pending' | 'processing' | 'complete' | 'error' }) {
  if (status === 'complete') {
    return (
      <div className="relative h-5 w-5 shrink-0">
        <svg
          className="absolute inset-0 h-5 w-5 text-arca-green"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="arca-step-circle"
          />
          <path
            d="M7.5 12.5l2.8 2.8 6.2-6.6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="arca-step-check"
          />
        </svg>
      </div>
    );
  }

  if (status === 'processing') {
    return <div className="h-5 w-5 shrink-0 rounded-full border-2 border-arca-green border-t-transparent animate-spin" />;
  }

  return <div className="h-5 w-5 shrink-0 rounded-full border border-white/[0.08] bg-white/[0.02]" />;
}

export function DepositModal({
  vaultAddress,
  stratAddress,
  vaultName,
  tokenXBalance,
  tokenYBalance,
  tokenX,
  tokenY,
  onClose
}: DepositModalProps) {
  const tokenXDef = getToken(tokenX);
  const useNativeDeposit = tokenXDef?.isNative ?? false;

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

  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const currentTokenBalance = tokenXBalance;
  const currentToken2Balance = tokenYBalance;
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

  useEffect(() => {
    if (txSuccess && showProgress && currentStep < steps.length && currentTx && txHash && txHash !== processedTxHash) {
      setProcessedTxHash(txHash);

      const updatedSteps = [...steps];
      updatedSteps[currentStep] = { ...updatedSteps[currentStep], status: 'complete' };

      if (currentTx === 'approve-token') {
        setTokenApproved(true);
      } else if (currentTx === 'approve-token2') {
        setToken2Approved(true);
      }

      const nextStep = currentStep + 1;
      setCurrentTx(null);

      if (nextStep < steps.length) {
        updatedSteps[nextStep] = { ...updatedSteps[nextStep], status: 'processing' };
        setSteps(updatedSteps);
        setCurrentStep(nextStep);
        setTimeout(() => executeStep(nextStep), 500);
      } else {
        setSteps(updatedSteps);
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('arca:toast', {
                detail: {
                  title: 'Deposit completed successfully',
                  description: `Liquidity was added to ${vaultName}.`,
                },
              }),
            );
          }
          onClose();
        }, 1500);
      }
    }
  }, [txSuccess, txHash]);

  const handleTokenApprove = () => {
    setCurrentTx('approve-token');
    writeContract({
      address: getTokenAddress(tokenX),
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [vaultAddress, parseTokenAmount(tokenAmount, tokenX)],
    });
  };

  const handleToken2Approve = () => {
    setCurrentTx('approve-token2');
    writeContract({
      address: getTokenAddress(tokenY),
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [vaultAddress, parseTokenAmount(token2Amount, tokenY)],
    });
  };

  const handleDeposit = () => {
    setCurrentTx('deposit');

    const parsedX = tokenAmount ? parseTokenAmount(tokenAmount, tokenX) : BigInt(0);
    const parsedY = token2Amount ? parseTokenAmount(token2Amount, tokenY) : BigInt(0);

    if (useNativeDeposit) {
      writeContract({
        address: vaultAddress as `0x${string}`,
        abi: METRO_VAULT_ABI,
        functionName: 'depositNative',
        args: [parsedX, parsedY, BigInt(0)],
        value: parsedX,
      });
    } else {
      writeContract({
        address: vaultAddress as `0x${string}`,
        abi: METRO_VAULT_ABI,
        functionName: 'deposit',
        args: [parsedX, parsedY, BigInt(0)],
      });
    }
  };

  const isValidAmount = (amount: string, balance: bigint, token: string) => {
    if (!amount || parseFloat(amount) <= 0) return false;
    try {
      const parsed = parseTokenAmount(amount, token);
      return parsed <= balance;
    } catch {
      return false;
    }
  };

  const canProceed =
    (tokenAmount && isValidAmount(tokenAmount, currentTokenBalance, tokenX)) ||
    (token2Amount && isValidAmount(token2Amount, currentToken2Balance, tokenY));

  const needsTokenApproval = !useNativeDeposit && tokenAmount && parseFloat(tokenAmount) > 0 && !tokenApproved;
  const needsToken2Approval = token2Amount && parseFloat(token2Amount) > 0 && !token2Approved;

  const executeStep = (stepIndex: number) => {
    if (!steps || stepIndex >= steps.length) return;

    const stepLabel = steps[stepIndex].label;
    if (stepLabel.includes(`Approve ${currentTokenType}`)) {
      handleTokenApprove();
    } else if (stepLabel.includes(`Approve ${currentToken2Type}`)) {
      handleToken2Approve();
    } else {
      handleDeposit();
    }
  };

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

    depositSteps[0].status = 'processing';
    setSteps([...depositSteps]);

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fade-in">
      <div className="bg-arca-gray rounded-2xl p-6 w-full max-w-md border border-white/[0.06] shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-arca-text">Deposit to {vaultName}</h2>
          <button
            onClick={onClose}
            className="text-arca-text-tertiary hover:text-arca-text transition-colors p-1 rounded-lg hover:bg-white/[0.04]"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Token X Input */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs text-arca-text-secondary font-medium">
                {currentTokenType} Amount
              </label>
              <span className="text-xs text-arca-text-tertiary">
                Balance: {formatTokenAmount(currentTokenBalance, tokenX)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-arca-surface border border-white/[0.06] rounded-xl px-4 py-3 text-arca-text placeholder-arca-text-tertiary focus:border-arca-green/40 focus:outline-none focus:ring-1 focus:ring-arca-green/20 transition-all text-sm"
              />
              <button
                onClick={handleMaxToken}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-arca-green text-xs font-semibold hover:text-arca-green/80 transition-colors"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Token Y Input */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs text-arca-text-secondary font-medium">{currentToken2Type} Amount</label>
              <span className="text-xs text-arca-text-tertiary">
                Balance: {formatTokenAmount(currentToken2Balance, tokenY)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={token2Amount}
                onChange={(e) => setToken2Amount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-arca-surface border border-white/[0.06] rounded-xl px-4 py-3 text-arca-text placeholder-arca-text-tertiary focus:border-arca-green/40 focus:outline-none focus:ring-1 focus:ring-arca-green/20 transition-all text-sm"
              />
              <button
                onClick={handleMaxToken2}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-arca-green text-xs font-semibold hover:text-arca-green/80 transition-colors"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Progress Steps or Button */}
          {showProgress ? (
            <div className="space-y-2.5 mt-5">
              <h3 className="text-arca-text font-medium text-sm mb-3">Add Liquidity</h3>
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`relative overflow-hidden rounded-xl border p-3 transition-all duration-500 ${
                    step.status === 'complete'
                      ? 'border-arca-green/20 bg-[#12261d]'
                      : step.status === 'processing'
                        ? 'border-arca-green/16 bg-arca-surface'
                        : 'border-white/[0.04] bg-arca-surface'
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute inset-0 ${
                      step.status === 'complete' ? 'arca-step-fill' : 'opacity-0'
                    }`}
                  />
                  <span
                    className={`pointer-events-none absolute -bottom-2 left-1/2 h-5 w-[68%] -translate-x-1/2 rounded-full blur-md transition-opacity duration-700 ${
                      step.status === 'complete'
                        ? 'opacity-100 shadow-[0_0_22px_rgba(236,242,248,0.18)]'
                        : 'opacity-0'
                    }`}
                  />
                  <div className="relative z-[1] flex items-center gap-3">
                    <StepStatusIcon status={step.status} />
                    <span className={`flex-1 text-sm transition-colors duration-300 ${
                      step.status === 'complete'
                        ? 'text-arca-text'
                        : step.status === 'processing'
                          ? 'text-arca-text'
                          : 'text-arca-text-tertiary'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={handleInitiateDeposit}
              disabled={!canProceed}
              className="w-full bg-arca-green text-arca-dark font-semibold py-3 px-4 rounded-xl text-sm hover:bg-arca-green/90 hover:shadow-glow-green transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none mt-2"
            >
              Deposit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
