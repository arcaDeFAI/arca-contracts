import { ethers } from "hardhat";
import chalk from "chalk";
import fs from "fs";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { IERC20MetadataUpgradeable } from "../typechain-types/openzeppelin-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable";

// Common test configuration
export interface TestConfig {
    vaultAddress: string;
    strategyAddress: string;
    signer?: SignerWithAddress;
    dryRun: boolean;
    exportPath: string;
}

// Test result structure
export interface TestResult {
    timestamp: number;
    action: string;
    params: Record<string, unknown>;
    txHash?: string;
    gasUsed?: string;
    events?: Array<{event?: string; args?: Record<string, unknown>}>;
    error?: string;
    stateBefore?: VaultState;
    stateAfter?: VaultState;
}

// Vault state structure
export interface VaultState {
    vault: {
        balanceX: string;
        balanceY: string;
        totalSupply: string;
    };
    user: {
        shares: string;
        tokenXBalance: string;
        tokenYBalance: string;
    };
}

// Amount suggestion structure
export interface SuggestedAmount {
    label: string;
    wei: bigint;
}

// Vault contract interface (common methods)
export interface IVaultContract {
    getBalances(): Promise<[bigint, bigint]>;
    totalSupply(): Promise<bigint>;
    balanceOf(address: string): Promise<bigint>;
    previewAmounts(shares: bigint): Promise<[bigint, bigint]>;
    previewShares(amountX: bigint, amountY: bigint): Promise<[bigint, bigint, bigint]>;
    decimals(): Promise<number>;
    isDepositsPaused(): Promise<boolean>;
    getStrategy(): Promise<string>;
    getCurrentRound(): Promise<number>;
    getQueuedWithdrawal(round: number, user: string): Promise<bigint>;
    interface: {
        parseError(data: string): {name: string; args: unknown} | null;
    };
}

// Execute options
export interface ExecuteOptions {
    signer: SignerWithAddress;
    dryRun: boolean;
    vault?: IVaultContract;
    captureState?: (user: string) => Promise<VaultState | null>;
}

// Token helper functions
export async function getTokenSymbol(token: IERC20MetadataUpgradeable): Promise<string> {
    try {
        return await token.symbol();
    } catch (e) {
        // Fallback - return shortened address
        const address = await token.getAddress();
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
}

export async function getTokenDecimals(token: IERC20MetadataUpgradeable): Promise<number> {
    try {
        return Number(await token.decimals());
    } catch (e) {
        return 18; // Default to 18 if we can't fetch
    }
}

// Formatting utilities
export const formatters = {
    tokenAmount: (amount: bigint, decimals: number, symbol: string): string => {
        const formatted = ethers.formatUnits(amount, decimals);
        return `${formatted} ${symbol}`;
    },
    
    // New balance formatting functions
    formatBalance: async (amount: bigint, token: IERC20MetadataUpgradeable): Promise<string> => {
        try {
            const decimals = await getTokenDecimals(token);
            const symbol = await getTokenSymbol(token);
            const formatted = ethers.formatUnits(amount, decimals);
            return `${formatted} ${symbol}`;
        } catch (e) {
            return amount.toString(); // Fallback to raw value
        }
    },
    
    formatBalanceWithSymbol: (amount: bigint, decimals: number, symbol: string): string => {
        const formatted = ethers.formatUnits(amount, decimals);
        return `${formatted} ${symbol}`;
    },
    
    formatShareAmount: (shares: bigint, decimals: number): string => {
        const formatted = ethers.formatUnits(shares, decimals);
        return `${formatted} shares`;
    },
    
    // Format reward token from address
    formatRewardAmount: async (amount: bigint, tokenAddress: string, signer: SignerWithAddress): Promise<string> => {
        try {
            const token = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenAddress, signer);
            const decimals = await getTokenDecimals(token);
            const symbol = await getTokenSymbol(token);
            const formatted = ethers.formatUnits(amount, decimals);
            return `${formatted} ${symbol}`;
        } catch (e) {
            return amount.toString(); // Fallback to raw value
        }
    },
    
    tokenInfo: async (token: IERC20MetadataUpgradeable | undefined, label: string): Promise<string> => {
        if (!token) return `${label}: NOT LOADED`;
        
        try {
            const symbol = await getTokenSymbol(token);
            return `${label} (${symbol})`;
        } catch (e) {
            return `${label}: ERROR`;
        }
    },
    
    tokenInfoWithAddress: async (token: IERC20MetadataUpgradeable | undefined, label: string): Promise<string> => {
        if (!token) return `${label}: NOT LOADED`;
        
        try {
            const symbol = await getTokenSymbol(token);
            const address = await token.getAddress();
            return `${label} (${symbol}): ${address}`;
        } catch (e) {
            return `${label}: ERROR`;
        }
    },
    
    stateChanges: (before: any, after: any) => {
        console.log(chalk.blue("\n📊 State Changes:"));
        
        // Vault changes
        if (before.vault && after.vault) {
            if (before.vault.balanceX !== after.vault.balanceX) {
                console.log(chalk.gray(`  Vault Balance X: ${before.vault.balanceX} → ${after.vault.balanceX}`));
            }
            if (before.vault.balanceY !== after.vault.balanceY) {
                console.log(chalk.gray(`  Vault Balance Y: ${before.vault.balanceY} → ${after.vault.balanceY}`));
            }
            if (before.vault.totalSupply !== after.vault.totalSupply) {
                console.log(chalk.gray(`  Total Supply: ${before.vault.totalSupply} → ${after.vault.totalSupply}`));
            }
        }
        
        // User changes
        if (before.user && after.user) {
            if (before.user.shares !== after.user.shares) {
                console.log(chalk.gray(`  User Shares: ${before.user.shares} → ${after.user.shares}`));
            }
            if (before.user.tokenXBalance !== after.user.tokenXBalance) {
                console.log(chalk.gray(`  User Token X: ${before.user.tokenXBalance} → ${after.user.tokenXBalance}`));
            }
            if (before.user.tokenYBalance !== after.user.tokenYBalance) {
                console.log(chalk.gray(`  User Token Y: ${before.user.tokenYBalance} → ${after.user.tokenYBalance}`));
            }
        }
    }
};

