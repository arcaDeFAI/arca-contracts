'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWriteContract, useSendTransaction } from 'wagmi';
import { XMarkIcon, ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon, BoltIcon } from '@heroicons/react/24/outline';
import { type VaultConfig, isShadowVault as checkIsShadow } from '@/lib/vaultConfigs';
import { AggregatorAPI } from '@/lib/aggregatorApi';
import { CONTRACTS, ERC20_ABI } from '@/lib/contracts';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { getTokenAddress, getTokenDecimals } from '@/lib/tokenHelpers';
import { formatUnits, parseUnits } from 'viem';

const OPERATOR_ADDRESS = '0x60f3290Ce5011E67881771D1e23C38985F707a27';

interface AutocompoundModalProps {
    vaultConfig: VaultConfig;
    pendingRewards: { token: string; amount: bigint; symbol: string }[];
    onClose: () => void;
}

type Step = {
    id: string;
    label: string;
    status: 'pending' | 'processing' | 'complete' | 'error';
    error?: string;
    provider?: string;
};

export function AutocompoundModal({ vaultConfig, pendingRewards, onClose }: AutocompoundModalProps) {
    const { address: userAddress } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const { sendTransactionAsync } = useSendTransaction();

    const [steps, setSteps] = useState<Step[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [isDone, setIsDone] = useState(false);
    const [aggregatorUsed, setAggregatorUsed] = useState<'kyberswap' | 'openocean' | null>(null);

    const isShadowVault = checkIsShadow(vaultConfig);

    const startAutocompounding = async () => {
        if (!userAddress || !publicClient) return;

        // 1. Generate Steps
        const initialSteps: Step[] = [];

        // Step: Claim
        initialSteps.push({ id: 'claim', label: 'Harvesting Rewards', status: 'pending' });

        // Batch approval for all reward tokens (single step)
        if (pendingRewards.some(r => r.amount > 0n)) {
            initialSteps.push({ id: 'approve-rewards', label: 'Approve Rewards for Swapping', status: 'pending' });
        }

        // For each reward token - only swap steps
        for (const reward of pendingRewards) {
            if (reward.amount === 0n) continue;
            initialSteps.push({ id: `swap-x-${reward.token}`, label: `Swap 50% ${reward.symbol} → ${vaultConfig.tokenX}`, status: 'pending' });
            initialSteps.push({ id: `swap-y-${reward.token}`, label: `Swap 50% ${reward.symbol} → ${vaultConfig.tokenY}`, status: 'pending' });
        }

        // Batch approval for vault tokens (single step)
        initialSteps.push({ id: 'approve-vault', label: 'Approve Vault for Tokens', status: 'pending' });
        initialSteps.push({ id: 'deposit', label: 'Redepositing to Vault', status: 'pending' });

        setSteps(initialSteps);
        setCurrentStepIndex(0);

        const updateStep = (id: string, status: Step['status'], error?: string, provider?: string) => {
            setSteps(prev => prev.map(s => s.id === id ? { ...s, status, error, provider } : s));
        };

        try {
            let currentIdx = 0;

            // --- CLAIM ---
            updateStep('claim', 'processing');
            const claimTx = await writeContractAsync({
                address: vaultConfig.vaultAddress as `0x${string}`,
                abi: METRO_VAULT_ABI,
                functionName: 'claim',
            });
            await publicClient.waitForTransactionReceipt({ hash: claimTx });
            updateStep('claim', 'complete');
            currentIdx++;
            setCurrentStepIndex(currentIdx);

            // --- BATCH APPROVE ALL REWARD TOKENS ---
            // Get first swap quote to determine router address
            const firstReward = pendingRewards.find(r => r.amount > 0n);
            if (!firstReward) throw new Error('No rewards to compound');

            const testSwap = await AggregatorAPI.getSwapData({
                inTokenAddress: firstReward.token,
                outTokenAddress: getTokenAddress(vaultConfig.tokenX),
                amount: (firstReward.amount / 2n).toString(),
                account: userAddress,
                slippage: 1,
                gasPrice: '1',
                referrer: OPERATOR_ADDRESS,
                referrerFee: 1,
            }, 'kyberswap');

            const routerAddress = testSwap.data.to as `0x${string}`;
            setAggregatorUsed('kyberswap');

            // Batch approve all reward tokens to router
            updateStep('approve-rewards', 'processing');
            const approvalPromises = pendingRewards
                .filter(r => r.amount > 0n)
                .map(async (reward) => {
                    const rewardTokenAddr = reward.token as `0x${string}`;
                    
                    // Check existing allowance
                    const currentAllowance = await publicClient.readContract({
                        address: rewardTokenAddr,
                        abi: ERC20_ABI,
                        functionName: 'allowance',
                        args: [userAddress, routerAddress],
                    }) as bigint;

                    // Only approve if needed
                    if (currentAllowance < reward.amount) {
                        const appTx = await writeContractAsync({
                            address: rewardTokenAddr,
                            abi: ERC20_ABI,
                            functionName: 'approve',
                            args: [routerAddress, reward.amount],
                        });
                        await publicClient.waitForTransactionReceipt({ hash: appTx });
                    }
                });

            await Promise.all(approvalPromises);
            updateStep('approve-rewards', 'complete');
            currentIdx++;
            setCurrentStepIndex(currentIdx);

            // --- SWAPS ---
            for (const reward of pendingRewards) {
                if (reward.amount === 0n) continue;

                // Calculate exact 50/50 split
                const halfAmount = reward.amount / 2n;
                const remainingAmount = reward.amount - halfAmount; // Ensures no dust

                // Swap X (50%)
                updateStep(`swap-x-${reward.token}`, 'processing');
                const swapXResponse = await AggregatorAPI.getSwapData({
                    inTokenAddress: reward.token,
                    outTokenAddress: getTokenAddress(vaultConfig.tokenX),
                    amount: halfAmount.toString(),
                    account: userAddress,
                    slippage: 1,
                    gasPrice: '1',
                    referrer: OPERATOR_ADDRESS,
                    referrerFee: 1,
                }, 'kyberswap');

                const swapXTx = await sendTransactionAsync({
                    to: swapXResponse.data.to as `0x${string}`,
                    data: swapXResponse.data.data as `0x${string}`,
                    value: BigInt(swapXResponse.data.value || 0),
                });
                await publicClient.waitForTransactionReceipt({ hash: swapXTx });
                updateStep(`swap-x-${reward.token}`, 'complete');
                currentIdx++;
                setCurrentStepIndex(currentIdx);

                // Swap Y (remaining 50%)
                updateStep(`swap-y-${reward.token}`, 'processing');
                const swapYResponse = await AggregatorAPI.getSwapData({
                    inTokenAddress: reward.token,
                    outTokenAddress: getTokenAddress(vaultConfig.tokenY),
                    amount: remainingAmount.toString(),
                    account: userAddress,
                    slippage: 1,
                    gasPrice: '1',
                    referrer: OPERATOR_ADDRESS,
                    referrerFee: 1,
                }, 'kyberswap');

                const swapYTx = await sendTransactionAsync({
                    to: swapYResponse.data.to as `0x${string}`,
                    data: swapYResponse.data.data as `0x${string}`,
                    value: BigInt(swapYResponse.data.value || 0),
                });
                await publicClient.waitForTransactionReceipt({ hash: swapYTx });
                updateStep(`swap-y-${reward.token}`, 'complete');
                currentIdx++;
                setCurrentStepIndex(currentIdx);
            }

            // --- BATCH APPROVE VAULT TOKENS ---
            updateStep('approve-vault', 'processing');
            const tokenXAddr = getTokenAddress(vaultConfig.tokenX);
            const tokenYAddr = getTokenAddress(vaultConfig.tokenY);
            const vaultAddr = vaultConfig.vaultAddress as `0x${string}`;

            // Get balances
            const balX = await publicClient.readContract({
                address: tokenXAddr as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
            }) as bigint;

            const balY = await publicClient.readContract({
                address: tokenYAddr as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
            }) as bigint;

            // Batch approve both tokens (only if needed and not native)
            const vaultApprovals = [];

            // Approve Token X (if not native S)
            if (!(!isShadowVault && vaultConfig.tokenX === 'S')) {
                const allowanceX = await publicClient.readContract({
                    address: tokenXAddr as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [userAddress, vaultAddr],
                }) as bigint;

                if (allowanceX < balX) {
                    vaultApprovals.push(
                        writeContractAsync({
                            address: tokenXAddr as `0x${string}`,
                            abi: ERC20_ABI,
                            functionName: 'approve',
                            args: [vaultAddr, balX],
                        }).then(tx => publicClient.waitForTransactionReceipt({ hash: tx }))
                    );
                }
            }

            // Approve Token Y
            const allowanceY = await publicClient.readContract({
                address: tokenYAddr as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [userAddress, vaultAddr],
            }) as bigint;

            if (allowanceY < balY) {
                vaultApprovals.push(
                    writeContractAsync({
                        address: tokenYAddr as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [vaultAddr, balY],
                    }).then(tx => publicClient.waitForTransactionReceipt({ hash: tx }))
                );
            }

            await Promise.all(vaultApprovals);
            updateStep('approve-vault', 'complete');
            currentIdx++;
            setCurrentStepIndex(currentIdx);

            // --- DEPOSIT ---
            updateStep('deposit', 'processing');
            
            // Use the balances we already fetched
            let depositTx;
            if (isShadowVault) {
                depositTx = await writeContractAsync({
                    address: vaultAddr,
                    abi: METRO_VAULT_ABI,
                    functionName: 'deposit',
                    args: [balX, balY, 0n],
                });
            } else {
                depositTx = await writeContractAsync({
                    address: vaultAddr,
                    abi: METRO_VAULT_ABI,
                    functionName: 'depositNative',
                    args: [balX, balY, 0n],
                    value: vaultConfig.tokenX === 'S' ? balX : 0n,
                });
            }
            await publicClient.waitForTransactionReceipt({ hash: depositTx });
            updateStep('deposit', 'complete');

            setIsDone(true);
            setTimeout(() => onClose(), 2000);

        } catch (e: any) {
            console.error(e);
            const activeStepId = steps[currentStepIndex]?.id;
            if (activeStepId) {
                updateStep(activeStepId, 'error', e.message || 'Transaction failed');
            }
        }
    };

    useEffect(() => {
        startAutocompounding();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-arca-gray border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-arca-gray to-arca-dark">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BoltIcon className={`w-6 h-6 text-yellow-400 ${!isDone ? 'animate-pulse' : ''}`} />
                        Auto-Compounding
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
                    {aggregatorUsed && (
                        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <p className="text-xs text-blue-400 flex items-center gap-2">
                                <span className="font-semibold">Powered by:</span>
                                <span className="capitalize">{aggregatorUsed === 'kyberswap' ? 'KyberSwap' : 'OpenOcean'}</span>
                            </p>
                        </div>
                    )}

                    {steps.length === 0 && (
                        <div className="text-center py-8">
                            <ArrowPathIcon className="w-12 h-12 text-arca-green animate-spin mx-auto mb-4" />
                            <p className="text-gray-400">Initializing autocompound flow...</p>
                        </div>
                    )}

                    {steps.map((step, idx) => (
                        <div
                            key={step.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                step.status === 'processing' ? 'bg-arca-green/5 border-arca-green' :
                                step.status === 'complete' ? 'bg-gray-800/30 border-gray-800' :
                                step.status === 'error' ? 'bg-red-500/5 border-red-500/30' :
                                'bg-transparent border-transparent'
                            }`}
                        >
                            <div className="mt-0.5">
                                {step.status === 'complete' ? (
                                    <CheckCircleIcon className="w-5 h-5 text-arca-green" />
                                ) : step.status === 'processing' ? (
                                    <ArrowPathIcon className="w-5 h-5 text-arca-green animate-spin" />
                                ) : step.status === 'error' ? (
                                    <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
                                ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-gray-700" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className={`text-sm font-medium ${
                                    step.status === 'complete' ? 'text-gray-400' :
                                    step.status === 'processing' ? 'text-white' :
                                    step.status === 'error' ? 'text-red-500' :
                                    'text-gray-600'
                                }`}>
                                    {step.label}
                                </p>
                                {step.error && (
                                    <p className="text-xs text-red-400 mt-1 leading-relaxed">{step.error}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-arca-dark/50 border-t border-gray-800 flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                        {isDone ? '✓ Compounding complete!' : `Step ${currentStepIndex + 1} of ${steps.length}`}
                    </div>
                    <div className="flex gap-3">
                        {steps.some(s => s.status === 'error') && (
                            <button
                                onClick={() => {
                                    setSteps([]);
                                    setCurrentStepIndex(-1);
                                    setIsDone(false);
                                    startAutocompounding();
                                }}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            >
                                Retry
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="bg-arca-green text-black px-6 py-2 rounded-lg text-sm font-bold hover:bg-arca-green/90 transition-all shadow-lg shadow-arca-green/20"
                        >
                            {isDone ? 'Finished' : 'Close'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
