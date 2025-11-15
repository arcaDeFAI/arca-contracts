import { ethers, network } from "hardhat";
import readline from "readline";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import type {
    OracleRewardShadowVault,
    ShadowStrategy,
    IRamsesV3Pool,
    ShadowPriceHelperWrapper,
    IVaultFactory
} from "../typechain-types";
import type { IERC20MetadataUpgradeable } from "../typechain-types/@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type {
    TestResult,
    VaultState
} from "./test-vault-utils";
import {
    TestConfig,
    TestResultManager,
    formatters,
    getTokenSymbol,
    getTokenDecimals,
    captureVaultState,
    executeWithCapture,
    ui,
    checkAndApproveTokens,
    validateDeposit,
    estimateTokensFromShares,
    calculateOptimalRatio,
    displayVisualRange,
    tickToPrice,
    calculateDefaultTickRange,
    calculateOptimalDepositAmountsShadow,
    displayStrategyAllocation,
    parseTokenAmount,
    parseShareAmount,
    clearReadlineBuffer,
    formatPercent,
    parseTick,
    promptWithDefault,
    checkEmergencyMode,
    validateEmergencyWithdraw,
    displayEmergencyStatus,
    estimateEmergencyWithdrawal
} from "./test-vault-utils";
import {
    discoverTokensInVault,
    selectToken,
    getRecoveryAmount,
    getRecipientAddress,
    displayRecoveryPreview,
    validateRecovery,
    executeRecovery,
    type TokenInfo
} from "./vault-recovery-utils";
import type { ContractTransactionResponse } from "ethers";

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
    private resultManager: TestResultManager;
    private isEmergencyMode: boolean = false;

    constructor(config: TestConfig) {
        this.config = config;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.signer = config.signer!;
        this.resultManager = new TestResultManager();
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
            if (this.config.strategyAddress && this.config.strategyAddress !== ethers.ZeroAddress) {
                this.strategy = await ethers.getContractAt("ShadowStrategy", this.config.strategyAddress, this.signer);
                console.log(chalk.gray(`✓ Strategy loaded at: ${await this.strategy.getAddress()}`));
                this.isEmergencyMode = false;
            } else {
                console.log(chalk.yellow(`⚠️  Strategy is null address - vault is in emergency mode`));
                this.strategy = undefined;
                this.isEmergencyMode = true;
            }
            
            // Get associated contracts
            console.log(chalk.gray("Getting pool address..."));
            const poolAddress = await this.vault.getPool();
            console.log(chalk.gray(`✓ Pool address: ${poolAddress}`));
            
            console.log(chalk.gray("Loading pool contract..."));
            this.pool = await ethers.getContractAt("IRamsesV3Pool", poolAddress, this.signer);

            console.log(chalk.gray("Getting Vault Factory contract..."));
            const vaultFactoryAddress = await this.vault.getFactory();
            console.log(chalk.gray(`✓ Vault Factory address: ${vaultFactoryAddress}`));
            
            console.log(chalk.gray("Getting token addresses..."));
            const tokenXAddress = await this.vault.getTokenX();
            const tokenYAddress = await this.vault.getTokenY();
            console.log(chalk.gray(`✓ TokenX address: ${tokenXAddress}`));
            console.log(chalk.gray(`✓ TokenY address: ${tokenYAddress}`));
            
            console.log(chalk.gray("Loading token contracts..."));
            this.tokenX = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenXAddress, this.signer);
            this.tokenY = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenYAddress, this.signer);
            
            // Get token symbols and decimals
            const tokenXInfo = await formatters.tokenInfoWithAddress(this.tokenX, "TokenX");
            const tokenYInfo = await formatters.tokenInfoWithAddress(this.tokenY, "TokenY");
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

    async questionWithDefault(prompt: string, defaultValue: string, formatDefault?: string): Promise<string> {
        const formattedDefault = formatDefault || defaultValue;
        const fullPrompt = `${prompt} [${chalk.gray(formattedDefault)}]: `;
        
        return new Promise((resolve) => {
            this.rl.question(chalk.yellow(fullPrompt), (answer) => {
                resolve(answer.trim() || defaultValue);
            });
        });
    }

    async confirm(prompt: string): Promise<boolean> {
        const answer = await this.question(`${prompt} (y/n): `);
        return answer.toLowerCase() === 'y';
    }

    async showTokenAmountSuggestions() {
        if (!this.tokenX || !this.tokenY || !this.vault) return;
        
        const totalSupply = await this.vault.totalSupply();
        const isFirstDeposit = totalSupply === 0n;
        
        await ui.showTokenAmountSuggestions(this.tokenX, this.tokenY, isFirstDeposit);
    }

    async captureState(): Promise<VaultState | null> {
        try {
            return await captureVaultState(this.vault!, this.tokenX!, this.tokenY!, this.signer.address);
        } catch (error) {
            console.error(chalk.red("Error capturing state:"), error);
            return null;
        }
    }

    async executeAction(
        actionName: string, 
        actionFn: () => Promise<ContractTransactionResponse>
    ): Promise<TestResult> {
        const result = await executeWithCapture(actionName, actionFn, {
            signer: this.signer,
            dryRun: this.config.dryRun,
            vault: this.vault,
            captureState: () => this.captureState()
        });
        
        this.resultManager.captureResult(result);
        return result;
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
            const rawBalanceX = await this.checkTokenBalance(await this.vault!.getTokenX(), await this.vault!.getAddress());
            const rawBalanceY = await this.checkTokenBalance(await this.vault!.getTokenY(), await this.vault!.getAddress());
            
            console.log(chalk.white("\nState:"));
            console.log(chalk.gray(`  Deposits Paused: ${isPaused}`));
            console.log(chalk.gray(`  Is Flagged for Shutdown: ${isFlagged}`));
            console.log(chalk.gray(`  Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`));
            console.log(chalk.gray(`  Balance X: ${await formatters.formatBalance(balanceX, this.tokenX!)}`));
            console.log(chalk.gray(`  Balance Y: ${await formatters.formatBalance(balanceY, this.tokenY!)}`));
            console.log(chalk.gray(`  Raw Balance X: ${await formatters.formatBalance(rawBalanceX, this.tokenX!)}`));
            console.log(chalk.gray(`  Raw Balance Y: ${await formatters.formatBalance(rawBalanceY, this.tokenY!)}`));
            console.log(chalk.gray(`  Current Pool Tick: ${tick.toString()}`));
            console.log(chalk.gray(`  Current Pool Tick Spacing: ${tickSpacing.toString()}`));
            
            // Oracle config
            const twapInterval = await this.vault!.getTwapInterval();
            console.log(chalk.white("\nOracle Configuration:"));
            console.log(chalk.gray(`  TWAP Interval: ${twapInterval} seconds`));
            
            // Price information
            if (this.priceHelper && this.pool) {
                try {
                    const tokenXDecimals = await getTokenDecimals(this.tokenX!);
                    const tokenYDecimals = await getTokenDecimals(this.tokenY!);
                    const tokenXSymbol = await getTokenSymbol(this.tokenX!);
                    const tokenYSymbol = await getTokenSymbol(this.tokenY!);
                    
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
                console.log(chalk.gray(`  AUM Annual Fee: ${aumFee.toString()} basis points`));
            } else {
                console.log(chalk.red("\n🚨 Emergency Mode:"));
                console.log(chalk.red(`  Strategy: ${strategyAddress} (null)`));
                console.log(chalk.red(`  Status: Vault is in emergency mode`));
                console.log(chalk.red(`  Available: Emergency withdraw and token recovery only`));
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
                console.log(chalk.gray(`  Value X: ${await formatters.formatBalance(amountX, this.tokenX!)}`));
                console.log(chalk.gray(`  Value Y: ${await formatters.formatBalance(amountY, this.tokenY!)}`));
            }
            
            // Token balances
            const [tokenXBal, tokenYBal] = await Promise.all([
                this.tokenX!.balanceOf(userAddress),
                this.tokenY!.balanceOf(userAddress)
            ]);
            console.log(chalk.gray(`  Token X Balance: ${await formatters.formatBalance(tokenXBal, this.tokenX!)}`));
            console.log(chalk.gray(`  Token Y Balance: ${await formatters.formatBalance(tokenYBal, this.tokenY!)}`));
            
            // Rewards
            const userInfo = await this.vault!.getUserInfo(userAddress);
            const pendingRewards = await this.vault!.getPendingRewards(userAddress);
            
            console.log(chalk.white("\nReward Info:"));
            console.log(chalk.gray(`  Phantom Amount: ${formatters.formatShareAmount(userInfo.phantomAmount, Number(decimals))}`));
            
            if (pendingRewards.length > 0) {
                console.log(chalk.white("\nPending Rewards:"));
                for (const reward of pendingRewards) {
                    const formatted = await formatters.formatRewardAmount(reward.pendingRewards, reward.token, this.signer);
                    console.log(chalk.gray(`  ${formatted}`));
                }
            }
            
        } catch (error) {
            console.error(chalk.red("Error fetching user info:"), error);
        }
    }

    async testDeposit() {
        console.log(chalk.blue("\n💰 Test Deposit\n"));
        
        // Show optimal deposit ratio
        const ratio = await calculateOptimalRatio(this.vault!, this.tokenX!, this.tokenY!);
        console.log(chalk.cyan(`\n💡 ${ratio.message}`));
        console.log(chalk.gray(`   Optimal ratio: ${ratio.ratioX}% Token X / ${ratio.ratioY}% Token Y\n`));
        
        // Show token info and suggested amounts
        await this.showTokenAmountSuggestions();
        
        // Get token decimals and symbols for parsing
        const [decimalsX, decimalsY, symbolX, symbolY] = await Promise.all([
            getTokenDecimals(this.tokenX!),
            getTokenDecimals(this.tokenY!),
            getTokenSymbol(this.tokenX!),
            getTokenSymbol(this.tokenY!)
        ]);
        
        // Parse amount X with validation
        const amountXStr = await this.question("Enter amount X (e.g., '1000000' wei): ");
        const parsedX = BigInt(amountXStr);
        
        // Parse amount Y with validation
        const amountYStr = await this.question("Enter amount Y (e.g., '100000' wei): ");
        const parsedY = BigInt(amountYStr);

        // Parse minimum shares
        const vaultDecimals = Number(await this.vault!.decimals());
        const minSharesStr = await this.question("Enter minimum shares (or 0 for no minimum): ");
        const parsedShares = parseTokenAmount(minSharesStr || "0", vaultDecimals);
        
        const params = {
            amountX: parsedX!,
            amountY: parsedY!,
            minShares: parsedShares.value || 0n
        };
        
        // Debug: Check if contracts are loaded
        console.log(chalk.gray("\nDebug info:"));
        console.log(chalk.gray(`  Vault: ${await this.vault?.getAddress() || 'NOT LOADED'}`));
        console.log(chalk.gray(`  ${await formatters.tokenInfo(this.tokenX, "TokenX")}`));
        console.log(chalk.gray(`  ${await formatters.tokenInfo(this.tokenY, "TokenY")}`));
        console.log(chalk.gray(`  Signer: ${this.signer?.address || 'NOT LOADED'}`));
        
        if (!this.vault || !this.tokenX || !this.tokenY) {
            console.error(chalk.red("\n❌ Contracts not properly loaded. Please restart."));
            return;
        }
        
        // Check and approve tokens
        await checkAndApproveTokens(
            this.tokenX!,
            this.tokenY!,
            await this.vault!.getAddress(),
            params.amountX,
            params.amountY,
            this.signer,
            (name, fn) => this.executeAction(name, fn)
        );
        
        // Validate deposit
        const isValid = await validateDeposit(
            this.vault!,
            this.tokenX!,
            this.tokenY!,
            params.amountX,
            params.amountY,
            this.signer
        );
        
        if (!isValid) {
            return;
        }
        
        await this.executeAction("Deposit", async () => {
            return this.vault!.deposit(params.amountX, params.amountY, params.minShares);
        });
    }

    async testQueueWithdrawal() {
        console.log(chalk.blue("\n🏦 Test Queue Withdrawal\n"));
        
        // Show withdrawal context with balance and suggestions
        await ui.showShareWithdrawalContext(this.vault!, this.signer, this.tokenX!, this.tokenY!);
        
        const sharesInput = await this.questionWithDefault("Enter the amount of shares to withdraw (in wei or as a percentage)", "100%", "100%")
        const recipient = await this.question("Enter recipient address (or press enter for self): ");
        
        // Get available shares for percentage/max calculations
        const totalShares = await this.vault!.balanceOf(this.signer.address);
        const currentRound = await this.vault!.getCurrentRound();
        let totalQueued = 0n;
        for (let i = 0; i <= Number(currentRound); i++) {
            const queued = await this.vault!.getQueuedWithdrawal(i, this.signer.address);
            totalQueued += queued;
        }
        const availableShares = totalShares - totalQueued;
        
        // Parse shares input with proper decimal handling
        const decimals = Number(await this.vault!.decimals());
        const parsed = parseShareAmount(sharesInput, decimals, availableShares);
        
        if (!parsed.success) {
            console.log(chalk.red(`\n❌ ${parsed.error}`));
            console.log(chalk.yellow("Valid formats: '1.5', '50%', 'max', or amount in wei"));
            return;
        }
        
        const shares = parsed.value!;
        
        const params = {
            shares,
            recipient: recipient || this.signer.address
        };
        
        // Check if shares is 0
        if (shares === 0n) {
            console.log(chalk.red("\n❌ Cannot queue 0 shares"));
            return;
        }
        
        // Preview what they will receive
        const { amountX, amountY } = await estimateTokensFromShares(this.vault!, shares);
        console.log(chalk.cyan("\nPreview: You will receive approximately:"));
        console.log(chalk.gray(`  - ${await formatters.formatBalance(amountX, this.tokenX!)}`));
        console.log(chalk.gray(`  - ${await formatters.formatBalance(amountY, this.tokenY!)}`));
        
        if (!await this.confirm("\nContinue with withdrawal?")) {
            console.log(chalk.yellow("Withdrawal cancelled"));
            return;
        }
        
        await this.executeAction("Queue Withdrawal", async () => {
            return this.vault!.queueWithdrawal(params.shares, params.recipient);
        });
    }

    async testEmergencyWithdraw() {
        console.log(chalk.blue("\n🚨 Emergency Withdraw\n"));
        
        // Check emergency status
        await displayEmergencyStatus(this.vault!);
        
        // Validate emergency withdraw
        const validation = await validateEmergencyWithdraw(this.vault!, this.signer);
        if (!validation.valid) {
            console.log(chalk.red(`\n❌ ${validation.message}`));
            return;
        }
        
        const shares = validation.shares!;
        const decimals = Number(await this.vault!.decimals());
        
        console.log(chalk.cyan("\n📊 Your Position:"));
        console.log(chalk.gray(`  Shares: ${formatters.formatShareAmount(shares, decimals)}`));
        
        // Estimate what user will receive
        const { amountX, amountY } = await estimateEmergencyWithdrawal(
            this.vault!,
            shares,
            this.tokenX!,
            this.tokenY!
        );
        
        console.log(chalk.cyan("\n💰 You will receive (estimated):"));
        console.log(chalk.gray(`  Token X: ${await formatters.formatBalance(amountX, this.tokenX!)}`));
        console.log(chalk.gray(`  Token Y: ${await formatters.formatBalance(amountY, this.tokenY!)}`));
        
        console.log(chalk.red("\n⚠️  WARNING:"));
        console.log(chalk.red("• This will burn ALL your shares"));
        console.log(chalk.red("• No rewards will be paid out"));
        console.log(chalk.red("• This action cannot be undone"));
        
        const confirmed = await this.confirm("\nProceed with emergency withdrawal?");
        if (!confirmed) {
            console.log(chalk.yellow("Emergency withdrawal cancelled"));
            return;
        }
        
        await this.executeAction("Emergency Withdraw", async () => {
            return this.vault!.emergencyWithdraw();
        });
    }

    async testRedeemNative() {
        console.log(chalk.blue("\n💸 Redeem Native\n"));
        
        // Get current round for information
        const currentRound = await this.vault!.getCurrentRound();
        console.log(chalk.gray(`Current round: ${currentRound}`));
        const defaultRound = String(currentRound - 1n < 0 ? 0 : currentRound - 1n );
        const selectedRoundStr = await this.questionWithDefault("Enter round number: ", defaultRound, defaultRound);
        const selectedRound : bigint = BigInt(selectedRoundStr);

        const recipient = (await this.question("Enter recipient (or press enter for self): ")) || this.signer.address;
        
        // Check for available withdrawals
        const [availableAmountX, availableAmountY] = await this.vault!.getRedeemableAmounts(selectedRound, recipient);
        
        if (availableAmountX === 0n && availableAmountY === 0n) {
            console.log(chalk.yellow("\n⚠️  No available withdrawals to redeem"));
            console.log(chalk.gray("You need to have a processed withdrawal from a previous round"));
            return;
        }
        
        console.log(chalk.cyan("\n💰 Available to Redeem:"));
        console.log(chalk.gray(`  Token X: ${await formatters.formatBalance(availableAmountX, this.tokenX!)}`));
        console.log(chalk.gray(`  Token Y: ${await formatters.formatBalance(availableAmountY, this.tokenY!)}`));
        
        console.log(chalk.yellow("\n💡 This will convert wS (wrapped Sonic) to native S"));
        
        if (!await this.confirm("\nProceed with native redemption?")) {
            console.log(chalk.yellow("Redemption cancelled"));
            return;
        }
        
        await this.executeAction("Redeem Native", async () => {
            return this.vault!.redeemQueuedWithdrawalNative(selectedRound, recipient);
        });
    }

    async testCancelQueuedWithdrawal() {
        console.log(chalk.blue("\n❌ Cancel Queued Withdrawal\n"));
        
        // Get current round and check if user has queued withdrawals
        const currentRound = await this.vault!.getCurrentRound();
        const queuedShares = await this.vault!.getQueuedWithdrawal(currentRound, this.signer.address);
        
        if (queuedShares === 0n) {
            console.log(chalk.yellow("\n⚠️  You have no queued withdrawals in the current round"));
            return;
        }
        
        const decimals = Number(await this.vault!.decimals());
        console.log(chalk.cyan("\n📊 Queued Withdrawal:"));
        console.log(chalk.gray(`  Round: ${currentRound}`));
        console.log(chalk.gray(`  Shares: ${formatters.formatShareAmount(queuedShares, decimals)}`));
        
        // Estimate what they would have received
        const { amountX, amountY } = await estimateTokensFromShares(this.vault!, queuedShares);
        console.log(chalk.gray(`  Est. Token X: ${await formatters.formatBalance(amountX, this.tokenX!)}`));
        console.log(chalk.gray(`  Est. Token Y: ${await formatters.formatBalance(amountY, this.tokenY!)}`));
        
        if (!await this.confirm("\nCancel this withdrawal?")) {
            console.log(chalk.yellow("Cancellation aborted"));
            return;
        }
        
        await this.executeAction("Cancel Queued Withdrawal", async () => {
            return this.vault!.cancelQueuedWithdrawal(queuedShares);
        });
    }

    async testRedeemWithdrawal() {
        console.log(chalk.blue("\n💰 Redeem Withdrawal\n"));

        // Get current round for information
        const currentRound = await this.vault!.getCurrentRound();
        console.log(chalk.gray(`Current round: ${currentRound}`));
        const defaultRound = String(currentRound - 1n < 0 ? 0 : currentRound - 1n );
        const selectedRoundStr = await this.questionWithDefault("Enter round number: ", defaultRound, defaultRound);
        const selectedRound : bigint = BigInt(selectedRoundStr);

        let recipient = await this.question("Enter recipient (or press enter for self): ");
        
        if (!recipient) {
            recipient = this.signer.address;
        }
        
        // Check for available withdrawals
        const [availableAmountX, availableAmountY] = await this.vault!.getRedeemableAmounts(selectedRound, recipient);
        
        if (availableAmountX === 0n && availableAmountY === 0n) {
            console.log(chalk.yellow("\n⚠️  No available withdrawals to redeem"));
            console.log(chalk.gray("You need to have a processed withdrawal from a previous round"));
            return;
        }
        
        console.log(chalk.cyan("\n💰 Available to Redeem:"));
        console.log(chalk.gray(`  Token X: ${await formatters.formatBalance(availableAmountX, this.tokenX!)}`));
        console.log(chalk.gray(`  Token Y: ${await formatters.formatBalance(availableAmountY, this.tokenY!)}`));
        
        if (!await this.confirm("\nProceed with redemption?")) {
            console.log(chalk.yellow("Redemption cancelled"));
            return;
        }

        await this.executeAction("Redeem Withdrawal", async () => {
            return this.vault!.redeemQueuedWithdrawal(selectedRound, recipient);
        });
    }

    async testRebalance() {
        console.log(chalk.blue("\n🔄 Test Rebalance\n"));

        if (this.isEmergencyMode || !this.strategy) {
            console.log(chalk.red("❌ Rebalance not available in emergency mode"));
            console.log(chalk.yellow("💡 Strategy operations are disabled when vault is in emergency mode"));
            return;
        }

        // Show current pool state
        try {
            const slot0 = await this.pool!.slot0();
            const currentTick = slot0[1];
            const tickSpacing = await this.pool!.tickSpacing();
            console.log(chalk.gray(`Current Pool Tick: ${currentTick}, tick spacing: ${tickSpacing}`));

            // Try to get current position if any
            const [positionTokenId, tickLower, tickUpper] = await this.strategy.getPosition();
            if (positionTokenId && positionTokenId !== 0n) {
                console.log(chalk.gray(`Current Position Token ID: ${positionTokenId}`));
                console.log(chalk.gray(`Current Position Range: [${tickLower}, ${tickUpper}]`));
            }

            // Show current idle balances to help operator decide reserve amounts
            const [idleX, idleY] = await this.strategy.getIdleBalances();
            console.log(chalk.cyan("\n💰 Current Idle Balances (available for deposit):"));
            console.log(chalk.gray(`  Token X: ${await formatters.formatBalance(idleX, this.tokenX!)}`));
            console.log(chalk.gray(`  Token Y: ${await formatters.formatBalance(idleY, this.tokenY!)}`));
            console.log(chalk.yellow("\n💡 Tip: Specify amounts to deposit. Remaining will be kept as reserves."));
            console.log(chalk.yellow("   Enter the amounts in wei. At least one must be non-zero.\n"));
        } catch (e) {
            console.log(chalk.gray("Could not fetch current pool state"));
            console.log(e);
            throw e;
        }
        
        // Calculate smart defaults
        const slot0 = await this.pool!.slot0();
        const currentTick = Number(slot0[1]);
        const tickSpacing = Number(await this.pool!.tickSpacing());

        // Get current strategy balances for amount defaults
        const [balanceX, balanceY] = await this.strategy.getBalances();

        // Default tick range: ±5% around current tick (considers tick spacing)
        const defaultRange = calculateDefaultTickRange(currentTick, tickSpacing, 5);

        // Get user inputs with defaults (strings)
        const tickLowerStr = await this.questionWithDefault(
        "Enter tick lower",
        defaultRange.lower.toString(),
        `${defaultRange.lower} (~5% below current)`
        );
        const tickUpperStr = await this.questionWithDefault(
        "Enter tick upper",
        defaultRange.upper.toString(),
        `${defaultRange.upper} (~5% above current)`
        );
        const desiredTickStr = await this.questionWithDefault(
        "Enter desired tick",
        currentTick.toString(),
        `${currentTick} (current)`
        );
        const slippageTickStr = await this.questionWithDefault(
        "Enter slippage tick",
        "100",
        "100 (standard slippage)"
        );

        // Parse once
        const tickLower = parseTick(tickLowerStr, "tick lower");
        const tickUpper = parseTick(tickUpperStr, "tick upper");
        const desiredTick = parseTick(desiredTickStr, "desired tick");
        const slippageTick = parseTick(slippageTickStr, "slippage tick");

        // Validate range & spacing
        if (tickLower >= tickUpper) {
            throw new Error(`tick lower (${tickLower}) must be < tick upper (${tickUpper})`);
        }

        if ((tickLower - currentTick) % tickSpacing !== 0 || (tickUpper - currentTick) % tickSpacing !== 0) {
            console.warn(`⚠️  Ticks are not aligned to spacing ${tickSpacing}. Proceeding, but consider snapping to spacing.`);
        }

        // Prices from the user's ticks
        const lowerPrice = tickToPrice(tickLower);
        const upperPrice = tickToPrice(tickUpper);
        const currentPrice = tickToPrice(currentTick);

        // Default amounts: aim for 90% of available (keeping 10% as reserve)
        const defaultAmounts = calculateOptimalDepositAmountsShadow(
            balanceX,
            balanceY,
            10, // keep 10% reserves
            currentPrice,
            lowerPrice,
            upperPrice
        );

        // Show amount suggestions
        if (balanceX > 0n || balanceY > 0n) {
        console.log(chalk.cyan("\n💡 Suggested amounts (90% of available, 10% reserve, CL ratio-aware):"));
        console.log(
            chalk.gray(
            `  Token X: ${defaultAmounts.amountX} wei (reserve: ${defaultAmounts.reserveX} wei, ` +
            `${formatPercent(defaultAmounts.amountX, balanceX)} of available)`
            )
        );
        console.log(
            chalk.gray(
            `  Token Y: ${defaultAmounts.amountY} wei (reserve: ${defaultAmounts.reserveY} wei, ` +
            `${formatPercent(defaultAmounts.amountY, balanceY)} of available)`
            )
        );
        }

        const amountX = await this.questionWithDefault(
            "Enter amount X to deposit (in wei)",
            defaultAmounts.amountX.toString(),
            `${defaultAmounts.amountX} (${formatPercent(defaultAmounts.amountX, balanceX)} of available)`
        );
        const amountY = await this.questionWithDefault(
            "Enter amount Y to deposit (in wei)",
            defaultAmounts.amountY.toString(),
            `${defaultAmounts.amountY} (${formatPercent(defaultAmounts.amountY, balanceY)} of available)`
        );
        
        const params = {
            tickLower: tickLower,
            tickUpper: tickUpper,
            desiredTick: desiredTick,
            slippageTick: slippageTick,
            amountX: BigInt(amountX || "0"),
            amountY: BigInt(amountY || "0")
        };
        
        // Check if amounts exceed available balance and warn
        if (params.amountX > balanceX) {
            console.log(chalk.yellow(`\n⚠️  Warning: Amount X (${params.amountX}) exceeds available balance (${balanceX})`));
            console.log(chalk.yellow(`   Will be capped at: ${await formatters.formatBalance(balanceX, this.tokenX!)}`));
            params.amountX = balanceX; // Update for display
        }
        if (params.amountY > balanceY) {
            console.log(chalk.yellow(`\n⚠️  Warning: Amount Y (${params.amountY}) exceeds available balance (${balanceY})`));
            console.log(chalk.yellow(`   Will be capped at: ${await formatters.formatBalance(balanceY, this.tokenY!)}`));
            params.amountY = balanceY; // Update for display
        }
        
        // Show visual range
        const displayTick = desiredTick;
        displayVisualRange(params.tickLower, params.tickUpper, displayTick, "tick");
        
        // Show deposit summary with reserve calculation
        console.log(chalk.cyan("\n📊 Deposit Summary:"));
        console.log(chalk.gray(`  Amount X to deposit: ${await formatters.formatBalance(params.amountX, this.tokenX!)}`));
        console.log(chalk.gray(`  Amount Y to deposit: ${await formatters.formatBalance(params.amountY, this.tokenY!)}`));
        
        const reserveX = balanceX - params.amountX;
        const reserveY = balanceY - params.amountY;
        if (reserveX > 0n || reserveY > 0n) {
            console.log(chalk.yellow("\n  Remaining as Reserves:"));
            if (reserveX > 0n) {
                console.log(chalk.gray(`    Token X: ${await formatters.formatBalance(reserveX, this.tokenX!)}`));
            }
            if (reserveY > 0n) {
                console.log(chalk.gray(`    Token Y: ${await formatters.formatBalance(reserveY, this.tokenY!)}`));
            }
        }
        try {
            await this.executeAction("Rebalance", async () => {
                return this.strategy!.rebalance(
                    params.tickLower,
                    params.tickUpper,
                    params.desiredTick,
                    params.slippageTick,
                    params.amountX,
                    params.amountY,
                    {
                       gasLimit: 10_000_000n
                    }
                );
            });
        } catch (error) {
            console.error(chalk.red("Error during rebalance:"), error);
        }
    }

    async showTestScenarios() {
        console.log(chalk.blue("\n📋 Test Scenarios:\n"));

        if (this.isEmergencyMode) {
            console.log(chalk.red("❌ Test scenarios not available in emergency mode"));
            console.log(chalk.yellow("💡 Most scenarios require strategy operations which are disabled"));
            console.log(chalk.yellow("Available: Emergency withdrawal scenario"));
            return;
        }

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
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `shadow-vault-test-${timestamp}.json`;
        const filepath = path.join(this.config.exportPath, filename);
        
        await this.resultManager.exportToFile(filepath);
    }

    async showMainMenu() {
        console.log(chalk.blue("\n=== Shadow Vault Interactive Tester ===\n"));

        if (this.isEmergencyMode) {
            console.log(chalk.red("🚨 EMERGENCY MODE ACTIVE 🚨"));
            console.log(chalk.yellow("Strategy operations are disabled. Limited functionality available.\n"));
        }

        console.log(chalk.gray("1. View Vault Information"));
        console.log(chalk.gray("2. View User Information"));
        console.log(chalk.gray("3. Deposit Operations"));
        console.log(chalk.gray("4. Withdrawal Operations"));
        console.log(this.isEmergencyMode ? chalk.gray("5. Strategy Management (DISABLED)") : chalk.gray("5. Strategy Management"));
        console.log(chalk.gray("6. Reward Management"));
        console.log(chalk.gray("7. Admin Functions"));
        console.log(this.isEmergencyMode ? chalk.gray("8. Test Scenarios (DISABLED)") : chalk.gray("8. Test Scenarios"));
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
            try {
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
                        if (choice.trim() !== '') {
                            console.log(chalk.red("Invalid option"));
                        }
                        // Clear any buffered input
                        clearReadlineBuffer(this.rl);
                }
            } catch (error) {
                console.error(chalk.red("\n❌ An error occurred:"), error);
                console.log(chalk.yellow("\nPress Enter to continue..."));
                await this.question("");
                clearReadlineBuffer(this.rl);
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
            case '4':
                await this.testRedeemNative();
                break;
            case '5':
                await this.testEmergencyWithdraw();
                break;
            case '6':
                await this.showQueueStatus();
                break;
        }
    }

    async showStrategyMenu() {
        console.log(chalk.blue("\n🔧 Strategy Management\n"));

        if (this.isEmergencyMode) {
            console.log(chalk.red("🚨 Emergency Mode - Strategy operations disabled"));
            console.log(chalk.gray("Strategy operations are not available when vault is in emergency mode."));
            console.log(chalk.gray("Available operations: Emergency withdraw, token recovery\n"));
            return;
        }

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
        console.log(chalk.gray("2. Claim Rewards"));
        console.log(chalk.gray("3. Update Rewards"));
        console.log(chalk.gray("4. Back"));

        const choice = await this.question("\nSelect option: ");

        switch (choice) {
            case '1':
                await this.showPendingRewards();
                break;
            case '2':
                await this.claimRewards();
                break;
            case '3':
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
        
        switch (choice) {
            case '1':
                await this.testToggleDepositsPaused();
                break;
            case '2':
                // TODO: Set TWAP Interval
                console.log(chalk.yellow("Not implemented yet"));
                break;
            case '3':
                // TODO: Submit/Cancel Shutdown
                console.log(chalk.yellow("Not implemented yet"));
                break;
            case '4':
                await this.testSetEmergencyMode();
                break;
            case '5':
                await this.testRecoverERC20();
                break;
        }
    }
    
    async testSetEmergencyMode() {
        console.log(chalk.blue("\n🚨 Set Emergency Mode\n"));
        
        // Check current emergency status
        await displayEmergencyStatus(this.vault!);
        
        const isEmergency = await checkEmergencyMode(this.vault!);
        if (isEmergency) {
            console.log(chalk.yellow("\n⚠️  Vault is already in emergency mode"));
            return;
        }
        
        console.log(chalk.red("\n⚠️  WARNING - SETTING EMERGENCY MODE:"));
        console.log(chalk.red("• This will withdraw ALL funds from strategy"));
        console.log(chalk.red("• Strategy will be set to address(0)"));
        console.log(chalk.red("• No new deposits will be allowed"));
        console.log(chalk.red("• Users can only emergency withdraw"));
        console.log(chalk.red("• This action is IRREVERSIBLE"));
        
        console.log(chalk.yellow("\n📋 Steps to trigger emergency mode:"));
        console.log(chalk.gray("1. Call flagShutdown() to notify users"));
        console.log(chalk.gray("2. Wait at least 1 block"));
        console.log(chalk.gray("3. Call setEmergencyMode() through VaultFactory"));
        
        console.log(chalk.yellow("\n⚠️  Note: This requires VaultFactory owner permissions"));
        
        const confirmed = await this.confirm("\nProceed with emergency mode activation?");
        if (!confirmed) {
            console.log(chalk.yellow("Emergency mode activation cancelled"));
            return;
        }
        
        try {
            // Get VaultFactory address
            const vaultFactoryAddress = await this.vault!.getFactory();
            console.log(chalk.gray(`\nVaultFactory: ${vaultFactoryAddress}`));
            
            // Get VaultFactory contract
            const vaultFactory = await ethers.getContractAt("IVaultFactory", vaultFactoryAddress, this.signer);
            
            // Call setEmergencyMode through factory
            console.log(chalk.blue("\n📤 Calling setEmergencyMode through VaultFactory..."));
            
            await this.executeAction("Set Emergency Mode", async () => {
                return vaultFactory.setEmergencyMode(await this.vault!.getAddress());
            });
            
            // Check if it worked
            const isEmergencyAfter = await checkEmergencyMode(this.vault!);
            if (isEmergencyAfter) {
                console.log(chalk.green("\n✅ Emergency mode activated successfully"));
            } else {
                console.log(chalk.red("\n❌ Failed to activate emergency mode"));
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(chalk.red("\n❌ Error setting emergency mode:"), error.message || error);
                
                if (error.message?.includes("Ownable")) {
                    console.log(chalk.yellow("\n💡 You need to be the VaultFactory owner to set emergency mode"));
                }
            } else {
                console.error(chalk.red("\n❌ Error setting emergency mode: UNKNOWN"));
            }
        }
    }
    
    async testToggleDepositsPaused() {
        console.log(chalk.blue("\n⏸️  Toggle Deposits Paused\n"));
        
        try {
            const isPaused = await this.vault!.isDepositsPaused();
            console.log(chalk.cyan(`Current state: Deposits are ${isPaused ? 'PAUSED' : 'ACTIVE'}`));
            
            const action = isPaused ? "resume" : "pause";
            const confirmed = await this.confirm(`\n${isPaused ? 'Resume' : 'Pause'} deposits?`);
            
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }
            
            await this.executeAction(`${isPaused ? 'Resume' : 'Pause'} Deposits`, async () => {
                if (isPaused) {
                    return this.vault!.resumeDeposits();
                } else {
                    return this.vault!.pauseDeposits();
                }
            });
            
            const isPausedAfter = await this.vault!.isDepositsPaused();
            console.log(chalk.green(`\n✅ Deposits are now ${isPausedAfter ? 'PAUSED' : 'ACTIVE'}`));
        } catch (error: unknown) {
             if (error instanceof Error) {
                console.error(chalk.red("\n❌ Error toggling deposits:"), error.message || error);
                
                if (error.message?.includes("OnlyOperator") || error.message?.includes("Ownable")) {
                    console.log(chalk.yellow("\n💡 You need operator or owner permissions to toggle deposits"));
                }
             } else {
                console.error(chalk.red("\n❌ Error toggling deposits: UNKNOWN"))
             }
        }
    }

    async testRecoverERC20() {
        console.log(chalk.blue("\n💰 Recover ERC20 Tokens\n"));

        // Get VaultFactory through the vault (Shadow vaults use the same factory pattern)
        try {
            const vaultFactoryAddress = await this.vault!.getFactory();

            if (!vaultFactoryAddress || vaultFactoryAddress === ethers.ZeroAddress) {
                console.log(chalk.red("❌ VaultFactory address not found. Cannot perform recovery."));
                return;
            }

            const vaultFactory = await ethers.getContractAt("IVaultFactory", vaultFactoryAddress, this.signer);

            // Show recovery options
            console.log(chalk.blue("\n🔧 Recovery Options:\n"));
            console.log(chalk.gray("1. Discover and recover tokens"));
            console.log(chalk.gray("2. Recover specific token"));
            console.log(chalk.gray("3. Back"));

            const choice = await this.question("\nSelect option: ");

            switch (choice) {
                case '1':
                    await this.discoverAndRecoverTokens(vaultFactory);
                    break;
                case '2':
                    await this.recoverSpecificToken(vaultFactory);
                    break;
                case '3':
                    return;
                default:
                    if (choice.trim() !== '') {
                        console.log(chalk.red("Invalid option"));
                    }
            }
        } catch (error) {
            console.error(chalk.red("❌ Error initializing recovery:"), error);
        }
    }

    async discoverAndRecoverTokens(vaultFactory: IVaultFactory) {
        console.log(chalk.blue("\n🔍 Discover & Recover Tokens\n"));

        try {
            // Get vault and token addresses
            const vaultAddress = await this.vault!.getAddress();
            const tokenXAddress = await this.vault!.getTokenX();
            const tokenYAddress = await this.vault!.getTokenY();

            // Discover tokens
            const tokens = await discoverTokensInVault(
                vaultAddress,
                tokenXAddress,
                tokenYAddress,
                this.signer
            );

            if (tokens.length === 0) {
                console.log(chalk.yellow("📭 No tokens with balances found in vault"));
                return;
            }

            // Show recovery loop
            let recovering = true;
            while (recovering) {
                const selectedToken = await selectToken(tokens, (prompt) => this.question(prompt));

                if (!selectedToken) {
                    recovering = false;
                    break;
                }

                const success = await this.performTokenRecovery(selectedToken, vaultFactory);

                if (success) {
                    // Remove recovered token from list if fully recovered
                    const updatedBalance = await this.checkTokenBalance(selectedToken.address, await this.vault!.getAddress());
                    if (updatedBalance === 0n) {
                        const index = tokens.indexOf(selectedToken);
                        tokens.splice(index, 1);
                        console.log(chalk.green(`✅ Token ${selectedToken.symbol} fully recovered and removed from list`));
                    } else {
                        // Update balance
                        selectedToken.balance = updatedBalance;
                        selectedToken.formattedBalance = ethers.formatUnits(updatedBalance, selectedToken.decimals);
                    }
                }

                if (tokens.length === 0) {
                    console.log(chalk.green("🎉 All tokens recovered!"));
                    recovering = false;
                } else {
                    const continueRecovery = await this.confirm("\nRecover more tokens?");
                    recovering = continueRecovery;
                }
            }

        } catch (error) {
            console.error(chalk.red("❌ Error during token discovery:"), error);
        }
    }

    async recoverSpecificToken(vaultFactory: IVaultFactory) {
        console.log(chalk.blue("\n💰 Recover Specific Token\n"));

        const tokenAddress = await this.question("Enter token address: ");

        if (!ethers.isAddress(tokenAddress)) {
            console.log(chalk.red("❌ Invalid token address"));
            return;
        }

        try {
            const vaultAddress = await this.vault!.getAddress();
            const balance = await this.checkTokenBalance(tokenAddress, vaultAddress);

            if (balance === 0n) {
                console.log(chalk.yellow("📭 Token has no balance in vault"));
                return;
            }

            // Get token info
            const token = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenAddress, this.signer);
            const symbol = await token.symbol();
            const decimals = await token.decimals();

            const tokenInfo: TokenInfo = {
                address: tokenAddress,
                symbol,
                decimals: Number(decimals),
                balance,
                formattedBalance: ethers.formatUnits(balance, decimals),
                isVaultToken: false,
                isRecoverable: true
            };

            // Check if it's a vault token
            const tokenXAddress = await this.vault!.getTokenX();
            const tokenYAddress = await this.vault!.getTokenY();

            if (tokenAddress.toLowerCase() === tokenXAddress.toLowerCase()) {
                tokenInfo.isVaultToken = true;
                tokenInfo.warningMessage = "⚠️ This is vault's Token X - recovery may affect operations";
            } else if (tokenAddress.toLowerCase() === tokenYAddress.toLowerCase()) {
                tokenInfo.isVaultToken = true;
                tokenInfo.warningMessage = "⚠️ This is vault's Token Y - recovery may affect operations";
            } else if (tokenAddress.toLowerCase() === vaultAddress.toLowerCase()) {
                tokenInfo.isVaultToken = true;
                tokenInfo.warningMessage = "⚠️ These are vault shares - only recoverable if sent accidentally";
                tokenInfo.symbol = `${symbol} (Vault Shares)`;
            }

            await this.performTokenRecovery(tokenInfo, vaultFactory);

        } catch (error) {
            console.error(chalk.red("❌ Error recovering specific token:"), error);
        }
    }

    async performTokenRecovery(tokenInfo: TokenInfo, vaultFactory: IVaultFactory): Promise<boolean> {
        try {
            // Get recovery amount
            const amount = await getRecoveryAmount(tokenInfo, (prompt) => this.question(prompt));
            if (!amount) {
                console.log(chalk.yellow("Recovery cancelled"));
                return false;
            }

            // Validate recovery
            const validation = await validateRecovery(tokenInfo, this.vault!, amount);
            if (!validation.valid) {
                console.log(chalk.red(`❌ ${validation.message}`));
                return false;
            }

            // Get recipient
            const recipient = await getRecipientAddress(this.signer.address, (prompt) => this.question(prompt));
            if (!recipient) {
                console.log(chalk.red("❌ Invalid recipient address"));
                return false;
            }

            // Show preview
            displayRecoveryPreview(tokenInfo, amount, recipient);

            // Confirm recovery
            const confirmed = await this.confirm("\nProceed with recovery?");
            if (!confirmed) {
                console.log(chalk.yellow("Recovery cancelled"));
                return false;
            }

            // Execute recovery
            const success = await executeRecovery(
                vaultFactory,
                await this.vault!.getAddress(),
                tokenInfo.address,
                recipient,
                amount,
                this.signer,
                (name, fn) => this.executeAction(name, fn)
            );

            return success;

        } catch (error) {
            console.error(chalk.red("❌ Error during token recovery:"), error);
            return false;
        }
    }

    async checkTokenBalance(tokenAddress: string, vaultAddress: string): Promise<bigint> {
        try {
            const token = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenAddress, this.signer);
            return await token.balanceOf(vaultAddress);
        } catch (error) {
            console.error(chalk.red(`Error checking balance for ${tokenAddress}:`), error);
            return 0n;
        }
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
            
            const decimals = await this.vault!.decimals();
            console.log(chalk.gray(`\n  Shares: ${formatters.formatShareAmount(shares, Number(decimals))}`));
            console.log(chalk.gray(`  Effective X: ${await formatters.formatBalance(effectiveX, this.tokenX!)}`));
            console.log(chalk.gray(`  Effective Y: ${await formatters.formatBalance(effectiveY, this.tokenY!)}`));
        } catch (error) {
            console.error(chalk.red("Error previewing shares:"), error);
        }
    }

    async showQueueStatus() {
        console.log(chalk.blue("\n📊 Queue Status\n"));
        
        try {
            const currentRound = await this.vault!.getCurrentRound();
            console.log(chalk.gray(`Current Round: ${currentRound}`));
            
            for (let i = 0; i <= Number(currentRound); i++) {
                const totalQueued = await this.vault!.getTotalQueuedWithdrawal(i);
                const userQueued = await this.vault!.getQueuedWithdrawal(i, this.signer.address);
                
                if (totalQueued > 0 || userQueued > 0) {
                    console.log(chalk.white(`\nRound ${i}:`));
                    const vaultDecimals = await this.vault!.decimals();
                    console.log(chalk.gray(`  Total Queued: ${formatters.formatShareAmount(totalQueued, Number(vaultDecimals))}`));
                    console.log(chalk.gray(`  User Queued: ${formatters.formatShareAmount(userQueued, Number(vaultDecimals))}`));
                    
                    if (userQueued > 0) {
                        const [amountX, amountY] = await this.vault!.getRedeemableAmounts(i, this.signer.address);
                        console.log(chalk.gray(`  Redeemable X: ${await formatters.formatBalance(amountX, this.tokenX!)}`));
                        console.log(chalk.gray(`  Redeemable Y: ${await formatters.formatBalance(amountY, this.tokenY!)}`));
                    }
                }
            }
        } catch (error) {
            console.error(chalk.red("Error fetching queue status:"), error);
        }
    }

    async showStrategyInfo() {
        console.log(chalk.blue("\n📊 Strategy Information\n"));

        if (this.isEmergencyMode || !this.strategy) {
            console.log(chalk.red("❌ Strategy information not available in emergency mode"));
            console.log(chalk.yellow("💡 Strategy is set to null address when vault is in emergency mode"));
            return;
        }

        try {
            const [position, tickLower, tickUpper] = await this.strategy.getPosition();
            const operator = await this.strategy.getOperator();
            const lastRebalance = await this.strategy.getLastRebalance();
            //const [liquidity, tokenXOwed, tokenYOwed] = await this.strategy.getNpmLiquidity();

            console.log(chalk.white("Position:"));
            console.log(chalk.gray(`  Token ID: ${position.toString()}`));
            console.log(chalk.gray(`  Tick Lower: ${tickLower}`));
            console.log(chalk.gray(`  Tick Upper: ${tickUpper}`));

            //console.log(chalk.gray(`  LB Pair Liquidity: ${liquidity}`));
            //console.log(chalk.gray(`  LB Pair TokenX Owed: ${tokenXOwed}`));
            //console.log(chalk.gray(`  LB Pair TokenY Owed: ${tokenYOwed}`));

            console.log(chalk.white("\nManagement:"));
            console.log(chalk.gray(`  Operator: ${operator}`));
            console.log(chalk.gray(`  Last Rebalance: ${new Date(Number(lastRebalance) * 1000).toLocaleString()}`));

            // Use shared display function
            await displayStrategyAllocation(this.strategy, this.tokenX!, this.tokenY!);

        } catch (error) {
            console.error(chalk.red("Error fetching strategy info:"), error);
        }
    }

    async testHarvestRewards() {
        console.log(chalk.blue("\n🌾 Test Harvest Rewards\n"));

        if (this.isEmergencyMode || !this.strategy) {
            console.log(chalk.red("❌ Harvest rewards not available in emergency mode"));
            console.log(chalk.yellow("💡 Strategy operations are disabled when vault is in emergency mode"));
            return;
        }

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
                for (const reward of pendingRewards) {
                    const formatted = await formatters.formatRewardAmount(reward.pendingRewards, reward.token, this.signer);
                    console.log(chalk.gray(`  ${formatted}`));
                }
            }
        } catch (error) {
            console.error(chalk.red("Error fetching pending rewards:"), error);
        }
    }

    async claimRewards() {
        console.log(chalk.blue("\n💸 Claim Rewards\n"));

        await this.executeAction("Claim Rewards", async () => {
            return this.vault!.claim();
        });
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
        const cacheShadowVaultPath = path.join(__dirname, "../cache", "shadow-vault.json");
        if (fs.existsSync(cacheShadowVaultPath)) {
            const cachedAddress = JSON.parse(fs.readFileSync(cacheShadowVaultPath, 'utf8'));
            vaultAddress = cachedAddress;
            if (vaultAddress && vaultAddress !== ethers.ZeroAddress) {
                console.log(chalk.gray(`✓ Shadow vault address loaded at: ${vaultAddress}`));
            } else {
                console.log(chalk.yellow(`⚠️  Invalid shadow vault address found in cache ${cacheShadowVaultPath}`));
                vaultAddress = ethers.ZeroAddress;
            }
        } else {
            console.log(chalk.gray(`No shadow vault address cache found.`));
        }

        // Create readline interface for user input
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        if (vaultAddress && vaultAddress !== ethers.ZeroAddress) {
            vaultAddress = await promptWithDefault(rl,
                "Enter OracleRewardShadowVault address",
                vaultAddress.toString(),
                `${vaultAddress}`);
        } else {
            vaultAddress = await new Promise<string>((resolve) => {
                rl.question(chalk.yellow("Enter OracleRewardShadowVault address: "), (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            });
        }
        
        rl.close();

        if (!vaultAddress || !ethers.isAddress(vaultAddress)) {
            console.error(chalk.red("\n❌ Invalid vault address provided"));
            process.exit(1);
        } else {
            fs.writeFileSync(cacheShadowVaultPath, JSON.stringify(vaultAddress));
        }
    }
    
    console.log(chalk.gray(`Vault: ${vaultAddress}`));
    
    // Get strategy address from vault
    let strategyAddress: string;
    try {
        const vault = await ethers.getContractAt("OracleRewardShadowVault", vaultAddress, signer);
        strategyAddress = await vault.getStrategy();
        
        if (strategyAddress === ethers.ZeroAddress) {
            console.log(chalk.yellow("\n⚠️  No strategy set on vault"));
            console.log(chalk.yellow("This indicates the vault is in Emergency Mode. Continuing with limited functionality."));
            console.log(chalk.cyan("Available operations: View info, emergency withdraw, token recovery"));
        } else {
            console.log(chalk.gray(`Strategy: ${strategyAddress} (derived from vault)`));
        }
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
        // Better error handling for main process
        if (error && typeof error === 'object') {
            if (error.message) {
                console.error(chalk.red("\n❌ Fatal error:"), error.message);
                
                // Provide helpful hints based on error type
                if (error.message.includes('BigInt')) {
                    console.log(chalk.yellow("\n💡 Hint: Enter amounts in decimal format (e.g., '1.5') or wei"));
                } else if (error.message.includes('ECONNREFUSED')) {
                    console.log(chalk.yellow("\n💡 Hint: Make sure your local Hardhat node is running"));
                } else if (error.message.includes('nonce')) {
                    console.log(chalk.yellow("\n💡 Hint: Transaction nonce mismatch - try restarting the node"));
                }
            } else {
                console.error(chalk.red("\n❌ Fatal error:"), error);
            }
        } else {
            console.error(chalk.red("\n❌ Fatal error:"), error);
        }
        process.exit(1);
    });
}

export { ShadowVaultTester, TestConfig };