import { ethers, network } from "hardhat";
import readline from "readline";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { 
    OracleRewardShadowVault,
    ShadowStrategy,
    IRamsesV3Pool,
    ShadowPriceHelperWrapper
} from "../typechain-types";
import { IERC20MetadataUpgradeable } from "../typechain-types/openzeppelin-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// Test configuration
interface TestConfig {
    vaultAddress: string;
    strategyAddress: string;
    signer?: SignerWithAddress;
    dryRun: boolean;
    exportPath: string;
}

// Test result
interface TestResult {
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

class ShadowVaultTester {
    private rl: readline.Interface;
    private config: TestConfig;
    private vault?: OracleRewardShadowVault;
    private strategy?: ShadowStrategy;
    private pool?: IRamsesV3Pool;
    private priceHelper?: ShadowPriceHelperWrapper;
    private tokenX?: IERC20MetadataUpgradeable;
    private tokenY?: IERC20MetadataUpgradeable;
    private signer: SignerWithAddress;
    private results: TestResult[] = [];

    constructor(config: TestConfig) {
        this.config = config;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.signer = config.signer!;
    }

    async initialize() {
        console.log(chalk.blue("\n🚀 Initializing Shadow Vault Tester...\n"));
        
        try {
            // Connect to contracts
            console.log(chalk.gray("Loading vault contract..."));
            this.vault = await ethers.getContractAt("OracleRewardShadowVault", this.config.vaultAddress, this.signer);
            console.log(chalk.gray(`✓ Vault loaded at: ${await this.vault.getAddress()}`));

            console.log(chalk.gray("Loading pool contract..."));
            this.pool = await ethers.getContractAt("IRamsesV3Pool", await this.vault!.getPool(), this.signer);
            console.log(chalk.gray(`✓ Pool loaded at: ${await this.pool.getAddress()}`));
            
            // Load price helper wrapper if available
            console.log(chalk.gray("Loading price helper wrapper..."));
            const deploymentPath = path.join(__dirname, "../deployments", `metropolis-${network.name}.json`);
            if (fs.existsSync(deploymentPath)) {
                const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
                const priceHelperAddress = deployment.addresses?.shadowPriceHelperWrapper;
                if (priceHelperAddress && priceHelperAddress !== ethers.ZeroAddress) {
                    this.priceHelper = await ethers.getContractAt("ShadowPriceHelperWrapper", priceHelperAddress, this.signer);
                    console.log(chalk.gray(`✓ Price Helper Wrapper loaded at: ${priceHelperAddress}`));
                } else {
                    console.log(chalk.yellow(`⚠️  Price Helper Wrapper not found in deployment file`));
                }
            } else {
                console.log(chalk.yellow(`⚠️  Deployment file not found for network: ${network.name}`));
            }

            console.log(chalk.gray("Loading strategy contract..."));
            this.strategy = await ethers.getContractAt("ShadowStrategy", this.config.strategyAddress, this.signer);
            console.log(chalk.gray(`✓ Strategy loaded at: ${await this.strategy.getAddress()}`));
            
            // Get associated contracts
            console.log(chalk.gray("Getting pool address..."));
            const poolAddress = await this.vault.getPool();
            console.log(chalk.gray(`✓ Pool address: ${poolAddress}`));
            
            console.log(chalk.gray("Loading pool contract..."));
            this.pool = await ethers.getContractAt("IRamsesV3Pool", poolAddress, this.signer);
            
            console.log(chalk.gray("Getting token addresses..."));
            const tokenXAddress = await this.vault.getTokenX();
            const tokenYAddress = await this.vault.getTokenY();
            console.log(chalk.gray(`✓ TokenX address: ${tokenXAddress}`));
            console.log(chalk.gray(`✓ TokenY address: ${tokenYAddress}`));
            
            console.log(chalk.gray("Loading token contracts..."));
            this.tokenX = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenXAddress, this.signer);
            this.tokenY = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenYAddress, this.signer);
            
            // Get token symbols and decimals
            const tokenXInfo = await this.formatTokenInfo(this.tokenX, "TokenX", true);
            const tokenYInfo = await this.formatTokenInfo(this.tokenY, "TokenY", true);
            console.log(chalk.gray(`✓ ${tokenXInfo}`));
            console.log(chalk.gray(`✓ ${tokenYInfo}`));
            