// Amount suggestions generator
export function generateAmountSuggestions(
    symbol: string,
    decimals: number,
    isStablecoin: boolean,
    isFirstDeposit: boolean
): SuggestedAmount[] {
    let amounts = [1, 0.1, 0.01];
    
    // For first deposit, suggest larger amounts
    if (isFirstDeposit) {
        if (isStablecoin) {
            amounts = [100, 10, 1]; // $100, $10, $1 for stablecoins
        } else {
            amounts = [1, 0.1, 0.02]; // Adjust for other tokens
        }
    }
    
    return amounts.map(amount => {
        const wei = BigInt(Math.floor(amount * (10 ** decimals)));
        const label = isStablecoin && isFirstDeposit ? `$${amount}` : `${amount} ${symbol}`;
        return { label, wei };
    });
}

// Share withdrawal suggestions
export function generateShareSuggestions(
    currentShares: bigint,
    decimals: number
): Array<{label: string, amount: bigint, percentage: number}> {
    if (currentShares === 0n) {
        return [];
    }
    
    const suggestions = [
        { label: "25%", percentage: 25 },
        { label: "50%", percentage: 50 },
        { label: "75%", percentage: 75 },
        { label: "Max (100%)", percentage: 100 }
    ];
    
    return suggestions.map(s => ({
        label: s.label,
        amount: (currentShares * BigInt(s.percentage)) / 100n,
        percentage: s.percentage
    }));
}

// Estimate tokens from shares
export async function estimateTokensFromShares(
    vault: IVaultContract,
    shares: bigint
): Promise<{amountX: bigint, amountY: bigint}> {
    try {
        const [amountX, amountY] = await vault.previewAmounts(shares);
        return { amountX, amountY };
    } catch (error) {
        console.error(chalk.red("Error estimating tokens:"), error);
        return { amountX: 0n, amountY: 0n };
    }
}


