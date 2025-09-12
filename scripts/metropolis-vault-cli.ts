import { ethers, network } from "hardhat";
import readline from "readline";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import type { 
    OracleRewardVault,
    MetropolisStrategy,
    ILBPair,
    OracleHelper,
    HybridPriceLens,
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
    calculateDefaultBinRange,
    calculateOptimalDepositAmounts,
    displayStrategyAllocation,
    parseTokenAmount,
    parseShareAmount,
    clearReadlineBuffer,
    promptAndParseAmount,
    promptWithDefault,
    checkEmergencyMode,
    validateEmergencyWithdraw,
    displayEmergencyStatus,
    estimateEmergencyWithdrawal
} from "./test-vault-utils";
import type { ContractTransactionResponse } from "ethers";

class MetropolisVaultTester {
    private rl: readline.Interface;
    private config: TestConfig;
    private vault?: OracleRewardVault;
    private vaultFactory?: IVaultFactory;
    private strategy?: MetropolisStrategy;
    private pair?: ILBPair;
    private oracleHelper?: OracleHelper;
    private priceLens?: HybridPriceLens;
    private tokenX?: IERC20MetadataUpgradeable;
    private tokenY?: IERC20MetadataUpgradeable;
    private signer: SignerWithAddress;
    private resultManager: TestResultManager;

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
        console.log(chalk.blue("\n🚀 Initializing Metropolis Vault Tester...\n"));
        