            console.log(chalk.green("\n✅ Contracts loaded successfully"));
        } catch (error) {
            console.error(chalk.red("\n❌ Failed to initialize:"), error);
            throw error;
        }
    }

    async question(prompt: string): Promise<string> {
        return new Promise((resolve) => {
            this.rl.question(chalk.yellow(prompt), (answer) => {
                resolve(answer);
            });
        });
    }

    async getTokenSymbol(token: IERC20MetadataUpgradeable): Promise<string> {
        try {
            return await token.symbol();
        } catch (e) {
            // Fallback - return shortened address
            const address = await token.getAddress();
            return `${address.slice(0, 6)}...${address.slice(-4)}`;
        }
    }

    async getTokenDecimals(token: IERC20MetadataUpgradeable): Promise<number> {
        try {
            return Number(await token.decimals());
        } catch (e) {
            return 18; // Default to 18 if we can't fetch
        }
    }

    async formatTokenInfo(token: IERC20MetadataUpgradeable | undefined, label: string, showAddress: boolean = false): Promise<string> {
        if (!token) return `${label}: NOT LOADED`;
        
        try {
            const symbol = await this.getTokenSymbol(token);
            if (showAddress) {
                const address = await token.getAddress();
                return `${label} (${symbol}): ${address}`;
            }
            return `${label} (${symbol})`;
        } catch (e) {
            return `${label}: ERROR`;
        }
    }

    async confirm(prompt: string): Promise<boolean> {
        const answer = await this.question(`${prompt} (y/n): `);
        return answer.toLowerCase() === 'y';
    }

    async showTokenAmountSuggestions() {
        if (!this.tokenX || !this.tokenY || !this.vault) return;
        
        try {
            const [symbolX, decimalsX, symbolY, decimalsY, totalSupply] = await Promise.all([
                this.getTokenSymbol(this.tokenX),
                this.getTokenDecimals(this.tokenX),
                this.getTokenSymbol(this.tokenY),
                this.getTokenDecimals(this.tokenY),
                this.vault.totalSupply()
            ]);
            
            const isFirstDeposit = totalSupply === 0n;
            
            console.log(chalk.gray(`Token X: ${symbolX} (${decimalsX} decimals)`));
            console.log(chalk.gray(`Token Y: ${symbolY} (${decimalsY} decimals)`));
            
            if (isFirstDeposit) {
                console.log(chalk.yellow("\n⚠️  FIRST DEPOSIT DETECTED!"));
                console.log(chalk.yellow("    1,000,000 shares will be locked in vault"));
                console.log(chalk.yellow("    You need to deposit value > $1 to receive shares\n"));
            }
            
            console.log(chalk.gray("Suggested amounts:"));
            
            // Helper to format amounts based on decimals
            const formatAmounts = (symbol: string, decimals: number, isUSDC: boolean) => {
                let amounts = [1, 0.1, 0.01];
                
                // For first deposit, suggest larger amounts
                if (isFirstDeposit) {
                    if (isUSDC) {
                        amounts = [100, 10, 1]; // $100, $10, $1 for USDC
                        console.log(chalk.green("    💡 Minimum $1 recommended for first deposit"));
                    } else {
                        amounts = [1, 0.1, 0.02]; // Adjust for other tokens
                    }
                }
                
                amounts.forEach(amount => {
                    const wei = BigInt(Math.floor(amount * (10 ** decimals)));
                    const label = isUSDC && isFirstDeposit ? `$${amount}` : `${amount} ${symbol}`;
                    console.log(chalk.gray(`  - ${label} = ${wei.toString()} wei`));
                });
            };
            
            console.log(chalk.gray("\nFor Token X:"));
            formatAmounts(symbolX, decimalsX, false);
            
            console.log(chalk.gray("\nFor Token Y:"));
            formatAmounts(symbolY, decimalsY, symbolY.toUpperCase() === "USDC");
            
            if (isFirstDeposit) {
                console.log(chalk.cyan("\n💡 Run 'npx hardhat run scripts/deposit-ratio-helper.ts' for optimal ratios"));
            }
            
            console.log("");
        } catch (e) {
            console.log(chalk.yellow("Could not fetch token information"));
        }
    }

    async captureState(): Promise<any> {
        try {
            const [balanceX, balanceY] = await this.vault!.getBalances();
            const totalSupply = await this.vault!.totalSupply();
            const userBalance = await this.vault!.balanceOf(this.signer.address);
            const [tokenXBalance, tokenYBalance] = await Promise.all([
                this.tokenX!.balanceOf(this.signer.address),
                this.tokenY!.balanceOf(this.signer.address)
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
            return null;
        }
    }

    async executeAction(
        actionName: string, 
        actionFn: () => Promise<any>, 
        params: any = {}
    ): Promise<TestResult> {
        const result: TestResult = {
            timestamp: Date.now(),
            action: actionName,
            params
        };

        try {
            // Capture state before
            result.stateBefore = await this.captureState();

            if (this.config.dryRun) {
                console.log(chalk.yellow("\n🔍 DRY RUN - Transaction not executed"));
                console.log(chalk.gray("Parameters:"), params);
                
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

            // Capture state after
            result.stateAfter = await this.captureState();
            
            // Show state changes
            if (result.stateBefore && result.stateAfter && !this.config.dryRun) {
                console.log(chalk.blue("\n📊 State Changes:"));
                this.showStateChanges(result.stateBefore, result.stateAfter);
            }

        } catch (error: any) {
            console.error(chalk.red("\n❌ Error:"), error.message || error);
            
            // Try to get more details about the revert
            if (error.reason) {
                console.error(chalk.red("Reason:"), error.reason);
            }
            if (error.data) {
                try {
                    const decodedError = this.vault?.interface.parseError(error.data);
                    if (decodedError) {
                        console.error(chalk.red("Decoded error:"), decodedError.name, decodedError.args);
                    }
                } catch (e) {
                    // Could not decode error
                }
            }
            
            result.error = error.message || error.toString();
        }

        this.results.push(result);
        return result;
    }

    showStateChanges(before: any, after: any) {
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

    async showVaultInfo() {
        console.log(chalk.blue("\n📊 Vault Information:\n"));
        
        try {
            // Basic info
            const name = await this.vault!.name();
            const symbol = await this.vault!.symbol();
            const decimals = await this.vault!.decimals();
            const version = await this.vault!.version();
            const vaultType = await this.vault!.getVaultType();
            const poolAddress = await this.pool!.getAddress();
            
            console.log(chalk.white("Basic Info:"));
            console.log(chalk.gray(`  Name: ${name}`));
            console.log(chalk.gray(`  Symbol: ${symbol}`));
            console.log(chalk.gray(`  Decimals: ${decimals}`));
            console.log(chalk.gray(`  Version: ${version}`));
            console.log(chalk.gray(`  Vault Type: ${vaultType}`));
            console.log(chalk.gray(`  Pool address: ${poolAddress}`));
            
            // State
            const isPaused = await this.vault!.isDepositsPaused();
            const isFlagged = await this.vault!.isFlaggedForShutdown();
            const totalSupply = await this.vault!.totalSupply();
            const [balanceX, balanceY] = await this.vault!.getBalances();
            const tick = (await this.pool!.slot0()).tick;
            const tickSpacing = await this.pool!.tickSpacing();
            
            console.log(chalk.white("\nState:"));
            console.log(chalk.gray(`  Deposits Paused: ${isPaused}`));
            console.log(chalk.gray(`  Is Flagged for Shutdown: ${isFlagged}`));
            console.log(chalk.gray(`  Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`));
            console.log(chalk.gray(`  Balance X: ${balanceX.toString()}`));
            console.log(chalk.gray(`  Balance Y: ${balanceY.toString()}`));
            console.log(chalk.gray(`  Current Pool Tick: ${tick.toString()}`));
            console.log(chalk.gray(`  Current Pool Tick Spacing: ${tickSpacing.toString()}`));
            
            // Oracle config
            const twapInterval = await this.vault!.getTwapInterval();
            console.log(chalk.white("\nOracle Configuration:"));
            console.log(chalk.gray(`  TWAP Interval: ${twapInterval} seconds`));
            
            // Price information
            if (this.priceHelper && this.pool) {
                try {
                    const tokenXDecimals = await this.getTokenDecimals(this.tokenX!);
                    const tokenYDecimals = await this.getTokenDecimals(this.tokenY!);
                    const tokenXSymbol = await this.getTokenSymbol(this.tokenX!);
                    const tokenYSymbol = await this.getTokenSymbol(this.tokenY!);
                    
                    // Get spot price (tokenX in terms of tokenY)
                    const spotPriceX = await this.priceHelper.getPoolSpotPrice(
                        await this.pool.getAddress(),
                        true,
                        tokenXDecimals,
                        tokenYDecimals
                    );
                    
                    // Get spot price (tokenY in terms of tokenX)
                    const spotPriceY = await this.priceHelper.getPoolSpotPrice(
                        await this.pool.getAddress(),
                        false,
                        tokenXDecimals,
                        tokenYDecimals
                    );
                    
                    // Format prices with appropriate decimals
                    const priceXFormatted = ethers.formatUnits(spotPriceX, tokenYDecimals);
                    const priceYFormatted = ethers.formatUnits(spotPriceY, tokenXDecimals);
                    
                    console.log(chalk.white("\nPrice Information:"));
                    console.log(chalk.gray(`  1 ${tokenXSymbol} = ${priceXFormatted} ${tokenYSymbol}`));
                    console.log(chalk.gray(`  1 ${tokenYSymbol} = ${priceYFormatted} ${tokenXSymbol}`));
                    
                    // If TWAP is configured, show TWAP price as well
                    if (twapInterval > 0) {
                        const twapPriceX = await this.priceHelper.getPoolTWAPPrice(
                            await this.pool.getAddress(),
                            true,
                            twapInterval,
                            tokenXDecimals,
                            tokenYDecimals
                        );
                        const twapPriceXFormatted = ethers.formatUnits(twapPriceX, tokenYDecimals);
                        console.log(chalk.gray(`  TWAP (${twapInterval}s): 1 ${tokenXSymbol} = ${twapPriceXFormatted} ${tokenYSymbol}`));
                    }
                } catch (e) {
                    console.log(chalk.yellow(`  Could not fetch price: ${e}`));
                }
            }
            
            // Strategy info
            const strategyAddress = await this.vault!.getStrategy();
            if (strategyAddress !== ethers.ZeroAddress) {
                const [defaultOp, operator] = await this.vault!.getOperators();
                const aumFee = await this.vault!.getAumAnnualFee();
                
                console.log(chalk.white("\nStrategy:"));
                console.log(chalk.gray(`  Address: ${strategyAddress}`));
                console.log(chalk.gray(`  Default Operator: ${defaultOp}`));
                console.log(chalk.gray(`  Operator: ${operator}`));
                console.log(chalk.gray(`  AUM Annual Fee: ${aumFee.toString()}`));
            }
            
            // Queue info
            const currentRound = await this.vault!.getCurrentRound();
            const totalQueued = await this.vault!.getCurrentTotalQueuedWithdrawal();
            
            console.log(chalk.white("\nQueue Info:"));
            console.log(chalk.gray(`  Current Round: ${currentRound}`));
            console.log(chalk.gray(`  Total Queued: ${ethers.formatUnits(totalQueued, decimals)}`));
            
        } catch (error) {
            console.error(chalk.red("Error fetching vault info:"), error);
        }
    }

    async showUserInfo() {
        console.log(chalk.blue("\n👤 User Information:\n"));
        
        try {
            const userAddress = this.signer.address;
            const shares = await this.vault!.balanceOf(userAddress);
            const decimals = await this.vault!.decimals();
            
            console.log(chalk.gray(`  Address: ${userAddress}`));
            console.log(chalk.gray(`  Shares: ${ethers.formatUnits(shares, decimals)}`));
            
            // Preview amounts
            if (shares > 0n) {
                const [amountX, amountY] = await this.vault!.previewAmounts(shares);
                console.log(chalk.gray(`  Value X: ${amountX.toString()}`));
                console.log(chalk.gray(`  Value Y: ${amountY.toString()}`));
            }
            
            // Token balances
            const [tokenXBal, tokenYBal] = await Promise.all([
                this.tokenX!.balanceOf(userAddress),
                this.tokenY!.balanceOf(userAddress)
            ]);
            console.log(chalk.gray(`  Token X Balance: ${tokenXBal.toString()}`));
            console.log(chalk.gray(`  Token Y Balance: ${tokenYBal.toString()}`));
            
            // Rewards
            const userInfo = await this.vault!.getUserInfo(userAddress);
            const pendingRewards = await this.vault!.getPendingRewards(userAddress);
            
            console.log(chalk.white("\nReward Info:"));
            console.log(chalk.gray(`  Phantom Amount: ${userInfo.phantomAmount.toString()}`));
            
            if (pendingRewards.length > 0) {
                console.log(chalk.white("\nPending Rewards:"));
                pendingRewards.forEach((reward: any) => {
                    console.log(chalk.gray(`  ${reward.token}: ${reward.pendingRewards.toString()}`));
                });
            }
            
        } catch (error) {
            console.error(chalk.red("Error fetching user info:"), error);
        }
    }

    async testDeposit() {
        console.log(chalk.blue("\n💰 Test Deposit\n"));
        
        // Show token info and suggested amounts
        await this.showTokenAmountSuggestions();
        
        const amountX = await this.question("Enter amount X (in wei): ");
        const amountY = await this.question("Enter amount Y (in wei): ");
        const minShares = await this.question("Enter minimum shares (in wei): ");
        
        const params = {
            amountX: BigInt(amountX || "0"),
            amountY: BigInt(amountY || "0"),
            minShares: BigInt(minShares || "0")
        };
        
        // Debug: Check if contracts are loaded
        console.log(chalk.gray("\nDebug info:"));
        console.log(chalk.gray(`  Vault: ${await this.vault?.getAddress() || 'NOT LOADED'}`));
        console.log(chalk.gray(`  ${await this.formatTokenInfo(this.tokenX, "TokenX")}`));
        console.log(chalk.gray(`  ${await this.formatTokenInfo(this.tokenY, "TokenY")}`));
        console.log(chalk.gray(`  Signer: ${this.signer?.address || 'NOT LOADED'}`));
        
        if (!this.vault || !this.tokenX || !this.tokenY) {
            console.error(chalk.red("\n❌ Contracts not properly loaded. Please restart."));
            return;
        }
        
        // Check allowances
        const [allowanceX, allowanceY] = await Promise.all([
            this.tokenX.allowance(this.signer.address, await this.vault.getAddress()),
            this.tokenY.allowance(this.signer.address, await this.vault.getAddress())
        ]);
        
        if (allowanceX < params.amountX || allowanceY < params.amountY) {
            console.log(chalk.yellow("\n⚠️  Insufficient allowance. Approving tokens..."));
            
            if (allowanceX < params.amountX) {
                await this.executeAction("Approve Token X", async () => {
                    return this.tokenX!.approve(await this.vault!.getAddress(), ethers.MaxUint256);
                });
            }
            
            if (allowanceY < params.amountY) {
                await this.executeAction("Approve Token Y", async () => {
                    return this.tokenY!.approve(await this.vault!.getAddress(), ethers.MaxUint256);
                });
            }
        }
        
        // Check some pre-conditions
        console.log(chalk.gray("\n📋 Pre-deposit checks:"));
        
        // Check if deposits are paused
        const isPaused = await this.vault.isDepositsPaused();
        console.log(chalk.gray(`  Deposits paused: ${isPaused}`));
        if (isPaused) {
            console.error(chalk.red("\n❌ Deposits are currently paused"));
            return;
        }
        
        // Check if strategy is set
        const strategyAddress = await this.vault.getStrategy();
        console.log(chalk.gray(`  Strategy: ${strategyAddress}`));
        if (strategyAddress === ethers.ZeroAddress) {
            console.error(chalk.red("\n❌ No strategy set on vault"));
            return;
        }
        
        // Check user balances
        const [balanceX, balanceY] = await Promise.all([
            this.tokenX.balanceOf(this.signer.address),
            this.tokenY.balanceOf(this.signer.address)
        ]);
        console.log(chalk.gray(`  User balance X: ${balanceX.toString()}`));
        console.log(chalk.gray(`  User balance Y: ${balanceY.toString()}`));
        
        if (params.amountX > balanceX || params.amountY > balanceY) {
            console.error(chalk.red("\n❌ Insufficient token balance"));
            return;
        }
        
        // Preview shares to see what we should get
        try {
            const [expectedShares, effectiveX, effectiveY] = await this.vault.previewShares(
                params.amountX,
                params.amountY
            );
            console.log(chalk.gray(`  Expected shares: ${expectedShares.toString()}`));
            console.log(chalk.gray(`  Effective X: ${effectiveX.toString()}`));
            console.log(chalk.gray(`  Effective Y: ${effectiveY.toString()}`));
            
            if (expectedShares === 0n && (params.amountX > 0n || params.amountY > 0n)) {
                console.error(chalk.red("\n❌ Deposit amount too small - would receive 0 shares"));
                
                const totalSupply = await this.vault.totalSupply();
                if (totalSupply === 0n) {
                    console.log(chalk.yellow("\n⚠️  This is the first deposit!"));
                    console.log(chalk.yellow("    You need to deposit value > $1 to overcome the penalty"));
                    console.log(chalk.yellow("    Try: 100 USDC (100000000 wei) or equivalent value"));
                } else {
                    console.log(chalk.yellow("\n💡 Try a larger amount. For USDC, try at least 1000000 wei (1 USDC)"));
                }
                return;
            }
        } catch (previewError) {
            console.error(chalk.red("  Failed to preview shares:"), previewError);
        }
        
        await this.executeAction("Deposit", async () => {
            return this.vault!.deposit(params.amountX, params.amountY, params.minShares);
        }, params);
    }

    async testQueueWithdrawal() {
        console.log(chalk.blue("\n🏦 Test Queue Withdrawal\n"));
        
        const shares = await this.question("Enter shares to withdraw (in wei): ");
        const recipient = await this.question("Enter recipient address (or press enter for self): ");
        
        const params = {
            shares: BigInt(shares || "0"),
            recipient: recipient || this.signer.address
        };
        
        await this.executeAction("Queue Withdrawal", async () => {
            return this.vault!.queueWithdrawal(params.shares, params.recipient);
        }, params);
    }

    async testRebalance() {
        console.log(chalk.blue("\n🔄 Test Rebalance\n"));
        
        const tickLower = await this.question("Enter tick lower: ");
        const tickUpper = await this.question("Enter tick upper: ");
        const desiredTick = await this.question("Enter desired tick: ");
        const slippageTick = await this.question("Enter slippage tick: ");
        
        const params = {
            tickLower: parseInt(tickLower),
            tickUpper: parseInt(tickUpper),
            desiredTick: parseInt(desiredTick),
            slippageTick: parseInt(slippageTick)
        };
        
        await this.executeAction("Rebalance", async () => {
            return this.strategy!.rebalance(
                params.tickLower,
                params.tickUpper,
                params.desiredTick,
                params.slippageTick
            );
        }, params);
    }

    async showTestScenarios() {
        console.log(chalk.blue("\n📋 Test Scenarios:\n"));
        console.log(chalk.gray("1. Basic Deposit & Withdraw"));
        console.log(chalk.gray("2. Deposit with Rebalance"));
        console.log(chalk.gray("3. Emergency Withdrawal"));
        console.log(chalk.gray("4. Reward Distribution"));
        console.log(chalk.gray("5. Multi-User Simulation"));
        console.log(chalk.gray("6. Gas Optimization Test"));
        console.log(chalk.gray("7. Edge Case Testing"));
        
        const choice = await this.question("\nSelect scenario (1-7): ");
        
        switch (choice) {
            case '1':
                await this.scenarioBasicFlow();
                break;
            case '2':
                await this.scenarioDepositWithRebalance();
                break;
            default:
                console.log(chalk.red("Scenario not implemented yet"));
        }
    }

    async scenarioBasicFlow() {
        console.log(chalk.blue("\n🎯 Running Basic Deposit & Withdraw Scenario\n"));
        
        if (!await this.confirm("This will perform deposit, queue withdrawal, and redeem. Continue?")) {
            return;
        }
        
        // Step 1: Deposit
        console.log(chalk.yellow("\nStep 1: Deposit"));
        const depositAmount = BigInt("1000000"); // 1 USDC
        await this.executeAction("Scenario: Deposit", async () => {
            return this.vault!.deposit(0, depositAmount, 0);
        });
        
        // Step 2: Queue Withdrawal
        console.log(chalk.yellow("\nStep 2: Queue Withdrawal"));
        const shares = await this.vault!.balanceOf(this.signer.address);
        const halfShares = shares / 2n;
        
        await this.executeAction("Scenario: Queue Withdrawal", async () => {
            return this.vault!.queueWithdrawal(halfShares, this.signer.address);
        });
        
        // Step 3: Execute queued withdrawals (requires operator)
        console.log(chalk.yellow("\nStep 3: Execute Queued Withdrawals"));
        console.log(chalk.gray("Note: This requires operator permissions"));
        
        // Step 4: Redeem
        console.log(chalk.yellow("\nStep 4: Redeem Withdrawal"));
        const currentRound = await this.vault!.getCurrentRound();
        if (currentRound > 0) {
            await this.executeAction("Scenario: Redeem", async () => {
                return this.vault!.redeemQueuedWithdrawal(currentRound - 1n, this.signer.address);
            });
        }
    }

    async scenarioDepositWithRebalance() {
        console.log(chalk.blue("\n🎯 Running Deposit with Rebalance Scenario\n"));
        
        if (!await this.confirm("This will deposit and trigger a rebalance. Continue?")) {
            return;
        }
        
        // Implementation pending...
        console.log(chalk.yellow("Scenario implementation pending..."));
    }

    async exportResults() {
        if (this.results.length === 0) {
            console.log(chalk.yellow("\nNo results to export"));
            return;
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `shadow-vault-test-${timestamp}.json`;
        const filepath = path.join(this.config.exportPath, filename);
        
        try {
            fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
            console.log(chalk.green(`\n✅ Results exported to: ${filepath}`));
        } catch (error) {
            console.error(chalk.red("Error exporting results:"), error);
        }
    }

    async showMainMenu() {
        console.log(chalk.blue("\n=== Shadow Vault Interactive Tester ===\n"));
        console.log(chalk.gray("1. View Vault Information"));
        console.log(chalk.gray("2. View User Information"));
        console.log(chalk.gray("3. Deposit Operations"));
        console.log(chalk.gray("4. Withdrawal Operations"));
        console.log(chalk.gray("5. Strategy Management"));
        console.log(chalk.gray("6. Reward Management"));
        console.log(chalk.gray("7. Admin Functions"));
        console.log(chalk.gray("8. Test Scenarios"));
        console.log(chalk.gray("9. Export Results"));
        console.log(chalk.gray("0. Exit"));
        
        return await this.question("\nSelect option: ");
    }

    async run() {
        try {
            await this.initialize();
        } catch (error) {
            console.error(chalk.red("\n❌ Failed to initialize. Exiting."));
            this.rl.close();
            return;
        }
        
        let running = true;
        while (running) {
            const choice = await this.showMainMenu();
            
            switch (choice) {
                case '1':
                    await this.showVaultInfo();
                    break;
                case '2':
                    await this.showUserInfo();
                    break;
                case '3':
                    await this.showDepositMenu();
                    break;
                case '4':
                    await this.showWithdrawalMenu();
                    break;
                case '5':
                    await this.showStrategyMenu();
                    break;
                case '6':
                    await this.showRewardMenu();
                    break;
                case '7':
                    await this.showAdminMenu();
                    break;
                case '8':
                    await this.showTestScenarios();
                    break;
                case '9':
                    await this.exportResults();
                    break;
                case '0':
                    running = false;
                    break;
                default:
                    console.log(chalk.red("Invalid option"));
            }
        }
        
        this.rl.close();
    }

    async showDepositMenu() {
        console.log(chalk.blue("\n💰 Deposit Operations\n"));
        console.log(chalk.gray("1. Regular Deposit"));
        console.log(chalk.gray("2. Native Deposit"));
        console.log(chalk.gray("3. Preview Shares"));
        console.log(chalk.gray("4. Back"));
        
        const choice = await this.question("\nSelect option: ");
        
        switch (choice) {
            case '1':
                await this.testDeposit();
                break;
            case '2':
                await this.testDepositNative();
                break;
            case '3':
                await this.previewShares();
                break;
        }
    }

    async showWithdrawalMenu() {
        console.log(chalk.blue("\n🏦 Withdrawal Operations\n"));
        console.log(chalk.gray("1. Queue Withdrawal"));
        console.log(chalk.gray("2. Cancel Queued Withdrawal"));
        console.log(chalk.gray("3. Redeem Withdrawal"));
        console.log(chalk.gray("4. Redeem Native"));
        console.log(chalk.gray("5. Emergency Withdraw"));
        console.log(chalk.gray("6. View Queue Status"));
        console.log(chalk.gray("7. Back"));
        
        const choice = await this.question("\nSelect option: ");
        
        switch (choice) {
            case '1':
                await this.testQueueWithdrawal();
                break;
            case '2':
                await this.testCancelQueuedWithdrawal();
                break;
            case '3':
                await this.testRedeemWithdrawal();
                break;
            case '6':
                await this.showQueueStatus();
                break;
        }
    }

    async showStrategyMenu() {
        console.log(chalk.blue("\n🔧 Strategy Management\n"));
        console.log(chalk.gray("1. View Strategy Info"));
        console.log(chalk.gray("2. Rebalance"));
        console.log(chalk.gray("3. Harvest Rewards"));
        console.log(chalk.gray("4. Set Operator"));
        console.log(chalk.gray("5. Back"));
        
        const choice = await this.question("\nSelect option: ");
        
        switch (choice) {
            case '1':
                await this.showStrategyInfo();
                break;
            case '2':
                await this.testRebalance();
                break;
            case '3':
                await this.testHarvestRewards();
                break;
        }
    }

    async showRewardMenu() {
        console.log(chalk.blue("\n🎁 Reward Management\n"));
        console.log(chalk.gray("1. View Pending Rewards"));
        console.log(chalk.gray("2. Update Rewards"));
        console.log(chalk.gray("3. Back"));
        
        const choice = await this.question("\nSelect option: ");
        
        switch (choice) {
            case '1':
                await this.showPendingRewards();
                break;
            case '2':
                await this.updateRewards();
                break;
        }
    }

    async showAdminMenu() {
        console.log(chalk.blue("\n🔐 Admin Functions\n"));
        console.log(chalk.gray("1. Pause/Resume Deposits"));
        console.log(chalk.gray("2. Set TWAP Interval"));
        console.log(chalk.gray("3. Submit/Cancel Shutdown"));
        console.log(chalk.gray("4. Emergency Mode"));
        console.log(chalk.gray("5. Recover ERC20"));
        console.log(chalk.gray("6. Back"));
        
        const choice = await this.question("\nSelect option: ");
        
        // Admin function implementations...
    }

    // Additional helper methods
    async testDepositNative() {
        console.log(chalk.blue("\n💰 Test Native Deposit\n"));
        console.log(chalk.yellow("Not implemented yet"));
    }

    async previewShares() {
        console.log(chalk.blue("\n🔍 Preview Shares\n"));
        
        // Show token info and suggested amounts
        await this.showTokenAmountSuggestions();
        
        const amountX = await this.question("Enter amount X (in wei): ");
        const amountY = await this.question("Enter amount Y (in wei): ");
        
        try {
            const [shares, effectiveX, effectiveY] = await this.vault!.previewShares(
                BigInt(amountX || "0"),
                BigInt(amountY || "0")
            );
            
            console.log(chalk.gray(`\n  Shares: ${shares.toString()}`));
            console.log(chalk.gray(`  Effective X: ${effectiveX.toString()}`));
            console.log(chalk.gray(`  Effective Y: ${effectiveY.toString()}`));
        } catch (error) {
            console.error(chalk.red("Error previewing shares:"), error);
        }
    }

    async testCancelQueuedWithdrawal() {
        console.log(chalk.blue("\n❌ Test Cancel Queued Withdrawal\n"));
        
        const shares = await this.question("Enter shares to cancel (in wei): ");
        
        await this.executeAction("Cancel Queued Withdrawal", async () => {
            return this.vault!.cancelQueuedWithdrawal(BigInt(shares || "0"));
        });
    }

    async testRedeemWithdrawal() {
        console.log(chalk.blue("\n💸 Test Redeem Withdrawal\n"));
        
        const round = await this.question("Enter round number: ");
        const recipient = await this.question("Enter recipient (or press enter for self): ");
        
        await this.executeAction("Redeem Withdrawal", async () => {
            return this.vault!.redeemQueuedWithdrawal(
                BigInt(round || "0"),
                recipient || this.signer.address
            );
        });
    }

    async showQueueStatus() {
        console.log(chalk.blue("\n📊 Queue Status\n"));
        
        try {
            const currentRound = await this.vault!.getCurrentRound();
            console.log(chalk.gray(`Current Round: ${currentRound}`));
            
            for (let i = 0; i <= Number(currentRound) && i < 5; i++) {
                const totalQueued = await this.vault!.getTotalQueuedWithdrawal(i);
                const userQueued = await this.vault!.getQueuedWithdrawal(i, this.signer.address);
                
                if (totalQueued > 0 || userQueued > 0) {
                    console.log(chalk.white(`\nRound ${i}:`));
                    console.log(chalk.gray(`  Total Queued: ${totalQueued.toString()}`));
                    console.log(chalk.gray(`  User Queued: ${userQueued.toString()}`));
                    
                    if (userQueued > 0) {
                        const [amountX, amountY] = await this.vault!.getRedeemableAmounts(i, this.signer.address);
                        console.log(chalk.gray(`  Redeemable X: ${amountX.toString()}`));
                        console.log(chalk.gray(`  Redeemable Y: ${amountY.toString()}`));
                    }
                }
            }
        } catch (error) {
            console.error(chalk.red("Error fetching queue status:"), error);
        }
    }

    async showStrategyInfo() {
        console.log(chalk.blue("\n📊 Strategy Information\n"));
        
        try {
            const [position, tickLower, tickUpper] = await this.strategy!.getPosition();
            const operator = await this.strategy!.getOperator();
            const lastRebalance = await this.strategy!.getLastRebalance();
            const [idleX, idleY] = await this.strategy!.getIdleBalances();
            
            console.log(chalk.white("Position:"));
            console.log(chalk.gray(`  Token ID: ${position.toString()}`));
            console.log(chalk.gray(`  Tick Lower: ${tickLower}`));
            console.log(chalk.gray(`  Tick Upper: ${tickUpper}`));
            
            console.log(chalk.white("\nManagement:"));
            console.log(chalk.gray(`  Operator: ${operator}`));
            console.log(chalk.gray(`  Last Rebalance: ${new Date(Number(lastRebalance) * 1000).toLocaleString()}`));
            
            console.log(chalk.white("\nIdle Balances:"));
            console.log(chalk.gray(`  Token X: ${idleX.toString()}`));
            console.log(chalk.gray(`  Token Y: ${idleY.toString()}`));
            
        } catch (error) {
            console.error(chalk.red("Error fetching strategy info:"), error);
        }
    }

    async testHarvestRewards() {
        console.log(chalk.blue("\n🌾 Test Harvest Rewards\n"));
        
        await this.executeAction("Harvest Rewards", async () => {
            return this.strategy!.harvestRewards();
        });
    }

    async showPendingRewards() {
        console.log(chalk.blue("\n🎁 Pending Rewards\n"));
        
        try {
            const pendingRewards = await this.vault!.getPendingRewards(this.signer.address);
            
            if (pendingRewards.length === 0) {
                console.log(chalk.gray("No pending rewards"));
            } else {
                pendingRewards.forEach((reward: any) => {
                    console.log(chalk.gray(`Token: ${reward.token}`));
                    console.log(chalk.gray(`Amount: ${reward.pendingRewards.toString()}`));
                });
            }
        } catch (error) {
            console.error(chalk.red("Error fetching pending rewards:"), error);
        }
    }

    async updateRewards() {
        console.log(chalk.blue("\n🔄 Update Rewards\n"));
        
        await this.executeAction("Update Rewards", async () => {
            return this.vault!.updateAccRewardsPerShare();
        });
    }
}

// Main function
async function main() {
    console.log(chalk.blue.bold("\n🚀 Shadow Vault Interactive Tester\n"));
    
    // Get network info
    console.log(chalk.gray(`Network: ${network.name}`));
    console.log(chalk.gray(`Chain ID: ${network.config.chainId}\n`));
    
    // Get signers
    const [signer] = await ethers.getSigners();
    console.log(chalk.gray(`Signer: ${signer.address}\n`));
    
    // Get vault address from command line argument or prompt user
    let vaultAddress = process.argv[2] || process.env.SHADOW_VAULT_ADDRESS;
    
    if (!vaultAddress) {
        // Create readline interface for user input
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        vaultAddress = await new Promise<string>((resolve) => {
            rl.question(chalk.yellow("Enter OracleRewardShadowVault address: "), (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
        
        if (!vaultAddress || !ethers.isAddress(vaultAddress)) {
            console.error(chalk.red("\n❌ Invalid vault address provided"));
            process.exit(1);
        }
    }
    
    console.log(chalk.gray(`Vault: ${vaultAddress}`));
    
    // Get strategy address from vault
    let strategyAddress: string;
    try {
        const vault = await ethers.getContractAt("OracleRewardShadowVault", vaultAddress, signer);
        strategyAddress = await vault.getStrategy();
        
        if (strategyAddress === ethers.ZeroAddress) {
            console.error(chalk.red("\n❌ No strategy set on vault"));
            process.exit(1);
        }
        
        console.log(chalk.gray(`Strategy: ${strategyAddress} (derived from vault)\n`));
    } catch (error) {
        console.error(chalk.red("\n❌ Failed to get strategy from vault:"), error);
        process.exit(1);
    }
    
    // Configuration
    const config: TestConfig = {
        vaultAddress,
        strategyAddress,
        signer,
        dryRun: false,
        exportPath: path.join(__dirname, "../test-results")
    };
    
    // Create export directory if it doesn't exist
    if (!fs.existsSync(config.exportPath)) {
        fs.mkdirSync(config.exportPath, { recursive: true });
    }
    
    // Create and run tester
    const tester = new ShadowVaultTester(config);
    await tester.run();
    
    console.log(chalk.green("\n✅ Testing complete!\n"));
}

// Run the script
if (require.main === module) {
    main().catch((error) => {
        console.error(chalk.red("\n❌ Fatal error:"), error);
        process.exit(1);
    });
}

export { ShadowVaultTester, TestConfig };