// Format time ago
export function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Calculate optimal deposit ratio
export async function calculateOptimalRatio(
    vault: IVaultContract,
    tokenX: IERC20MetadataUpgradeable,
    tokenY: IERC20MetadataUpgradeable
): Promise<{ratioX: number, ratioY: number, message: string}> {
    try {
        const [balanceX, balanceY] = await vault.getBalances();
        const totalSupply = await vault.totalSupply();
        
        if (totalSupply === 0n || (balanceX === 0n && balanceY === 0n)) {
            return {
                ratioX: 50,
                ratioY: 50,
                message: "First deposit - any ratio accepted"
            };
        }
        
        const decimalsX = await getTokenDecimals(tokenX);
        const decimalsY = await getTokenDecimals(tokenY);
        
        // Normalize to same decimal base
        const normalizedX = Number(balanceX) / (10 ** decimalsX);
        const normalizedY = Number(balanceY) / (10 ** decimalsY);
        const total = normalizedX + normalizedY;
        
        if (total === 0) {
            return { ratioX: 50, ratioY: 50, message: "Equal ratio recommended" };
        }
        
        const ratioX = Math.round((normalizedX / total) * 100);
        const ratioY = Math.round((normalizedY / total) * 100);
        
        return {
            ratioX,
            ratioY,
            message: `Current vault ratio: ${ratioX}% X / ${ratioY}% Y`
        };
    } catch (error) {
        return { ratioX: 50, ratioY: 50, message: "Could not calculate ratio" };
    }
}

// Test result manager
export class TestResultManager {
    private results: TestResult[] = [];
    
    captureResult(result: TestResult): void {
        this.results.push(result);
    }
    
    getResults(): TestResult[] {
        return this.results;
    }
    
    async exportToFile(filepath: string): Promise<void> {
        if (this.results.length === 0) {
            console.log(chalk.yellow("\nNo results to export"));
            return;
        }
        
        try {
            fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
            console.log(chalk.green(`\n✅ Results exported to: ${filepath}`));
        } catch (error) {
            console.error(chalk.red("Error exporting results:"), error);
        }
    }
}

// Capture vault state
export async function captureVaultState(
    vault: IVaultContract,
    tokenX: IERC20MetadataUpgradeable,
    tokenY: IERC20MetadataUpgradeable,
    user: string
): Promise<VaultState> {
    try {
        const [balanceX, balanceY] = await vault.getBalances();
        const totalSupply = await vault.totalSupply();
        const userBalance = await vault.balanceOf(user);
        const [tokenXBalance, tokenYBalance] = await Promise.all([
            tokenX.balanceOf(user),
            tokenY.balanceOf(user)
        ]);
        
        return {
            vault: {
                balanceX: balanceX.toString(),
                balanceY: balanceY.toString(),
                totalSupply: totalSupply.toString()
            },
            user: {
                shares: userBalance.toString(),
                tokenXBalance: tokenXBalance.toString(),
                tokenYBalance: tokenYBalance.toString()
            }
        };
    } catch (error) {
        console.error(chalk.red("Error capturing state:"), error);
        throw error;
    }
}

// Gas estimation helper
export async function estimateGasWithCost(
    actionFn: () => Promise<{toString(): string}>,
    gasPrice?: bigint
): Promise<{ gas: bigint, costEth: string, costUsd?: string }> {
    try {
        const estimatedGas = await actionFn();
        const gas = BigInt(estimatedGas.toString());
        
        // Use provided gas price or fetch current
        const effectiveGasPrice = gasPrice || (await ethers.provider.getGasPrice());
        const costWei = gas * effectiveGasPrice;
        const costEth = ethers.formatEther(costWei);
        
        return {
            gas,
            costEth,
            costUsd: undefined // Could integrate with price oracle for USD conversion
        };
    } catch (error) {
        throw new Error(`Gas estimation failed: ${error}`);
    }
}