        try {
            // Connect to contracts
            console.log(chalk.gray("Loading vault contract..."));
            this.vault = await ethers.getContractAt("OracleRewardVault", this.config.vaultAddress, this.signer);
            console.log(chalk.gray(`✓ Vault loaded at: ${await this.vault.getAddress()}`));

            console.log(chalk.gray("Loading strategy contract..."));
            this.strategy = await ethers.getContractAt("MetropolisStrategy", this.config.strategyAddress, this.signer);
            console.log(chalk.gray(`✓ Strategy loaded at: ${await this.strategy.getAddress()}`));
            
            // Get associated contracts
            console.log(chalk.gray("Getting pair address..."));
            const pairAddress = await this.vault.getPair();
            console.log(chalk.gray(`✓ Pair address: ${pairAddress}`));
            
            console.log(chalk.gray("Loading pair contract..."));
            this.pair = await ethers.getContractAt("ILBPair", pairAddress, this.signer);

            const vaultFactoryAddress = await this.vault.getFactory();

            if (vaultFactoryAddress && vaultFactoryAddress !== ethers.ZeroAddress) {
                this.vaultFactory = await ethers.getContractAt("VaultFactory", vaultFactoryAddress, this.signer);

                if (this.vaultFactory) {
                    console.log(chalk.gray(`✓ Vault Factory loaded at: ${vaultFactoryAddress}`));
                } else {
                    console.log(chalk.yellow(`⚠️ Failed to load VaultFactory from address ${vaultFactoryAddress}`));
                }
                
            } else {
                console.log(chalk.yellow(`⚠️ Failed to get VaultFactory address`));
            }
            
            // Load oracle helper if available
            console.log(chalk.gray("Loading oracle helper..."));
            const deploymentPath = path.join(__dirname, "../deployments", `metropolis-${network.name}.json`);
            if (fs.existsSync(deploymentPath)) {
                const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
                const oracleHelperAddress = await this.vault.getOracleHelper();
                const priceLensAddress = deployment.addresses?.priceLens;
                
                if (oracleHelperAddress && oracleHelperAddress !== ethers.ZeroAddress) {
                    this.oracleHelper = await ethers.getContractAt("OracleHelper", oracleHelperAddress, this.signer);
                    console.log(chalk.gray(`✓ Oracle Helper loaded at: ${oracleHelperAddress}`));
                } else {
                    console.log(chalk.yellow(`⚠️  Oracle Helper not found in deployment file`));
                }
                
                if (priceLensAddress && priceLensAddress !== ethers.ZeroAddress) {
                    this.priceLens = await ethers.getContractAt("HybridPriceLens", priceLensAddress, this.signer);
                    console.log(chalk.gray(`✓ Price Lens loaded at: ${priceLensAddress}`));
                } else {
                    console.log(chalk.yellow(`⚠️  Price Lens not found in deployment file`));
                }
            } else {
                console.log(chalk.yellow(`⚠️  Deployment file not found for network: ${network.name}`));
            }
            
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
            const pairAddress = await this.pair!.getAddress();
            
            console.log(chalk.white("Basic Info:"));
            console.log(chalk.gray(`  Name: ${name}`));
            console.log(chalk.gray(`  Symbol: ${symbol}`));
            console.log(chalk.gray(`  Decimals: ${decimals}`));
            console.log(chalk.gray(`  Version: ${version}`));
            console.log(chalk.gray(`  Vault Type: ${vaultType}`));
            console.log(chalk.gray(`  Pair address: ${pairAddress}`));
            
            // State
            const isPaused = await this.vault!.isDepositsPaused();
            const isFlagged = await this.vault!.isFlaggedForShutdown();
            const totalSupply = await this.vault!.totalSupply();
            const [balanceX, balanceY] = await this.vault!.getBalances();
            const activeId = await this.pair!.getActiveId();
            const binStep = await this.pair!.getBinStep();
            
            console.log(chalk.white("\nState:"));
            console.log(chalk.gray(`  Deposits Paused: ${isPaused}`));
            console.log(chalk.gray(`  Is Flagged for Shutdown: ${isFlagged}`));
            console.log(chalk.gray(`  Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`));
            console.log(chalk.gray(`  Balance X: ${await formatters.formatBalance(balanceX, this.tokenX!)}`));
            console.log(chalk.gray(`  Balance Y: ${await formatters.formatBalance(balanceY, this.tokenY!)}`));
            console.log(chalk.gray(`  Active Bin ID: ${activeId.toString()}`));
            console.log(chalk.gray(`  Bin Step: ${binStep.toString()}`));
            
            
            // Price information
            if (this.oracleHelper) {
                try {
                    const price = await this.oracleHelper.getPrice();
                    const tokenXDecimals = await getTokenDecimals(this.tokenX!);
                    const tokenYDecimals = await getTokenDecimals(this.tokenY!);
                    const tokenXSymbol = await getTokenSymbol(this.tokenX!);
                    const tokenYSymbol = await getTokenSymbol(this.tokenY!);
                    
                    console.log(chalk.white("\nPrice Information:"));
                    // Oracle price is in 128.128 fixed-point format
                    // The price represents how many units of tokenY per unit of tokenX
                    // To get the price of 1 full tokenX in tokenY:
                    // (price * 10^tokenXDecimals) >> 128, then format with tokenY decimals
                    
                    const SCALE_OFFSET = 128n;
                    const oneTokenX = 10n ** BigInt(tokenXDecimals);
                    
                    // Calculate how many units of Y for 1 full token of X
                    const amountYForOneX = (price * oneTokenX) >> SCALE_OFFSET;
                    const priceFormatted = ethers.formatUnits(amountYForOneX, tokenYDecimals);
                    console.log(chalk.gray(`  Oracle Price: 1 ${tokenXSymbol} = ${priceFormatted} ${tokenYSymbol}`));
                    
                    // Show current bin price for comparison
                    if (this.priceLens) {
                        try {
                            const tokenXAddress = await this.tokenX!.getAddress();
                            const tokenYAddress = await this.tokenY!.getAddress();
                            
                            const tokenXPriceNative = await this.priceLens.getTokenPriceNative(tokenXAddress);
                            const tokenXPriceNativeFormatted = ethers.formatUnits(tokenXPriceNative, 18); // Native price is in 18 decimals (wS)
                            console.log(chalk.gray(`  PriceLens: 1 ${tokenXSymbol} = ${tokenXPriceNativeFormatted} wS`));
                            
                            const tokenYPriceNative = await this.priceLens.getTokenPriceNative(tokenYAddress);
                            const tokenYPriceNativeFormatted = ethers.formatUnits(tokenYPriceNative, 18); // Native price is in 18 decimals (wS)
                            console.log(chalk.gray(`  PriceLens: 1 ${tokenYSymbol} = ${tokenYPriceNativeFormatted} wS`));
                            
                            // Calculate cross price
                            // If tokenX = 1 wS and tokenY = 3.28 wS, then tokenX/tokenY = 1/3.28 = 0.3048 tokenY per tokenX
                            if (tokenYPriceNative > 0n) {
                                const scaleFactor = 10n ** BigInt(tokenYDecimals);
                                const tokenXPerY = (tokenXPriceNative * scaleFactor) / tokenYPriceNative;
                                const tokenXPerYFormatted = ethers.formatUnits(tokenXPerY, tokenYDecimals);
                                console.log(chalk.gray(`  PriceLens Cross: 1 ${tokenXSymbol} = ${tokenXPerYFormatted} ${tokenYSymbol}`));
                            }
                        } catch (e) {
                            if (e instanceof Error) {
                                console.log(chalk.yellow(`  Could not fetch spot price from price lens: ${e.message || e}`));
                            } else {
                                console.error("Unknown error", e);
                            }
                            
                        }
                    } else {
                        console.log(chalk.yellow(`Price lens not set`));
                    }

                    // Oracle Helper detailed parameters
                    try {
                        const oracleParams = await this.oracleHelper.getOracleParameters();
                        console.log(chalk.white("\nOracle Helper Parameters:"));
                        console.log(chalk.gray(`  Min Price: ${ethers.formatUnits(oracleParams.minPrice, tokenYDecimals)}`));
                        console.log(chalk.gray(`  Max Price: ${ethers.formatUnits(oracleParams.maxPrice, tokenYDecimals)}`));
                        console.log(chalk.gray(`  Heartbeat X: ${oracleParams.heartbeatX} seconds`));
                        console.log(chalk.gray(`  Heartbeat Y: ${oracleParams.heartbeatY} seconds`));
                        console.log(chalk.gray(`  Deviation Threshold: ${ethers.formatUnits(oracleParams.deviationThreshold, 16)}%`));
                        console.log(chalk.gray(`  TWAP Check Enabled: ${oracleParams.twapPriceCheckEnabled}`));
                        console.log(chalk.gray(`  TWAP Interval: ${oracleParams.twapInterval} seconds`));
                        
                        // Check if price is in deviation
                        const priceInDeviation = await this.oracleHelper.checkPriceInDeviation();
                        console.log(chalk.gray(`  Price In Deviation: ${priceInDeviation ? chalk.green("Yes") : chalk.red("No")}`));
                        
                        // Get data feeds
                        const dataFeedX = await this.oracleHelper.getDataFeedX();
                        const dataFeedY = await this.oracleHelper.getDataFeedY();
                        console.log(chalk.gray(`  Data Feed X: ${dataFeedX}`));
                        console.log(chalk.gray(`  Data Feed Y: ${dataFeedY}`));
                    } catch (e) {
                        console.log(chalk.yellow(`  Could not fetch oracle helper parameters`));
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
                
                // Get bin range from strategy
                try {
                    const [low, upper] = await this.strategy!.getRange();
                    const maxRange = await this.strategy!.getMaxRange();
                    console.log(chalk.gray(`  Current Bin Range: [${low}, ${upper}]`));
                    console.log(chalk.gray(`  Max Range Width: ${maxRange}`));
                } catch (e) {
                    console.log(chalk.gray(`  Bin Range: Not set`));
                }
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

            const tokenXDecimals = await getTokenDecimals(this.tokenX!);
            const tokenYDecimals = await getTokenDecimals(this.tokenY!);
            const tokenXSymbol = await getTokenSymbol(this.tokenX!);
            const tokenYSymbol = await getTokenSymbol(this.tokenY!);
            console.log(chalk.gray(`  Token X Balance: ${await formatters.formatBalance(tokenXBal, this.tokenX!)}`));
            console.log(chalk.gray(`  Token Y Balance: ${await formatters.formatBalance(tokenYBal, this.tokenY!)}`));
            
            // Rewards
            const userInfo = await this.vault!.getUserInfo(userAddress);
            const pendingRewards = await this.vault!.getPendingRewards(userAddress);
            
            console.log(chalk.white("\nReward Info:"));
            const vaultDecimals = await this.vault!.decimals();
            console.log(chalk.gray(`  Phantom Amount: ${formatters.formatShareAmount(userInfo.phantomAmount, Number(vaultDecimals))}`));
            
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
        const amountXStr = await this.question("Enter amount X (e.g., '1.5', '1000000' wei): ");
        const parsedX = parseTokenAmount(amountXStr, decimalsX, symbolX);
        if (!parsedX.success) {
            console.log(chalk.red(`\n❌ ${parsedX.error}`));
            return;
        }
        
        // Parse amount Y with validation
        const amountYStr = await this.question("Enter amount Y (e.g., '10 USDC', '100000' wei): ");
        const parsedY = parseTokenAmount(amountYStr, decimalsY, symbolY);
        if (!parsedY.success) {
            console.log(chalk.red(`\n❌ ${parsedY.error}`));
            return;
        }
        
        // Parse minimum shares
        const vaultDecimals = Number(await this.vault!.decimals());
        const minSharesStr = await this.question("Enter minimum shares (or 0 for no minimum): ");
        const parsedShares = parseTokenAmount(minSharesStr || "0", vaultDecimals);
        
        const params = {
            amountX: parsedX.value!,
            amountY: parsedY.value!,
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
        
        const sharesInput = await this.questionWithDefault("Enter the amount of shares to withdraw (in wei, or as a percentage)", "100%", "100%")
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
        
        // Get current round
        const currentRound = await this.vault!.getCurrentRound();
        console.log(chalk.gray(`Current round: ${currentRound}`));
        
        const recipient = (await this.question("Enter recipient (or press enter for self): ")) || this.signer.address;

        // Check for available withdrawals
        const [availableAmountX, availableAmountY] = await this.vault!.getRedeemableAmounts(currentRound, recipient);
        
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
            return this.vault!.redeemQueuedWithdrawal(currentRound, recipient);
        });
    }

    async testRebalance() {
        console.log(chalk.blue("\n🔄 Test Rebalance\n"));
        
        // Show current state
        const activeId  = await this.pair!.getActiveId();
        console.log(chalk.gray(`Current Active Bin ID: ${activeId}`));
        
        try {
            const [currentLow, currentUpper] = await this.strategy!.getRange();
            console.log(chalk.gray(`Current Bin Range: [${currentLow}, ${currentUpper}]`));
            
            // Show current range visualization
            displayVisualRange(Number(currentLow), Number(currentUpper), Number(activeId), "bin");
        } catch (e) {
            console.log(chalk.gray(`Current Bin Range: Not set`));
        }
        
        // Calculate smart defaults
        const currentActiveBin = Number(activeId);
        const defaultRange = calculateDefaultBinRange(currentActiveBin, 51); // 51 bins total
        
        // Get current strategy balances for amount defaults
        const [idleX, idleY] = await this.strategy!.getIdleBalances();
        const defaultAmounts = calculateOptimalDepositAmounts(idleX, idleY, 10);
        
        // Get user inputs with defaults
        const newLower = await this.questionWithDefault(
            "Enter new lower bin ID",
            defaultRange.lower.toString(),
            `${defaultRange.lower} (25 bins below active)`
        );
        const newUpper = await this.questionWithDefault(
            "Enter new upper bin ID",
            defaultRange.upper.toString(),
            `${defaultRange.upper} (25 bins above active)`
        );
        const desiredActiveId = await this.questionWithDefault(
            "Enter desired active bin ID",
            currentActiveBin.toString(),
            `${currentActiveBin} (current)`
        );
        const slippageActiveId = await this.questionWithDefault(
            "Enter slippage active bin ID",
            "10",
            "10 (standard slippage)"
        );
        
        // Show amount suggestions
        if (idleX > 0n || idleY > 0n) {
            console.log(chalk.cyan("\n💡 Suggested amounts (90% of available, 10% reserve):"));
            console.log(chalk.gray(`  Token X: ${defaultAmounts.amountX} wei`));
            console.log(chalk.gray(`  Token Y: ${defaultAmounts.amountY} wei`));
        } else {
            // If no idle balance, use vault balance
            const [vaultX, vaultY] = await this.vault!.getBalances();
            defaultAmounts.amountX = vaultX;
            defaultAmounts.amountY = vaultY;
            console.log(chalk.gray(`\nUsing vault balances: X=${vaultX}, Y=${vaultY}`));
        }
        
        const amountXInput = await this.questionWithDefault(
            "Enter amount X to deposit (in wei)",
            defaultAmounts.amountX.toString(),
            `${defaultAmounts.amountX} (90% of available)`
        );
        const amountYInput = await this.questionWithDefault(
            "Enter amount Y to deposit (in wei)",
            defaultAmounts.amountY.toString(),
            `${defaultAmounts.amountY} (90% of available)`
        );
        
        const amountX = BigInt(amountXInput);
        const amountY = BigInt(amountYInput);
        
        // For simplicity, we'll create a uniform distribution
        const numBins = parseInt(newUpper) - parseInt(newLower) + 1;
        console.log(chalk.gray(`Number of bins: ${numBins}`));
        
        // TODO REWRITE THIS USING PYTHON BOT EXAMPLE (Needs to sum to 1E18)
        // Create distribution bytes (simplified - uniform distribution)
        const distributionX: number[] = [];
        const distributionY: number[] = [];
        const distributionPerBin = Math.floor(10000 / numBins); // 10000 = 100%
        
        for (let i = 0; i < numBins; i++) {
            distributionX.push(distributionPerBin);
            distributionY.push(distributionPerBin);
        }
        
        // Encode distributions
        const distributions = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256[]", "uint256[]"],
            [distributionX, distributionY]
        );
        
        // Show new range visualization
        displayVisualRange(parseInt(newLower), parseInt(newUpper), parseInt(desiredActiveId), "bin");
        
        const params = {
            newLower: parseInt(newLower),
            newUpper: parseInt(newUpper),
            desiredActiveId: parseInt(desiredActiveId),
            slippageActiveId: parseInt(slippageActiveId),
            amountX: amountX.toString(),
            amountY: amountY.toString(),
            distributions: distributions
        };
        
        // TODO FIX ME (this operation reverts) there's an error somewhere
        await this.executeAction("Rebalance", async () => {
            return this.strategy!.rebalance(
                params.newLower,
                params.newUpper,
                params.desiredActiveId,
                params.slippageActiveId,
                amountX,
                amountY,
                distributions
            );
        });
    }

        const receipt = await tx.wait();
        console.log(tx.hash);
        console.log(receipt?.toJSON())
    }

