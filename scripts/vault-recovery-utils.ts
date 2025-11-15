import { ethers } from "hardhat";
import chalk from "chalk";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { IVaultFactory } from "../typechain-types";
import type { ContractTransactionResponse } from "ethers";

// Token info structure for display
export interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    balance: bigint;
    formattedBalance: string;
    isVaultToken: boolean;
    isRecoverable: boolean;
    warningMessage?: string;
}

// Recovery options
export interface RecoveryOption {
    type: 'quick' | 'discover' | 'emergency' | 'batch';
    description: string;
}

// Common token addresses on Sonic blockchain (can be extended)
export const COMMON_TOKENS: Record<string, string> = {
    USDC: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",  // USDC on Sonic
    USDT: "0x6047828dc181963ba44974801FF68e538dA5eaF9",  // USDT on Sonic
    WETH: "0x50c42dEAcD8Fc9773493ED674b675bE577f2634b",  // WETH on Sonic
    WS:   "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",  // Wrapped Sonic
    EURC: "0xe715cbA7B5cCb33790ceBFF1436809d36cb17E57",  // Wrapped EURC on Sonic
    SCUSD: "0xd3DCe716f3eF535C5Ff8d041c1A41C3bd89b97aE", // Sonic USD (scUSD)
    XSHADOW: "0x5050bc082ff4a74fb6b0b04385defddb114b2424", // xSHADOW
    SHADOW: "0x3333b97138D4b086720b5aE8A7844b1345a33333", // SHADOW
    METRO: "0x71e99522ead5e21cf57f1f542dc4ad2e841f7321", // METRO
    X33:  "0x3333111a391cc08fa51353e9195526a70b333333",  // x33 (shadow)
    // Add more as needed
};

/**
 * Gets basic token information including balance in vault
 */
export async function getTokenInfo(
    tokenAddress: string,
    vaultAddress: string,
    signer: SignerWithAddress
): Promise<TokenInfo | null> {
    try {
        const token = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenAddress, signer);
        const balance = await token.balanceOf(vaultAddress);

        if (balance === 0n) {
            return null; // Skip tokens with zero balance
        }

        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const formattedBalance = ethers.formatUnits(balance, decimals);

        return {
            address: tokenAddress,
            symbol,
            decimals: Number(decimals),
            balance,
            formattedBalance,
            isVaultToken: false, // Will be set by caller
            isRecoverable: true, // Will be validated by caller
        };
    } catch (error) {
        console.log(chalk.gray(`  ⚠️ Could not get info for token ${tokenAddress}: ${error}`));
        return null;
    }
}

/**
 * Discovers tokens with balances in the vault
 */
export async function discoverTokensInVault(
    vaultAddress: string,
    tokenXAddress: string,
    tokenYAddress: string,
    signer: SignerWithAddress
): Promise<TokenInfo[]> {
    console.log(chalk.blue("\n🔍 Scanning for tokens in vault..."));

    const tokens: TokenInfo[] = [];
    const scannedAddresses = new Set<string>();

    // Always check vault's primary tokens first
    const tokenAddresses = [
        tokenXAddress,
        tokenYAddress,
        ...Object.values(COMMON_TOKENS)
    ];

    // Add vault's own token address (for shares recovery)
    tokenAddresses.push(vaultAddress);

    for (const address of tokenAddresses) {
        if (scannedAddresses.has(address.toLowerCase())) {
            continue;
        }
        scannedAddresses.add(address.toLowerCase());

        const tokenInfo = await getTokenInfo(address, vaultAddress, signer);
        if (tokenInfo) {
            // Mark vault tokens
            if (address.toLowerCase() === tokenXAddress.toLowerCase()) {
                tokenInfo.isVaultToken = true;
                tokenInfo.warningMessage = "⚠️ This is vault's Token X - recovery may affect operations";
            } else if (address.toLowerCase() === tokenYAddress.toLowerCase()) {
                tokenInfo.isVaultToken = true;
                tokenInfo.warningMessage = "⚠️ This is vault's Token Y - recovery may affect operations";
            } else if (address.toLowerCase() === vaultAddress.toLowerCase()) {
                tokenInfo.isVaultToken = true;
                tokenInfo.warningMessage = "⚠️ These are vault shares - only recoverable if sent accidentally";
                tokenInfo.symbol = `${tokenInfo.symbol} (Vault Shares)`;
            }

            tokens.push(tokenInfo);
        }
    }

    console.log(chalk.green(`✓ Found ${tokens.length} tokens with balances`));
    return tokens;
}