// Transaction execution wrapper
export async function executeWithCapture(
    actionName: string,
    actionFn: () => Promise<{hash: string; wait(): Promise<{gasUsed: bigint; events?: Array<{event?: string; args?: Record<string, unknown>}>}>}>,
    options: ExecuteOptions & { params?: Record<string, unknown> }
): Promise<TestResult> {
    const result: TestResult = {
        timestamp: Date.now(),
        action: actionName,
        params: options.params || {}
    };

    try {
        // Capture state before if capture function provided
        if (options.captureState) {
            const state = await options.captureState(options.signer.address);

            if (state) {
                result.stateBefore = state;
            }
        }

        if (options.dryRun) {
            console.log(chalk.yellow("\n🔍 DRY RUN - Transaction not executed"));
            console.log(chalk.gray("Parameters:"), options.params);
            
            // Estimate gas if possible
            try {
                const estimatedGas = await actionFn();
                console.log(chalk.gray("Estimated gas:"), estimatedGas.toString());
            } catch (error) {
                // TODO FIX ME: gas estimates always fail
                console.log(chalk.gray(`Gas estimation failed: ${error}`));
            }
            
            result.error = "Dry run - not executed";
        } else {
            console.log(chalk.blue("\n📤 Executing transaction..."));
            const tx = await actionFn();
            console.log(chalk.gray("Transaction hash:"), tx.hash);
            
            const receipt = await tx.wait();
            console.log(chalk.green("✅ Transaction confirmed"));
            console.log(chalk.gray("Gas used:"), receipt.gasUsed.toString());
            
            result.txHash = tx.hash;
            result.gasUsed = receipt.gasUsed.toString();
            result.events = receipt.events;
            
            // Log events
            if (receipt.events && receipt.events.length > 0) {
                console.log(chalk.blue("\n📋 Events:"));
                receipt.events.forEach((event) => {
                    if (event.event) {
                        console.log(chalk.cyan(`  - ${event.event}`));
                        if (event.args) {
                            Object.entries(event.args).forEach(([key, value]) => {
                                if (isNaN(Number(key))) {
                                    console.log(chalk.gray(`    ${key}: ${value?.toString() || 'N/A'}`));
                                }
                            });
                        }
                    }
                });
            }
        }

        // Capture state after if capture function provided
        if (options.captureState && !options.dryRun) {
            const state = await options.captureState(options.signer.address);
            if (state) {
                result.stateAfter = state;
            }
            
            // Show state changes
            if (result.stateBefore && result.stateAfter) {
                formatters.stateChanges(result.stateBefore, result.stateAfter);
            }
        }

    } catch (error: any) {
        console.error(chalk.red("\n❌ Error:"), error.message || error);
        
        // Try to get more details about the revert
        if (error.reason) {
            console.error(chalk.red("Reason:"), error.reason);
        }
        if (error.data && options.vault) {
            try {
                const decodedError = options.vault.interface.parseError(error.data);
                if (decodedError) {
                    console.error(chalk.red("Decoded error:"), decodedError.name, decodedError.args);
                }
            } catch (e) {
                // Could not decode error
            }
        }
        
        result.error = error.message || error.toString();
    }

    return result;
}

// Visual range display for ticks/bins
export function displayVisualRange(
    lower: number,
    upper: number,
    current: number,
    type: "tick" | "bin" = "tick"
): void {
    const width = 50;
    const range = upper - lower;
    const currentPos = Math.round(((current - lower) / range) * width);
    
    console.log(chalk.cyan(`\n${type === "tick" ? "Tick" : "Bin"} Range Visualization:`));
    console.log(chalk.gray(`[${lower}]` + "─".repeat(width) + `[${upper}]`));
    
    let visual = "";
    for (let i = 0; i <= width; i++) {
        if (i === currentPos) {
            visual += chalk.yellow("█");
        } else if (i === 0 || i === width) {
            visual += "|";
        } else {
            visual += "─";
        }
    }
    console.log(visual);
    console.log(chalk.gray(" ".repeat(currentPos) + `↑ Current: ${current}`));
    console.log("");
}