    async exportResults() {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `metropolis-vault-test-${timestamp}.json`;
        const filepath = path.join(this.config.exportPath, filename);
        
        await this.resultManager.exportToFile(filepath);
    }

    async showMainMenu() {
        console.log(chalk.blue("\n=== Metropolis Vault Interactive Tester ===\n"));
        console.log(chalk.gray("1. View Vault Information"));
        console.log(chalk.gray("2. View User Information"));
        console.log(chalk.gray("3. Deposit Operations"));
        console.log(chalk.gray("4. Withdrawal Operations"));
        console.log(chalk.gray("5. Strategy Management"));
        console.log(chalk.gray("6. Reward Management"));
        console.log(chalk.gray("7. Admin Functions"));
        console.log(chalk.gray("8. Export Results"));
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
        console.log(chalk.gray("2. Preview Shares"));
        console.log(chalk.gray("3. Back"));
        
        const choice = await this.question("\nSelect option: ");
        
        switch (choice) {
            case '1':
                await this.testDeposit();
                break;
            case '2':
                await this.previewShares();
                break;
        }
    }

    async showWithdrawalMenu() {
        console.log(chalk.blue("\n🏦 Withdrawal Operations\n"));
        console.log(chalk.gray("1. Queue Withdrawal"));
        console.log(chalk.gray("2. Cancel Queued Withdrawal"));
        console.log(chalk.gray("3. Redeem Withdrawal"));
        console.log(chalk.gray("4. Emergency Withdraw"));
        console.log(chalk.gray("5. View Queue Status"));
        console.log(chalk.gray("6. Back"));
        
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
                await this.testEmergencyWithdraw();
                break;
            case '5':
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
            case '4':
                // TODO
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
                // TODO: Recover ERC20
                console.log(chalk.yellow("Not implemented yet"));
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
            const vaultFactoryAddress = await this.vaultFactory!.getAddress();
            console.log(chalk.gray(`\nVaultFactory: ${vaultFactoryAddress}`));
            
            // Call setEmergencyMode through factory
            console.log(chalk.blue("\n📤 Calling setEmergencyMode through VaultFactory..."));
            
            await this.executeAction("Set Emergency Mode", async () => {
                return this.vaultFactory!.setEmergencyMode(await this.vault!.getAddress());
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
                console.error(chalk.red("\n❌ Error toggling deposits:"), error?.message || error);
                
                if (error.message?.includes("OnlyOperator") || error.message?.includes("Ownable")) {
                    console.log(chalk.yellow("\n💡 You need operator or owner permissions to toggle deposits"));
                }
            } else {
                console.error(chalk.red("\n❌ Error toggling deposits: UNKNOWN"));
            }
        }
    }

