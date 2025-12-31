'use client';

import { useState } from 'react';
import { useAccount, usePublicClient, useWriteContract, useSendTransaction } from 'wagmi';
import { XMarkIcon, CheckCircleIcon, ArrowPathIcon, ExclamationCircleIcon, BoltIcon } from '@heroicons/react/24/outline';
import { type VaultConfig, isShadowVault as checkIsShadow } from '@/lib/vaultConfigs';
import { AggregatorAPI } from '@/lib/aggregatorApi';
import { ERC20_ABI } from '@/lib/contracts';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { getTokenAddress, getTokenDecimals } from '@/lib/tokenHelpers';
import { encodeFunctionData, formatUnits } from 'viem';

const OPERATOR_ADDRESS = '0x60f3290Ce5011E67881771D1e23C38985F707a27';

interface AutocompoundModalProps {
    vaultConfig: VaultConfig;
    pendingRewards: { token: string; amount: bigint; symbol: string }[];
    onClose: () => void;
}

type Step = 'idle' | 'claiming' | 'approving' | 'swapping' | 'depositing' | 'complete' | 'error';

export function AutocompoundModal({ vaultConfig, pendingRewards, onClose }: AutocompoundModalProps) {
    const { address: userAddress } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const { sendTransactionAsync } = useSendTransaction();

    const [currentStep, setCurrentStep] = useState<Step>('idle');
    const [statusData, setStatusData] = useState<{
        txHash?: string;
        error?: string;
        currentOperation?: string;
    }>({});

    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    // Cleanup pending rewards data
    const rewardsToProcess = pendingRewards.filter(r => r.amount > 0n);
    const rewardToken = rewardsToProcess[0]; // Assuming single reward token for now (typical)
    const vaultAddr = vaultConfig.vaultAddress as `0x${string}`;

    const executeSequentialFlow = async () => {
        if (!userAddress || !publicClient || !rewardToken) return;

        try {
            // --------------------------------------------------------
            // STEP 1: CLAIM REWARDS
            // --------------------------------------------------------
            setCurrentStep('claiming');
            setStatusData({ currentOperation: 'Claiming Rewards...' });
            addLog('1/5 Claiming from Vault...');

            // Standard claim function for all known vaults
            const claimHash = await writeContractAsync({
                address: vaultAddr,
                abi: METRO_VAULT_ABI,
                functionName: 'claim',
            });

            setStatusData({ txHash: claimHash, currentOperation: 'Confirming Claim...' });
            await publicClient.waitForTransactionReceipt({ hash: claimHash });
            addLog('Claim Successful.');

            // --------------------------------------------------------
            // PREPARE FOR SWAPS
            // --------------------------------------------------------
            setCurrentStep('approving');
            const tokenXAddr = getTokenAddress(vaultConfig.tokenX) as `0x${string}`;
            const tokenYAddr = getTokenAddress(vaultConfig.tokenY) as `0x${string}`;
            const rewardAddr = rewardToken.token as `0x${string}`;

            // Read actual balance after claim
            const balance = await publicClient.readContract({
                address: rewardAddr,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            }) as bigint;

            if (balance === 0n) throw new Error('No rewards received after claim.');
            addLog(`Balance: ${formatUnits(balance, 18)} ${rewardToken.symbol}`);

            const half = balance / 2n;
            const remainder = balance - half;

            addLog('Getting Swap Quotes...');
            const [quoteX, quoteY] = await Promise.all([
                AggregatorAPI.getSwapData({
                    inTokenAddress: rewardAddr, outTokenAddress: tokenXAddr, amount: half.toString(),
                    account: userAddress, slippage: 1, gasPrice: '1', referrer: OPERATOR_ADDRESS, referrerFee: 1
                }, 'kyberswap'),
                AggregatorAPI.getSwapData({
                    inTokenAddress: rewardAddr, outTokenAddress: tokenYAddr, amount: remainder.toString(),
                    account: userAddress, slippage: 1, gasPrice: '1', referrer: OPERATOR_ADDRESS, referrerFee: 1
                }, 'kyberswap')
            ]);

            const routerAddress = quoteX.data.to as `0x${string}`;

            // --------------------------------------------------------
            // STEP 2: APPROVE ROUTER
            // --------------------------------------------------------
            const allowance = await publicClient.readContract({
                address: rewardAddr,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [userAddress, routerAddress]
            }) as bigint;

            if (allowance < balance) {
                setStatusData({ currentOperation: `Approving Router...` });
                addLog('2/5 Approving Router...');
                const approveHash = await writeContractAsync({
                    address: rewardAddr,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [routerAddress, balance]
                });
                setStatusData({ txHash: approveHash, currentOperation: 'Confirming Approval...' });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                addLog('Approval Confirmed.');
            }

            // --------------------------------------------------------
            // CAPTURE BALANCES BEFORE SWAP (For Delta Depositing)
            // --------------------------------------------------------
            const wS_ADDRESS = '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38' as `0x${string}`;
            const isShadow = checkIsShadow(vaultConfig);
            const isNativeToken = !isShadow && vaultConfig.tokenX === 'S';

            const balanceXBefore = await publicClient.readContract({
                address: tokenXAddr,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            }) as bigint;

            const balanceYBefore = await publicClient.readContract({
                address: tokenYAddr,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            }) as bigint;

            // Track wS balance BEFORE swap if we need Native S
            let balanceWSBefore = 0n;
            if (isNativeToken) {
                balanceWSBefore = await publicClient.readContract({
                    address: wS_ADDRESS,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress]
                }) as bigint;
                addLog(`wS balance before swap: ${formatUnits(balanceWSBefore, 18)}`);
            }

            addLog(`Balances before swap: ${formatUnits(balanceXBefore, getTokenDecimals(vaultConfig.tokenX))} ${vaultConfig.tokenX}, ${formatUnits(balanceYBefore, getTokenDecimals(vaultConfig.tokenY))} ${vaultConfig.tokenY}`);

            // --------------------------------------------------------
            // STEP 3: SWAP X
            // --------------------------------------------------------
            setCurrentStep('swapping');
            setStatusData({ currentOperation: `Swapping for ${vaultConfig.tokenX}...` });
            addLog(`3/5 Swapping to ${vaultConfig.tokenX}...`);

            const swapXHash = await sendTransactionAsync({
                to: routerAddress,
                data: quoteX.data.data as `0x${string}`,
                value: BigInt(quoteX.data.value || 0)
            });
            setStatusData({ txHash: swapXHash, currentOperation: `Confirming ${vaultConfig.tokenX} Swap...` });
            await publicClient.waitForTransactionReceipt({ hash: swapXHash });
            addLog(`${vaultConfig.tokenX} Swap Complete.`);

            // --------------------------------------------------------
            // STEP 4: SWAP Y
            // --------------------------------------------------------
            setStatusData({ currentOperation: `Swapping for ${vaultConfig.tokenY}...` });
            addLog(`4/5 Swapping to ${vaultConfig.tokenY}...`);

            const swapYHash = await sendTransactionAsync({
                to: routerAddress,
                data: quoteY.data.data as `0x${string}`,
                value: BigInt(quoteY.data.value || 0)
            });
            setStatusData({ txHash: swapYHash, currentOperation: `Confirming ${vaultConfig.tokenY} Swap...` });
            await publicClient.waitForTransactionReceipt({ hash: swapYHash });
            addLog(`${vaultConfig.tokenY} Swap Complete.`);

            // --------------------------------------------------------
            // STEP 5: DEPOSIT (Using Delta)
            // --------------------------------------------------------
            setCurrentStep('depositing');
            setStatusData({ currentOperation: 'Reading actual balances...' });
            addLog('5/5 Depositing to Vault...');

            // Read actual balances after swaps
            const balanceXAfter = await publicClient.readContract({
                address: tokenXAddr,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            }) as bigint;

            const balanceYAfter = await publicClient.readContract({
                address: tokenYAddr,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            }) as bigint;

            // Calculate delta (only what was swapped)
            let swappedAmountX = balanceXAfter - balanceXBefore;
            let swappedAmountY = balanceYAfter - balanceYBefore;

            const vaultContractAddress = vaultAddr;

            // --------------------------------------------------------
            // UNWRAP wS IF NEEDED (For Metro Native S Vaults)
            // --------------------------------------------------------
            // Metro Vaults with 'S' require Native S.
            // If we received wS from swap (common), we must unwrap it first.
            if (isNativeToken) {
                // Check if Native S balance increased as expected
                if (swappedAmountX <= 0n) {
                    addLog('Native S balance unchanged. Checking for wS delta...');

                    const balanceWSAfter = await publicClient.readContract({
                        address: wS_ADDRESS,
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [userAddress]
                    }) as bigint;

                    const wsGained = balanceWSAfter - balanceWSBefore;

                    if (wsGained > 0n) {
                        addLog(`Found ${formatUnits(wsGained, 18)} NEW wS (delta). Unwrapping to Native S...`);
                        setStatusData({ currentOperation: 'Unwrapping wS to Native S...' });

                        const WETH_ABI = [{
                            inputs: [{ name: 'amount', type: 'uint256' }],
                            name: 'withdraw',
                            outputs: [],
                            stateMutability: 'nonpayable',
                            type: 'function'
                        }] as const;

                        const unwrapHash = await writeContractAsync({
                            address: wS_ADDRESS,
                            abi: WETH_ABI,
                            functionName: 'withdraw',
                            args: [wsGained]
                        });

                        addLog('Confirming Unwrap...');
                        await publicClient.waitForTransactionReceipt({ hash: unwrapHash });
                        addLog('Unwrap Complete.');

                        // Use the exact delta amount we unwrapped
                        swappedAmountX = wsGained;
                    }
                }
            }

            addLog(`Swapped X (${vaultConfig.tokenX}): ${formatUnits(swappedAmountX, getTokenDecimals(vaultConfig.tokenX))} (Expected: ~${formatUnits(BigInt(quoteX.data.outAmount || 0), getTokenDecimals(vaultConfig.tokenX))})`);
            addLog(`Swapped Y (${vaultConfig.tokenY}): ${formatUnits(swappedAmountY, getTokenDecimals(vaultConfig.tokenY))} (Expected: ~${formatUnits(BigInt(quoteY.data.outAmount || 0), getTokenDecimals(vaultConfig.tokenY))})`);

            if (swappedAmountX <= 0n) throw new Error(`Swap X failed: Balance (S or wS) did not increase.`);
            if (swappedAmountY <= 0n) throw new Error(`Swap Y failed: Balance did not increase.`);


            // Approve vault for Token X (if not native and amount > 0)
            if (!isNativeToken && swappedAmountX > 0n) {
                const allowanceX = await publicClient.readContract({
                    address: tokenXAddr,
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [userAddress, vaultContractAddress]
                }) as bigint;

                if (allowanceX < swappedAmountX) {
                    addLog(`Approving vault for ${vaultConfig.tokenX}...`);
                    const approveXHash = await writeContractAsync({
                        address: tokenXAddr,
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [vaultContractAddress, swappedAmountX]
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approveXHash });
                }
            }

            // Approve vault for Token Y (if amount > 0)
            if (swappedAmountY > 0n) {
                const allowanceY = await publicClient.readContract({
                    address: tokenYAddr,
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [userAddress, vaultContractAddress]
                }) as bigint;

                if (allowanceY < swappedAmountY) {
                    addLog(`Approving vault for ${vaultConfig.tokenY}...`);
                    const approveYHash = await writeContractAsync({
                        address: tokenYAddr,
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [vaultContractAddress, swappedAmountY]
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approveYHash });
                }
            }

            // Verify Amounts
            addLog(`Ready to Deposit:`);
            addLog(`X (${vaultConfig.tokenX}): ${formatUnits(swappedAmountX, getTokenDecimals(vaultConfig.tokenX))}`);
            addLog(`Y (${vaultConfig.tokenY}): ${formatUnits(swappedAmountY, getTokenDecimals(vaultConfig.tokenY))}`);

            if (swappedAmountY === 0n) {
                addLog('CRITICAL WARNING: Token Y amount is 0!');
            }

            // Deposit
            setStatusData({ currentOperation: 'Depositing to vault...' });

            let depositHash: `0x${string}`;
            if (isNativeToken) {
                depositHash = await writeContractAsync({
                    address: vaultContractAddress,
                    abi: METRO_VAULT_ABI,
                    functionName: 'depositNative',
                    args: [swappedAmountX, swappedAmountY, 0n],
                    value: swappedAmountX
                });
            } else {
                depositHash = await writeContractAsync({
                    address: vaultContractAddress,
                    abi: METRO_VAULT_ABI,
                    functionName: 'deposit',
                    args: [swappedAmountX, swappedAmountY, 0n]
                });
            }

            setStatusData({ txHash: depositHash, currentOperation: 'Confirming Deposit...' });
            await publicClient.waitForTransactionReceipt({ hash: depositHash });
            addLog('Deposit successful! Autocompound complete.');

            setCurrentStep('complete');
            setTimeout(onClose, 2500);

        } catch (err: any) {
            console.error(err);
            setCurrentStep('error');
            setStatusData(prev => ({ ...prev, error: err.message || 'Transaction Failed' }));
            addLog(`Error: ${err.message}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-arca-gray border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BoltIcon className="w-6 h-6 text-yellow-400" />
                        Autocompound (Sequential)
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Display */}
                    <div className="space-y-4">
                        <div className={`p-4 rounded-xl border ${currentStep === 'error' ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-800/30 border-gray-700'}`}>
                            <div className="flex items-center gap-3">
                                {currentStep === 'error' ? (
                                    <ExclamationCircleIcon className="w-6 h-6 text-red-500" />
                                ) : currentStep === 'complete' ? (
                                    <CheckCircleIcon className="w-6 h-6 text-arca-green" />
                                ) : currentStep === 'idle' ? (
                                    <BoltIcon className="w-6 h-6 text-gray-400" />
                                ) : (
                                    <ArrowPathIcon className="w-6 h-6 text-arca-green animate-spin" />
                                )}
                                <div>
                                    <h3 className={`font-semibold ${currentStep === 'error' ? 'text-red-400' : 'text-white'}`}>
                                        {currentStep === 'idle' ? 'Ready to Compound' :
                                            currentStep === 'complete' ? 'Compound Complete!' :
                                                currentStep === 'error' ? 'Transaction Failed' :
                                                    statusData.currentOperation}
                                    </h3>
                                    {statusData.txHash && (
                                        <a href={`https://sonicscan.org/tx/${statusData.txHash}`} target="_blank" className="text-xs text-blue-400 hover:underline mt-1 block">
                                            View Transaction ↗
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Step Progress */}
                        <div className="flex justify-between px-2 text-xs text-gray-500">
                            <span className={['claiming', 'approving', 'swapping', 'depositing', 'complete'].includes(currentStep) ? 'text-arca-green font-bold' : ''}>1. Claim</span>
                            <span className="text-gray-700">→</span>
                            <span className={['approving', 'swapping', 'depositing', 'complete'].includes(currentStep) ? 'text-arca-green font-bold' : ''}>2. Approve</span>
                            <span className="text-gray-700">→</span>
                            <span className={['swapping', 'depositing', 'complete'].includes(currentStep) ? 'text-arca-green font-bold' : ''}>3. Swap</span>
                            <span className="text-gray-700">→</span>
                            <span className={['depositing', 'complete'].includes(currentStep) ? 'text-arca-green font-bold' : ''}>4. Deposit</span>
                        </div>
                    </div>

                    {/* Action Button */}
                    {currentStep === 'idle' || currentStep === 'error' ? (
                        <button
                            onClick={executeSequentialFlow}
                            className="w-full bg-arca-green text-black font-bold py-3 rounded-xl hover:bg-arca-green/90 transition-all flex items-center justify-center gap-2"
                        >
                            {currentStep === 'error' ? 'Retry Process' : 'Start Compound Process'}
                        </button>
                    ) : (
                        <div className="h-12 flex items-center justify-center text-gray-500 text-sm animate-pulse">
                            Please confirm transactions in your wallet...
                        </div>
                    )}

                    {/* Logs */}
                    <div className="bg-black/40 rounded-lg p-3 h-32 overflow-y-auto text-[10px] font-mono text-gray-500 custom-scrollbar border border-gray-800">
                        {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
                        <div className="h-4" /> {/* spacer */}
                    </div>
                </div>
            </div>
        </div>
    );
}
