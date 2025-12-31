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

// ... (in component)

const calls: { target: `0x${string}`; allowFailure: boolean; callData: `0x${string}` }[] = [];

let totalEstimatedX = 0n;
let totalEstimatedY = 0n;

// ============================================
// STEP 1: CLAIM from vault
// ============================================
addDebug('Adding claim call');
// Based on confirmed tx data: 0x4e71d92d is 'claim()'
calls.push({
    target: vaultAddr,
    allowFailure: false, // Claim MUST succeed
    callData: encodeFunctionData({
        abi: METRO_VAULT_ABI,
        functionName: 'claim'
    })
});

// ... (Swap loop)

// Approve Router to spend Reward Token (from Multicall)
calls.push({
    target: reward.token as `0x${string}`,
    allowFailure: true,
    callData: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, totalAmount]
    })
});

// Execute Swap X
calls.push({
    target: swapXData.data.to as `0x${string}`,
    allowFailure: true,
    callData: swapXData.data.data as `0x${string}`
});

// Execute Swap Y
calls.push({
    target: swapYData.data.to as `0x${string}`,
    allowFailure: true,
    callData: swapYData.data.data as `0x${string}`
});
            }

// ... (set output)

setTotalCalls(calls.length);

setStep('signing');

// No manual gas limit needed for aggregate3 usually, but keeping robust
const tx = await writeContractAsync({
    address: MULTICALL3_ADDRESS,
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [calls]
});

setTxHash(tx);
setStep('executing');

const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
}

setStep('complete');
setTimeout(() => onClose(), 2000);

        } catch (e: any) {
    console.error('Compound error:', e);
    addDebug(`ERROR: ${e.message}`);
    setError(e.message || 'Transaction failed');
    setStep('error');
}
    };

useEffect(() => {
    executeCompound();
}, []);

return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-arca-gray border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-arca-gray to-arca-dark">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <BoltIcon className={`w-6 h-6 text-yellow-400 ${step !== 'complete' ? 'animate-pulse' : ''}`} />
                    Autocompound (Claim & Swap)
                </h2>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>

            <div className="p-6 space-y-4">
                {/* Progress UI */}
                <div className="space-y-3">
                    <div className={`p-4 rounded-lg border flex items-center justify-between ${step === 'complete' ? 'bg-arca-green/10 border-arca-green' : 'bg-gray-800/30 border-gray-800'}`}>
                        <div>
                            <h3 className="text-sm font-medium text-white">Full Process</h3>
                            <p className="text-xs text-gray-500">Claim Rewards → Swap to Tokens → Send to Wallet</p>
                        </div>
                        {step === 'preparing' && <div className="text-xs text-blue-400">Preparing...</div>}
                        {step === 'signing' && <div className="text-xs text-yellow-400">Sign Wallet...</div>}
                        {step === 'executing' && <div className="text-xs text-blue-400 animate-pulse">Executing...</div>}
                        {step === 'complete' && <CheckCircleIcon className="w-6 h-6 text-arca-green" />}
                        {step === 'error' && <ExclamationCircleIcon className="w-6 h-6 text-red-500" />}
                    </div>

                    {txHash && (
                        <a href={`https://sonicscan.org/tx/${txHash}`} target="_blank" className="block text-center text-xs text-arca-green hover:underline">
                            View Transaction
                        </a>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                            {error}
                        </div>
                    )}
                </div>

                {/* Debug Log */}
                <div className="bg-black/40 rounded-lg p-3 h-48 overflow-y-auto text-xs font-mono text-gray-400 custom-scrollbar">
                    {debugInfo.map((msg, i) => <div key={i}>{msg}</div>)}
                </div>
            </div>
        </div>
    </div>
);
}
