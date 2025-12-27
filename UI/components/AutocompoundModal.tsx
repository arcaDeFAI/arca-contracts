'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { XMarkIcon, ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon, BoltIcon } from '@heroicons/react/24/outline';
import { type VaultConfig, isShadowVault as checkIsShadow } from '@/lib/vaultConfigs';
import { AggregatorAPI } from '@/lib/aggregatorApi';
import { ERC20_ABI } from '@/lib/contracts';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { getTokenAddress, getTokenDecimals } from '@/lib/tokenHelpers';
import { encodeFunctionData } from 'viem';

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const OPERATOR_ADDRESS = '0x60f3290Ce5011E67881771D1e23C38985F707a27';

const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' }
        ],
        name: 'calls',
        type: 'tuple[]'
      }
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' }
        ],
        name: 'returnData',
        type: 'tuple[]'
      }
    ],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

interface AutocompoundModalProps {
    vaultConfig: VaultConfig;
    pendingRewards: { token: string; amount: bigint; symbol: string }[];
    onClose: () => void;
}

type Step = 'preparing' | 'signing' | 'executing' | 'depositing' | 'complete' | 'error';

export function AutocompoundModal({ vaultConfig, pendingRewards, onClose }: AutocompoundModalProps) {
    const { address: userAddress } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    const [step, setStep] = useState<Step>('preparing');
    const [error, setError] = useState<string>();
    const [txHash, setTxHash] = useState<string>();
    const [aggregatorUsed, setAggregatorUsed] = useState<'kyberswap' | 'openocean' | null>(null);
    const [totalCalls, setTotalCalls] = useState(0);
    const [estimatedOutput, setEstimatedOutput] = useState<{ tokenX: bigint; tokenY: bigint } | null>(null);
    const [debugInfo, setDebugInfo] = useState<string[]>([]);

    const isShadowVault = checkIsShadow(vaultConfig);

    const addDebug = (msg: string) => {
        console.log(msg);
        setDebugInfo(prev => [...prev, msg]);
    };

    const executeAtomicAutocompound = async () => {
        if (!userAddress || !publicClient) return;

        try {
            setStep('preparing');
            setDebugInfo([]);

            const rewardsWithBalance = pendingRewards.filter(r => r.amount > 0n);
            if (rewardsWithBalance.length === 0) {
                throw new Error('No rewards to compound');
            }

            addDebug(`Processing ${rewardsWithBalance.length} reward tokens`);

            const tokenXAddr = getTokenAddress(vaultConfig.tokenX) as `0x${string}`;
            const tokenYAddr = getTokenAddress(vaultConfig.tokenY) as `0x${string}`;
            const vaultAddr = vaultConfig.vaultAddress as `0x${string}`;

            const calls: { target: `0x${string}`; allowFailure: boolean; callData: `0x${string}` }[] = [];

            let totalEstimatedX = 0n;
            let totalEstimatedY = 0n;

            // ============================================
            // STEP 1: CLAIM from vault
            // ============================================
            addDebug('Adding claim call');
            calls.push({
                target: vaultAddr,
                allowFailure: false,
                callData: encodeFunctionData({
                    abi: METRO_VAULT_ABI,
                    functionName: 'claim'
                })
            });

            // ============================================
            // STEP 2: Get current balances to verify claim will work
            // ============================================
            for (const reward of rewardsWithBalance) {
                const currentBalance = await publicClient.readContract({
                    address: reward.token as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress]
                }) as bigint;

                addDebug(`Current ${reward.symbol} balance: ${currentBalance.toString()}`);
                addDebug(`Expected after claim: ${reward.amount.toString()}`);
            }

            // ============================================
            // STEP 3: Get swap data and prepare calls
            // ============================================
            let routerAddress: `0x${string}` | null = null;

            for (const reward of rewardsWithBalance) {
                const halfAmount = reward.amount / 2n;
                const remainingAmount = reward.amount - halfAmount;

                addDebug(`Swapping ${reward.symbol}: ${halfAmount} to ${vaultConfig.tokenX}, ${remainingAmount} to ${vaultConfig.tokenY}`);

                // Get swap data for X
                const swapXData = await AggregatorAPI.getSwapData({
                    inTokenAddress: reward.token,
                    outTokenAddress: tokenXAddr,
                    amount: halfAmount.toString(),
                    account: userAddress,
                    slippage: 1,
                    gasPrice: '1',
                    referrer: OPERATOR_ADDRESS,
                    referrerFee: 1,
                }, 'kyberswap');

                // Get swap data for Y
                const swapYData = await AggregatorAPI.getSwapData({
                    inTokenAddress: reward.token,
                    outTokenAddress: tokenYAddr,
                    amount: remainingAmount.toString(),
                    account: userAddress,
                    slippage: 1,
                    gasPrice: '1',
                    referrer: OPERATOR_ADDRESS,
                    referrerFee: 1,
                }, 'kyberswap');

                if (!routerAddress) {
                    routerAddress = swapXData.data.to as `0x${string}`;
                    setAggregatorUsed('kyberswap');
                    addDebug(`Using router: ${routerAddress}`);
                }

                // Extract estimated output amounts
                const estimatedOutX = BigInt(swapXData.data.outAmount || '0');
                const estimatedOutY = BigInt(swapYData.data.outAmount || '0');
                
                addDebug(`Estimated output: ${estimatedOutX} ${vaultConfig.tokenX}, ${estimatedOutY} ${vaultConfig.tokenY}`);
                
                totalEstimatedX += estimatedOutX;
                totalEstimatedY += estimatedOutY;

                // IMPORTANT: Approve TOTAL amount ONCE, then do both swaps
                const totalAmount = reward.amount;
                addDebug(`Approving ${totalAmount} ${reward.symbol} for both swaps`);
                calls.push({
                    target: reward.token as `0x${string}`,
                    allowFailure: false,
                    callData: encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [routerAddress, totalAmount]
                    })
                });

                // Execute swap X
                addDebug(`Adding swap X call (${halfAmount})`);
                calls.push({
                    target: swapXData.data.to as `0x${string}`,
                    allowFailure: false,
                    callData: swapXData.data.data as `0x${string}` 
                });

                // Execute swap Y
                addDebug(`Adding swap Y call (${remainingAmount})`);
                calls.push({
                    target: swapYData.data.to as `0x${string}`,
                    allowFailure: false,
                    callData: swapYData.data.data as `0x${string}` 
                });
            }

            // Apply conservative slippage (5% to be safe)
            const slippageMultiplier = 95n; // 95% = 5% slippage tolerance
            const estimatedXWithSlippage = (totalEstimatedX * slippageMultiplier) / 100n;
            const estimatedYWithSlippage = (totalEstimatedY * slippageMultiplier) / 100n;

            addDebug(`Total estimated with 5% slippage: ${estimatedXWithSlippage} ${vaultConfig.tokenX}, ${estimatedYWithSlippage} ${vaultConfig.tokenY}`);

            setEstimatedOutput({
                tokenX: estimatedXWithSlippage,
                tokenY: estimatedYWithSlippage
            });

            setTotalCalls(calls.length);
            addDebug(`Total calls prepared: ${calls.length}`);

            // Log all calls for debugging
            calls.forEach((call, idx) => {
                addDebug(`Call ${idx}: ${call.target.slice(0, 10)}... allowFailure: ${call.allowFailure}`);
            });

            setStep('signing');

            // ============================================
            // Execute multicall (Claim + Swaps)
            // ============================================
            addDebug('Executing claim + swap transaction...');

            const tx1 = await writeContractAsync({
                address: MULTICALL3_ADDRESS,
                abi: MULTICALL3_ABI,
                functionName: 'aggregate3',
                args: [calls]
            });

            setTxHash(tx1);
            setStep('executing');
            addDebug(`Transaction 1 sent: ${tx1}`);

            const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 });

            if (receipt1.status !== 'success') {
                throw new Error('Claim + Swap transaction failed');
            }

            addDebug('Swaps complete! Reading actual balances...');
            setStep('depositing');

            // ============================================
            // STEP 4: Read actual balances after swaps
            // ============================================
            const actualBalanceX = await publicClient.readContract({
                address: tokenXAddr,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            }) as bigint;

            const actualBalanceY = await publicClient.readContract({
                address: tokenYAddr,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            }) as bigint;

            addDebug(`Actual balance X: ${actualBalanceX}`);
            addDebug(`Actual balance Y: ${actualBalanceY}`);

            // ============================================
            // STEP 5: Approve vault with actual amounts
            // ============================================
            const depositCalls: { target: `0x${string}`; allowFailure: boolean; callData: `0x${string}` }[] = [];

            // Approve tokenX (if not native S)
            if (!(!isShadowVault && vaultConfig.tokenX === 'S')) {
                addDebug(`Approving vault for ${actualBalanceX} ${vaultConfig.tokenX}`);
                depositCalls.push({
                    target: tokenXAddr,
                    allowFailure: false,
                    callData: encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [vaultAddr, actualBalanceX]
                    })
                });
            }

            // Approve tokenY
            addDebug(`Approving vault for ${actualBalanceY} ${vaultConfig.tokenY}`);
            depositCalls.push({
                target: tokenYAddr,
                allowFailure: false,
                callData: encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [vaultAddr, actualBalanceY]
                })
            });

            // ============================================
            // STEP 6: Deposit with actual balances
            // ============================================
            addDebug(`Adding deposit call: ${actualBalanceX}, ${actualBalanceY}`);
            
            if (isShadowVault) {
                depositCalls.push({
                    target: vaultAddr,
                    allowFailure: false,
                    callData: encodeFunctionData({
                        abi: METRO_VAULT_ABI,
                        functionName: 'deposit',
                        args: [actualBalanceX, actualBalanceY, 0n]
                    })
                });
            } else {
                depositCalls.push({
                    target: vaultAddr,
                    allowFailure: false,
                    callData: encodeFunctionData({
                        abi: METRO_VAULT_ABI,
                        functionName: 'depositNative',
                        args: [actualBalanceX, actualBalanceY, 0n]
                    })
                });
            }

            addDebug(`Executing deposit transaction with ${depositCalls.length} calls...`);

            const nativeValue = (!isShadowVault && vaultConfig.tokenX === 'S') 
                ? actualBalanceX 
                : 0n;

            const tx2 = await writeContractAsync({
                address: MULTICALL3_ADDRESS,
                abi: MULTICALL3_ABI,
                functionName: 'aggregate3',
                args: [depositCalls],
                value: nativeValue
            });

            addDebug(`Transaction 2 sent: ${tx2}`);

            const receipt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 });

            if (receipt2.status === 'success') {
                addDebug('Deposit successful!');
                setStep('complete');
                setTimeout(() => onClose(), 2000);
            } else {
                throw new Error('Deposit transaction failed');
            }

        } catch (e: any) {
            console.error('Autocompound error:', e);
            addDebug(`ERROR: ${e.message}`);
            setError(e.message || 'Transaction failed');
            setStep('error');
        }
    };

    useEffect(() => {
        executeAtomicAutocompound();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-arca-gray border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-arca-gray to-arca-dark">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BoltIcon className={`w-6 h-6 text-yellow-400 ${step !== 'complete' ? 'animate-pulse' : ''}`} />
                        Atomic Autocompound
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-blue-400 flex items-center gap-2">
                                <span className="font-semibold">⚡ 2 Transactions</span>
                                {totalCalls > 0 && (
                                    <span className="bg-blue-500/20 px-2 py-0.5 rounded text-blue-300">
                                        Claim+Swap → Deposit
                                    </span>
                                )}
                            </p>
                        </div>
                        {aggregatorUsed && (
                            <p className="text-xs text-gray-400">
                                Powered by <span className="text-blue-400 font-semibold">KyberSwap</span> + <span className="text-purple-400 font-semibold">Multicall3</span>
                            </p>
                        )}
                        {estimatedOutput && (
                            <div className="mt-2 pt-2 border-t border-blue-500/20">
                                <p className="text-xs text-gray-500 mb-1">Estimated deposit (with 5% slippage buffer):</p>
                                <div className="flex gap-3 text-xs">
                                    <span className="text-arca-green">
                                        {vaultConfig.tokenX}: ~{(Number(estimatedOutput.tokenX) / Math.pow(10, getTokenDecimals(vaultConfig.tokenX))).toFixed(4)}
                                    </span>
                                    <span className="text-arca-green">
                                        {vaultConfig.tokenY}: ~{(Number(estimatedOutput.tokenY) / Math.pow(10, getTokenDecimals(vaultConfig.tokenY))).toFixed(4)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-400">Progress</h3>
                            {/* Preparing */}
                            <StepIndicator
                                label="Building transaction"
                                sublabel="Fetching routes..."
                                isActive={step === 'preparing'}
                                isComplete={step !== 'preparing' && step !== 'error'}
                                isError={false}
                            />

                            {/* Signing */}
                            <StepIndicator
                                label="Confirm signature"
                                sublabel="Sign for claim + swaps"
                                isActive={step === 'signing'}
                                isComplete={['executing', 'depositing', 'complete'].includes(step)}
                                isError={false}
                            />

                            {/* Executing */}
                            <StepIndicator
                                label="Claim & Swap"
                                sublabel={`${totalCalls} operations`}
                                isActive={step === 'executing'}
                                isComplete={['depositing', 'complete'].includes(step)}
                                isError={false}
                                txHash={txHash}
                            />

                            {/* Depositing */}
                            <StepIndicator
                                label="Deposit to vault"
                                sublabel="Using actual swap outputs"
                                isActive={step === 'depositing'}
                                isComplete={step === 'complete'}
                                isError={false}
                            />

                            {/* Error */}
                            {step === 'error' && (
                                <div className="flex items-start gap-3 p-3 rounded-xl border bg-red-500/5 border-red-500/30">
                                    <ExclamationCircleIcon className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-red-500">Failed</p>
                                        {error && (
                                            <p className="text-xs text-red-400 mt-1 leading-relaxed">{error}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {step === 'complete' && (
                                <div className="p-3 bg-arca-green/10 border border-arca-green/30 rounded-lg">
                                    <p className="text-sm text-arca-green flex items-center gap-2">
                                        <CheckCircleIcon className="w-5 h-5" />
                                        Complete!
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Debug Info */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-400">Debug Log</h3>
                            <div className="bg-black/40 rounded-lg p-3 h-64 overflow-y-auto text-xs font-mono text-gray-400 space-y-1 custom-scrollbar">
                                {debugInfo.map((info, idx) => (
                                    <div key={idx} className="text-gray-300">
                                        <span className="text-gray-600">{idx}.</span> {info}
                                    </div>
                                ))}
                                {debugInfo.length === 0 && (
                                    <div className="text-gray-600">Initializing...</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-arca-dark/50 border-t border-gray-800 flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                        {step === 'complete' ? '✓ All operations complete!' : 
                         step === 'depositing' ? '💰 Depositing to vault...' :
                         step === 'executing' ? '⏳ Processing swaps...' :
                         step === 'signing' ? '✍️ Waiting for signature...' :
                         '🔄 Preparing...'}
                    </div>
                    <div className="flex gap-3">
                        {step === 'error' && (
                            <button
                                onClick={() => {
                                    setStep('preparing');
                                    setError(undefined);
                                    setTxHash(undefined);
                                    setEstimatedOutput(null);
                                    setDebugInfo([]);
                                    executeAtomicAutocompound();
                                }}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            >
                                Retry
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            disabled={step === 'signing' || step === 'executing'}
                            className="bg-arca-green text-black px-6 py-2 rounded-lg text-sm font-bold hover:bg-arca-green/90 transition-all shadow-lg shadow-arca-green/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {step === 'complete' ? 'Done ✓' : 'Close'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StepIndicator({
    label,
    sublabel,
    isActive,
    isComplete,
    isError,
    txHash
}: {
    label: string;
    sublabel: string;
    isActive: boolean;
    isComplete: boolean;
    isError: boolean;
    txHash?: string;
}) {
    return (
        <div className={`flex items-start gap-2 p-2 rounded-lg border transition-all ${
            isActive ? 'bg-arca-green/5 border-arca-green' :
            isComplete ? 'bg-gray-800/30 border-gray-800' :
            'bg-transparent border-transparent'
        }`}>
            <div className="mt-0.5">
                {isComplete ? (
                    <CheckCircleIcon className="w-4 h-4 text-arca-green" />
                ) : isActive ? (
                    <ArrowPathIcon className="w-4 h-4 text-arca-green animate-spin" />
                ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-700" />
                )}
            </div>
            <div className="flex-1">
                <p className={`text-xs font-medium ${
                    isComplete ? 'text-gray-400' :
                    isActive ? 'text-white' :
                    'text-gray-600'
                }`}>
                    {label}
                </p>
                <p className="text-xs text-gray-500">{sublabel}</p>
                {txHash && (
                    <a
                        href={`https://sonicscan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-arca-green hover:underline block mt-1"
                    >
                        View TX ↗
                    </a>
                )}
            </div>
        </div>
    );
}