// Common UI helpers
export const ui = {
    showTokenAmountSuggestions: async (
        tokenX: IERC20MetadataUpgradeable,
        tokenY: IERC20MetadataUpgradeable,
        isFirstDeposit: boolean
    ) => {
        try {
            const [symbolX, decimalsX, symbolY, decimalsY] = await Promise.all([
                getTokenSymbol(tokenX),
                getTokenDecimals(tokenX),
                getTokenSymbol(tokenY),
                getTokenDecimals(tokenY)
            ]);
            
            console.log(chalk.gray(`Token X: ${symbolX} (${decimalsX} decimals)`));
            console.log(chalk.gray(`Token Y: ${symbolY} (${decimalsY} decimals)`));
            
            if (isFirstDeposit) {
                console.log(chalk.yellow("\n⚠️  FIRST DEPOSIT DETECTED!"));
                console.log(chalk.yellow("    1,000,000 shares will be locked in vault"));
                console.log(chalk.yellow("    You need to deposit value > $1 to receive shares\n"));
            }
            
            console.log(chalk.gray("Suggested amounts:"));
            
            // For Token X
            console.log(chalk.gray("\nFor Token X:"));
            const suggestionsX = generateAmountSuggestions(
                symbolX, 
                decimalsX, 
                false, 
                isFirstDeposit
            );
            suggestionsX.forEach(s => {
                console.log(chalk.gray(`  - ${s.label} = ${s.wei.toString()} wei`));
            });
            
            // For Token Y
            console.log(chalk.gray("\nFor Token Y:"));
            const isUSDC = symbolY.toUpperCase() === "USDC";
            const suggestionsY = generateAmountSuggestions(
                symbolY, 
                decimalsY, 
                isUSDC, 
                isFirstDeposit
            );
            suggestionsY.forEach(s => {
                console.log(chalk.gray(`  - ${s.label} = ${s.wei.toString()} wei`));
            });
            
            if (isFirstDeposit) {
                console.log(chalk.cyan("\n💡 Run 'npx hardhat run scripts/deposit-ratio-helper.ts' for optimal ratios"));
            }
            
            console.log("");
        } catch (e) {
            console.log(chalk.yellow("Could not fetch token information"));
        }
    },
    
    showShareWithdrawalContext: async (
        vault: IVaultContract,
        signer: SignerWithAddress,
        tokenX: IERC20MetadataUpgradeable,
        tokenY: IERC20MetadataUpgradeable
    ) => {
        try {
            const userShares = await vault.balanceOf(signer.address);
            const totalSupply = await vault.totalSupply();
            const decimals = Number(await vault.decimals());
            const currentRound = await vault.getCurrentRound();
            
            // Check queued shares
            let totalQueued = 0n;
            for (let i = 0; i <= currentRound; i++) {
                const queued = await vault.getQueuedWithdrawal(i, signer.address);
                totalQueued += queued;
            }
            
            // Format shares
            const userSharesFormatted = formatters.formatShareAmount(userShares, decimals);
            const totalSharesFormatted = formatters.formatShareAmount(totalSupply, decimals);
            const queuedSharesFormatted = formatters.formatShareAmount(totalQueued, decimals);
            
            // Calculate ownership percentage including queued shares
            const totalOwned = userShares + totalQueued;
            const ownershipPercent = totalSupply > 0n 
                ? (Number(totalOwned) / Number(totalSupply) * 100).toFixed(2)
                : "0";
            
            console.log(chalk.cyan(`\nYour Balance: ${userSharesFormatted}`));
            if (totalQueued > 0n) {
                console.log(chalk.yellow(`Queued for withdrawal: ${queuedSharesFormatted}`));
                console.log(chalk.gray(`Total owned: ${formatters.formatShareAmount(totalOwned, decimals)}`));
            }
            console.log(chalk.gray(`Vault Total: ${totalSharesFormatted} (you own ${ownershipPercent}%)`));
            
            // Check if user has any shares to withdraw
            if (userShares === 0n && totalQueued > 0n) {
                console.log(chalk.yellow("\n⚠️  All your shares are already queued for withdrawal"));
                console.log(chalk.yellow("Use 'Cancel Queued Withdrawal' or wait for rebalance to process"));
                return;
            } else if (userShares === 0n) {
                console.log(chalk.yellow("\n⚠️  You have no shares to withdraw"));
                return;
            }
            
            // Show suggestions based on available shares
            console.log(chalk.gray("\nSuggested amounts:"));
            const suggestions = generateShareSuggestions(userShares, decimals);
            
            for (const suggestion of suggestions) {
                const formatted = formatters.formatShareAmount(suggestion.amount, decimals);
                console.log(chalk.gray(`  - ${suggestion.label}: ${formatted}`));
                
                // Preview what they would get
                try {
                    const { amountX, amountY } = await estimateTokensFromShares(vault, suggestion.amount);
                    if (amountX > 0n || amountY > 0n) {
                        const formattedX = await formatters.formatBalance(amountX, tokenX);
                        const formattedY = await formatters.formatBalance(amountY, tokenY);
                        console.log(chalk.gray(`    → Receive: ${formattedX} + ${formattedY}`));
                    }
                } catch (e) {
                    // Skip preview if estimation fails
                }
            }
            
            console.log(chalk.gray('\nEnter shares to withdraw (in wei) or type "max":'));
        } catch (error) {
            console.error(chalk.red("Error showing withdrawal context:"), error);
        }
    }
};