/**
 * Displays discovered tokens in a formatted table
 */
export function displayTokens(tokens: TokenInfo[]): void {
    if (tokens.length === 0) {
        console.log(chalk.yellow("\n📭 No tokens found in vault"));
        return;
    }

    console.log(chalk.blue("\n📊 Tokens found in vault:\n"));

    // Header
    console.log(chalk.white("  #  | Symbol         | Balance              | Address"));
    console.log(chalk.gray("  ---|----------------|---------------------|------------------------------------------"));

    tokens.forEach((token, index) => {
        const indexStr = `${index + 1}`.padStart(2);
        const symbolStr = token.symbol.padEnd(14);
        const balanceStr = token.formattedBalance.padStart(19);
        const addressStr = token.address;

        let line = `  ${indexStr} | ${symbolStr} | ${balanceStr} | ${addressStr}`;

        if (token.isVaultToken) {
            line = chalk.yellow(line);
        } else {
            line = chalk.gray(line);
        }

        console.log(line);

        if (token.warningMessage) {
            console.log(chalk.yellow(`      ${token.warningMessage}`));
        }
    });
}

/**
 * Validates if token can be safely recovered
 */
export async function validateRecovery(
    tokenInfo: TokenInfo,
    vaultContract: { getAddress(): Promise<string>; getStrategy(): Promise<string>; getCurrentTotalQueuedWithdrawal(): Promise<bigint>; balanceOf(address: string): Promise<bigint> },
    amount: bigint
): Promise<{ valid: boolean; message: string }> {
    try {
        // Check if it's a vault token with special rules
        if (tokenInfo.isVaultToken) {
            if (tokenInfo.address.toLowerCase() === (await vaultContract.getAddress()).toLowerCase()) {
                // Vault shares - check if there are excess shares
                const strategy = await vaultContract.getStrategy();
                if (strategy === ethers.ZeroAddress) {
                    return {
                        valid: false,
                        message: "Cannot recover vault shares when in emergency mode"
                    };
                }

                const queuedWithdrawals = await vaultContract.getCurrentTotalQueuedWithdrawal();
                const strategyShares = await vaultContract.balanceOf(strategy);
                const vaultShares = await vaultContract.balanceOf(await vaultContract.getAddress());
                const excessShares = strategyShares > queuedWithdrawals ? strategyShares - queuedWithdrawals : 0n;
                const totalRecoverable = vaultShares + excessShares;

                if (amount > totalRecoverable) {
                    return {
                        valid: false,
                        message: `Cannot recover ${ethers.formatUnits(amount, tokenInfo.decimals)} shares. Only ${ethers.formatUnits(totalRecoverable, tokenInfo.decimals)} excess shares available.`
                    };
                }
            }
        }

        // Check if amount exceeds balance
        if (amount > tokenInfo.balance) {
            return {
                valid: false,
                message: `Amount (${ethers.formatUnits(amount, tokenInfo.decimals)}) exceeds available balance (${tokenInfo.formattedBalance})`
            };
        }

        return { valid: true, message: "Recovery validation passed" };
    } catch (error) {
        return {
            valid: false,
            message: `Validation error: ${error}`
        };
    }
}

/**
 * Executes token recovery through VaultFactory
 */