    // Additional helper methods
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
            
            for (let i = 0; i <= Number(currentRound) && i < 5; i++) {
                const totalQueued = await this.vault!.getTotalQueuedWithdrawal(i);
                const userQueued = await this.vault!.getQueuedWithdrawal(i, this.signer.address);
                
                if (totalQueued > 0 || userQueued > 0) {
                    console.log(chalk.white(`\nRound ${i}:`));
                    const decimals = await this.vault!.decimals();
                    console.log(chalk.gray(`  Total Queued: ${formatters.formatShareAmount(totalQueued, Number(decimals))}`));
                    console.log(chalk.gray(`  User Queued: ${formatters.formatShareAmount(userQueued, Number(decimals))}`));
                    
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
        
        try {
            const operator = await this.strategy!.getOperator();
            const lastRebalance = await this.strategy!.getLastRebalance();
            
            console.log(chalk.white("Management:"));
            console.log(chalk.gray(`  Operator: ${operator}`));
            console.log(chalk.gray(`  Last Rebalance: ${new Date(Number(lastRebalance) * 1000).toLocaleString()}`));
            
            // Try to get range
            try {
                const [low, upper] = await this.strategy!.getRange();
                console.log(chalk.white("\nBin Range:"));
                console.log(chalk.gray(`  Lower: ${low}`));
                console.log(chalk.gray(`  Upper: ${upper}`));
                console.log(chalk.gray(`  Width: ${Number(upper) - Number(low) + 1} bins`));
            } catch (e) {
                console.log(chalk.yellow("\nBin Range: Not set"));
            }
            
            // Use shared display function for fund allocation
            await displayStrategyAllocation(this.strategy!, this.tokenX!, this.tokenY!);
            
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
    console.log(chalk.blue.bold("\n🚀 Metropolis Vault Interactive Tester\n"));
    
    // Get network info
    console.log(chalk.gray(`Network: ${network.name}`));
    console.log(chalk.gray(`Chain ID: ${network.config.chainId}\n`));
    
    // Get signers
    const [signer] = await ethers.getSigners();
    console.log(chalk.gray(`Signer: ${signer.address}\n`));
    
    // Get vault address from command line argument or prompt user
    let vaultAddress = process.argv[2] || process.env.METROPOLIS_VAULT_ADDRESS;
    
    if (!vaultAddress) {
        const cacheMetropolisVaultPath = path.join(__dirname, "../cache", "metropolis-vault.json");
        if (fs.existsSync(cacheMetropolisVaultPath)) {
            const cachedAddress = JSON.parse(fs.readFileSync(cacheMetropolisVaultPath, 'utf8'));
            vaultAddress = cachedAddress;
            if (vaultAddress && vaultAddress !== ethers.ZeroAddress) {
                console.log(chalk.gray(`✓ Metropolis vault address loaded at: ${vaultAddress}`));
            } else {
                console.log(chalk.yellow(`⚠️  Invalid metropolis vault address found in cache ${cacheMetropolisVaultPath}`));
                vaultAddress = ethers.ZeroAddress;
            }
        } else {
            console.log(chalk.gray(`No metropolis vault address cache found.`));
        }

        // Create readline interface for user input
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        

        if (vaultAddress && vaultAddress !== ethers.ZeroAddress) {
            vaultAddress = await promptWithDefault(rl,
                "Enter OracleRewardVault address",
                vaultAddress.toString(),
                `${vaultAddress}`);
        } else {
            vaultAddress = await new Promise<string>((resolve) => {
                rl.question(chalk.yellow("Enter OracleRewardVault address: "), (answer) => {
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
            fs.writeFileSync(cacheMetropolisVaultPath, JSON.stringify(vaultAddress));
        }

    }
    
    console.log(chalk.gray(`Vault: ${vaultAddress}`));
    
    // Get strategy address from vault
    let strategyAddress: string;
    try {
        const vault = await ethers.getContractAt("OracleRewardVault", vaultAddress, signer);
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
    const tester = new MetropolisVaultTester(config);
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

export { MetropolisVaultTester, TestConfig };