// Check and approve tokens if needed
export async function checkAndApproveTokens(
    tokenX: IERC20MetadataUpgradeable,
    tokenY: IERC20MetadataUpgradeable,
    vaultAddress: string,
    amountX: bigint,
    amountY: bigint,
    signer: SignerWithAddress,
    executeAction: (name: string, fn: () => Promise<{hash: string; wait(): Promise<{gasUsed: bigint}>}>, params?: Record<string, unknown>, skipConfirm?: boolean) => Promise<TestResult>
): Promise<void> {
    const [allowanceX, allowanceY] = await Promise.all([
        tokenX.allowance(signer.address, vaultAddress),
        tokenY.allowance(signer.address, vaultAddress)
    ]);
    
    if (allowanceX < amountX || allowanceY < amountY) {
        console.log(chalk.yellow("\n⚠️  Insufficient allowance. Approving tokens..."));
        
        if (allowanceX < amountX) {
            await executeAction("Approve Token X", async () => {
                return tokenX.approve(vaultAddress, ethers.MaxUint256);
            }, {}, true); // Skip confirmation for approvals
        }
        
        if (allowanceY < amountY) {
            await executeAction("Approve Token Y", async () => {
                return tokenY.approve(vaultAddress, ethers.MaxUint256);
            }, {}, true); // Skip confirmation for approvals
        }
    }
}

// Pre-deposit validation checks
export async function validateDeposit(
    vault: IVaultContract,
    tokenX: IERC20MetadataUpgradeable,
    tokenY: IERC20MetadataUpgradeable,
    amountX: bigint,
    amountY: bigint,
    signer: SignerWithAddress
): Promise<boolean> {
    console.log(chalk.gray("\n📋 Pre-deposit checks:"));
    
    // Check if deposits are paused
    const isPaused = await vault.isDepositsPaused();
    console.log(chalk.gray(`  Deposits paused: ${isPaused}`));
    if (isPaused) {
        console.error(chalk.red("\n❌ Deposits are currently paused"));
        return false;
    }
    
    // Check if strategy is set
    const strategyAddress = await vault.getStrategy();
    console.log(chalk.gray(`  Strategy: ${strategyAddress}`));
    if (strategyAddress === ethers.ZeroAddress) {
        console.error(chalk.red("\n❌ No strategy set on vault"));
        return false;
    }
    
    // Check user balances
    const [balanceX, balanceY] = await Promise.all([
        tokenX.balanceOf(signer.address),
        tokenY.balanceOf(signer.address)
    ]);
    console.log(chalk.gray(`  User balance X: ${balanceX.toString()}`));
    console.log(chalk.gray(`  User balance Y: ${balanceY.toString()}`));
    
    if (amountX > balanceX || amountY > balanceY) {
        console.error(chalk.red("\n❌ Insufficient token balance"));
        return false;
    }
    
    // Preview shares to see what we should get
    try {
        const [expectedShares, effectiveX, effectiveY] = await vault.previewShares(amountX, amountY);
        console.log(chalk.gray(`  Expected shares: ${expectedShares.toString()}`));
        console.log(chalk.gray(`  Effective X: ${effectiveX.toString()}`));
        console.log(chalk.gray(`  Effective Y: ${effectiveY.toString()}`));
        
        if (expectedShares === 0n && (amountX > 0n || amountY > 0n)) {
            console.error(chalk.red("\n❌ Deposit amount too small - would receive 0 shares"));
            
            const totalSupply = await vault.totalSupply();
            if (totalSupply === 0n) {
                console.log(chalk.yellow("\n⚠️  This is the first deposit!"));
                console.log(chalk.yellow("    You need to deposit value > $1 to overcome the penalty"));
                console.log(chalk.yellow("    Try: 100 USDC (100000000 wei) or equivalent value"));
            } else {
                console.log(chalk.yellow("\n💡 Try a larger amount. For USDC, try at least 1000000 wei (1 USDC)"));
            }
            return false;
        }
    } catch (previewError) {
        console.error(chalk.red("  Failed to preview shares:"), previewError);
    }
    
    return true;
}