export async function executeRecovery(
    vaultFactory: IVaultFactory,
    vaultAddress: string,
    tokenAddress: string,
    recipient: string,
    amount: bigint,
    signer: SignerWithAddress,
    executeAction: (name: string, fn: () => Promise<ContractTransactionResponse>) => Promise<{ error?: string }>
): Promise<boolean> {
    try {
        const token = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenAddress, signer);
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const formattedAmount = ethers.formatUnits(amount, decimals);

        console.log(chalk.blue(`\n📤 Recovering ${formattedAmount} ${symbol}...`));
        console.log(chalk.gray(`  From vault: ${vaultAddress}`));
        console.log(chalk.gray(`  To recipient: ${recipient}`));
        console.log(chalk.gray(`  Token: ${tokenAddress}`));

        const result = await executeAction(`Recover ${formattedAmount} ${symbol}`, async () => {
            return vaultFactory.recoverERC20(
                vaultAddress,
                tokenAddress,
                recipient,
                amount
            );
        });

        return result.error === undefined;
    } catch (error) {
        console.error(chalk.red(`\n❌ Recovery failed: ${error}`));
        return false;
    }
}

/**
 * Interactive token selection
 */
export async function selectToken(
    tokens: TokenInfo[],
    question: (prompt: string) => Promise<string>
): Promise<TokenInfo | null> {
    if (tokens.length === 0) {
        return null;
    }

    displayTokens(tokens);

    const selection = await question("\nSelect token number (or 'q' to quit): ");

    if (selection.toLowerCase() === 'q') {
        return null;
    }

    const index = parseInt(selection) - 1;
    if (isNaN(index) || index < 0 || index >= tokens.length) {
        console.log(chalk.red("Invalid selection"));
        return null;
    }

    return tokens[index];
}

/**
 * Interactive amount input with validation
 */
export async function getRecoveryAmount(
    tokenInfo: TokenInfo,
    question: (prompt: string) => Promise<string>
): Promise<bigint | null> {
    console.log(chalk.cyan(`\nToken: ${tokenInfo.symbol}`));
    console.log(chalk.gray(`Available: ${tokenInfo.formattedBalance}`));

    if (tokenInfo.warningMessage) {
        console.log(chalk.yellow(`Warning: ${tokenInfo.warningMessage}`));
    }

    const amountStr = await question("Enter amount to recover (or 'max' for all, 'q' to cancel): ");

    if (amountStr.toLowerCase() === 'q') {
        return null;
    }

    if (amountStr.toLowerCase() === 'max') {
        return tokenInfo.balance;
    }

    try {
        const amount = ethers.parseUnits(amountStr, tokenInfo.decimals);

        if (amount <= 0n) {
            console.log(chalk.red("Amount must be greater than 0"));
            return null;
        }

        if (amount > tokenInfo.balance) {
            console.log(chalk.red(`Amount exceeds available balance: ${tokenInfo.formattedBalance}`));
            return null;
        }

        return amount;
    } catch (error) {
        console.log(chalk.red(`Invalid amount format: ${error}`));
        return null;
    }
}

/**
 * Get recovery recipient address
 */
export async function getRecipientAddress(
    defaultAddress: string,
    question: (prompt: string) => Promise<string>
): Promise<string | null> {
    const recipient = await question(`Enter recipient address (or press Enter for ${defaultAddress}): `);

    if (!recipient.trim()) {
        return defaultAddress;
    }

    if (!ethers.isAddress(recipient)) {
        console.log(chalk.red("Invalid address format"));
        return null;
    }

    return recipient;
}

/**
 * Display recovery confirmation
 */
export function displayRecoveryPreview(
    tokenInfo: TokenInfo,
    amount: bigint,
    recipient: string
): void {
    const formattedAmount = ethers.formatUnits(amount, tokenInfo.decimals);

    console.log(chalk.blue("\n📋 Recovery Preview:"));
    console.log(chalk.white(`  Token: ${tokenInfo.symbol} (${tokenInfo.address})`));
    console.log(chalk.white(`  Amount: ${formattedAmount}`));
    console.log(chalk.white(`  From: Vault (${tokenInfo.address})`));
    console.log(chalk.white(`  To: ${recipient}`));

    if (tokenInfo.warningMessage) {
        console.log(chalk.red(`\n⚠️  WARNING: ${tokenInfo.warningMessage}`));
    }

    console.log(chalk.yellow("\n⚠️  This action cannot be undone!"));
}
