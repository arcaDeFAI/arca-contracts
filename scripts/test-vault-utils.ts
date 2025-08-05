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
    params: any;
    txHash?: string;
    gasUsed?: string;
    events?: any[];
    error?: string;
    stateBefore?: any;
    stateAfter?: any;
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

// Execute options
export interface ExecuteOptions {
    signer: SignerWithAddress;
    dryRun: boolean;
    vault?: any;
    captureState?: (user: string) => Promise<any>;
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
    vault: any,
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

// Transaction execution wrapper
export async function executeWithCapture(
    actionName: string,
    actionFn: () => Promise<any>,
    options: ExecuteOptions & { params?: any }
): Promise<TestResult> {
    const result: TestResult = {
        timestamp: Date.now(),
        action: actionName,
        params: options.params || {}
    };

    try {
        // Capture state before if capture function provided
        if (options.captureState) {
            result.stateBefore = await options.captureState(options.signer.address);
        }

        if (options.dryRun) {
            console.log(chalk.yellow("\n🔍 DRY RUN - Transaction not executed"));
            console.log(chalk.gray("Parameters:"), options.params);
            
            // Estimate gas if possible
            try {
                const estimatedGas = await actionFn();
                console.log(chalk.gray("Estimated gas:"), estimatedGas.toString());
            } catch (error) {
                console.log(chalk.gray("Gas estimation failed"));
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
                receipt.events.forEach((event: any) => {
                    if (event.event) {
                        console.log(chalk.cyan(`  - ${event.event}`));
                        if (event.args) {
                            Object.keys(event.args).forEach((key) => {
                                if (isNaN(Number(key))) {
                                    console.log(chalk.gray(`    ${key}: ${event.args[key].toString()}`));
                                }
                            });
                        }
                    }
                });
            }
        }

        // Capture state after if capture function provided
        if (options.captureState && !options.dryRun) {
            result.stateAfter = await options.captureState(options.signer.address);
            
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
    executeAction: (name: string, fn: () => Promise<any>) => Promise<any>
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
            });
        }
        
        if (allowanceY < amountY) {
            await executeAction("Approve Token Y", async () => {
                return tokenY.approve(vaultAddress, ethers.MaxUint256);
            });
        }
    }
}

// Pre-deposit validation checks
export async function validateDeposit(
    vault: any,
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