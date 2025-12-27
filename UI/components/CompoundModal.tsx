'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWriteContract, useSendTransaction } from 'wagmi';
import { XMarkIcon, ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { type VaultConfig, isShadowVault as checkIsShadow } from '@/lib/vaultConfigs';
import { AggregatorAPI } from '@/lib/aggregatorApi';
import { CONTRACTS, ERC20_ABI } from '@/lib/contracts';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { getTokenAddress, getTokenDecimals } from '@/lib/tokenHelpers';
import { formatUnits, parseUnits } from 'viem';

const OPERATOR_ADDRESS = '0x60f3290Ce5011E67881771D1e23C38985F707a27';

interface CompoundModalProps {
    vaultConfig: VaultConfig;
    pendingRewards: { token: string; amount: bigint; symbol: string }[];
    onClose: () => void;
}

type Step = {
    id: string;
    label: string;
    status: 'pending' | 'processing' | 'complete' | 'error';
    error?: string;
};

export function CompoundModal({ vaultConfig, pendingRewards, onClose }: CompoundModalProps) {
    const { address: userAddress } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const { sendTransactionAsync } = useSendTransaction();

    const [steps, setSteps] = useState<Step[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [isDone, setIsDone] = useState(false);

    const isShadowVault = checkIsShadow(vaultConfig);

    const startCompounding = async () => {
        if (!userAddress || !publicClient) return;

        // 1. Generate Steps
        const initialSteps: Step[] = [];

        // Step: Claim
        initialSteps.push({ id: 'claim', label: 'Harvesting Rewards', status: 'pending' });

        // For each reward token
        for (const reward of pendingRewards) {
            if (reward.amount === 0n) continue;
            initialSteps.push({ id: `approve-${reward.token}`, label: `Approve Aggregator for ${reward.symbol}`, status: 'pending' });
            initialSteps.push({ id: `swap-x-${reward.token}`, label: `Swap 50% ${reward.symbol} → ${vaultConfig.tokenX}`, status: 'pending' });
            initialSteps.push({ id: `swap-y-${reward.token}`, label: `Swap 50% ${reward.symbol} → ${vaultConfig.tokenY}`, status: 'pending' });
        }

        // Deposit steps
        if (!isShadowVault && vaultConfig.tokenX === 'S') {
            // Metro uses native S, no approval needed for tokenX
        } else {
            initialSteps.push({ id: 'approve-vault-x', label: `Approve Vault for ${vaultConfig.tokenX}`, status: 'pending' });
        }
        initialSteps.push({ id: 'approve-vault-y', label: `Approve Vault for ${vaultConfig.tokenY}`, status: 'pending' });
        initialSteps.push({ id: 'deposit', label: 'Redepositing to Vault', status: 'pending' });

        setSteps(initialSteps);
        setCurrentStepIndex(0);

        const updateStep = (id: string, status: Step['status'], error?: string) => {
            setSteps(prev => prev.map(s => s.id === id ? { ...s, status, error } : s));
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

            // --- SWAPS ---
            for (const reward of pendingRewards) {
                if (reward.amount === 0n) continue;

                const rewardTokenAddr = reward.token as `0x${string}`;
                const halfAmount = reward.amount / 2n;

                // Get Quote for X
                updateStep(`swap-x-${reward.token}`, 'processing');
                const swapXResponse = await AggregatorAPI.getSwapData({
                    inTokenAddress: reward.token,
                    outTokenAddress: getTokenAddress(vaultConfig.tokenX),
                    amount: halfAmount.toString(),
                    account: userAddress,
                    slippage: 1, // 1%
                    gasPrice: '1',
                    referrer: OPERATOR_ADDRESS,
                    referrerFee: 1, // 1%
                });

                // Approve Aggregator
                updateStep(`approve-${reward.token}`, 'processing');
                const appTx = await writeContractAsync({
                    address: rewardTokenAddr,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [swapXResponse.data.to as `0x${string}`, reward.amount],
                });
                await publicClient.waitForTransactionReceipt({ hash: appTx });
                updateStep(`approve-${reward.token}`, 'complete');
                currentIdx++;
                setCurrentStepIndex(currentIdx);

                // Swap X
                updateStep(`swap-x-${reward.token}`, 'processing');
                const swapXTx = await sendTransactionAsync({
                    to: swapXResponse.data.to as `0x${string}`,
                    data: swapXResponse.data.data as `0x${string}`,
                    value: BigInt(swapXResponse.data.value || 0),
                });
                await publicClient.waitForTransactionReceipt({ hash: swapXTx });
                updateStep(`swap-x-${reward.token}`, 'complete');
                currentIdx++;
                setCurrentStepIndex(currentIdx);

                // Swap Y
                updateStep(`swap-y-${reward.token}`, 'processing');
                const swapYResponse = await AggregatorAPI.getSwapData({
                    inTokenAddress: reward.token,
                    outTokenAddress: getTokenAddress(vaultConfig.tokenY),
                    amount: (reward.amount - halfAmount).toString(), // Remainder
                    account: userAddress,
                    slippage: 1,
                    gasPrice: '1',
                    referrer: OPERATOR_ADDRESS,
                    referrerFee: 1,
                });

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

            // --- APPROVE VAULT ---
            // We need to fetch new balances or just approve max/enough
            // For this flow, let's just approve a large enough amount or exactly what we got (harder to track without reading logs)
            // Let's just read balance of Token X and Y

            const tokenXAddr = getTokenAddress(vaultConfig.tokenX);
            const tokenYAddr = getTokenAddress(vaultConfig.tokenY);

            if (!(!isShadowVault && vaultConfig.tokenX === 'S')) {
                updateStep('approve-vault-x', 'processing');
                const balX = await publicClient.readContract({
                    address: tokenXAddr as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress],
                }) as bigint;
                const appX = await writeContractAsync({
                    address: tokenXAddr as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [vaultConfig.vaultAddress as `0x${string}`, balX],
                });
                await publicClient.waitForTransactionReceipt({ hash: appX });
                updateStep('approve-vault-x', 'complete');
                currentIdx++;
                setCurrentStepIndex(currentIdx);
            }

            updateStep('approve-vault-y', 'processing');
            const balY = await publicClient.readContract({
                address: tokenYAddr as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
            }) as bigint;
            const appY = await writeContractAsync({
                address: tokenYAddr as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [vaultConfig.vaultAddress as `0x${string}`, balY],
            });
            await publicClient.waitForTransactionReceipt({ hash: appY });
            updateStep('approve-vault-y', 'complete');
            currentIdx++;
            setCurrentStepIndex(currentIdx);

            // --- DEPOSIT ---
            updateStep('deposit', 'processing');
            const finalBalX = await publicClient.readContract({
                address: tokenXAddr as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
            }) as bigint;
            const finalBalY = await publicClient.readContract({
                address: tokenYAddr as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
            }) as bigint;

            let depositTx;
            if (isShadowVault) {
                depositTx = await writeContractAsync({
                    address: vaultConfig.vaultAddress as `0x${string}`,
                    abi: METRO_VAULT_ABI,
                    functionName: 'deposit',
                    args: [finalBalX, finalBalY, 0n],
                });
            } else {
                depositTx = await writeContractAsync({
                    address: vaultConfig.vaultAddress as `0x${string}`,
                    abi: METRO_VAULT_ABI,
                    functionName: 'depositNative',
                    args: [finalBalX, finalBalY, 0n],
                    value: vaultConfig.tokenX === 'S' ? finalBalX : 0n,
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
        startCompounding();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-arca-gray border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-arca-gray to-arca-dark">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ArrowPathIcon className={`w-6 h-6 text-arca-green ${!isDone ? 'animate-spin' : ''}`} />
                        Auto-Compounding
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
                    {steps.length === 0 && (
                        <div className="text-center py-8">
                            <ArrowPathIcon className="w-12 h-12 text-arca-green animate-spin mx-auto mb-4" />
                            <p className="text-gray-400">Initializing compounding flow...</p>
                        </div>
                    )}

                    {steps.map((step, idx) => (
                        <div
                            key={step.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${step.status === 'processing' ? 'bg-arca-green/5 border-arca-green' :
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
                                <p className={`text-sm font-medium ${step.status === 'complete' ? 'text-gray-400' :
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

                <div className="p-6 bg-arca-dark/50 border-t border-gray-800 flex justify-end gap-3">
                    {steps.some(s => s.status === 'error') && (
                        <button
                            onClick={() => {
                                setSteps([]);
                                startCompounding();
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
    );
}
