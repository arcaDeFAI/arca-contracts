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
import type { IERC20MetadataUpgradeable } from "../typechain-types/openzeppelin-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
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
    estimateGasWithCost
} from "./test-vault-utils";

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
        actionFn: () => Promise<{hash: string; wait(): Promise<{gasUsed: bigint; events?: Array<{event?: string; args?: Record<string, unknown>}>}>}>, 
        params: Record<string, unknown> = {},
        skipConfirmation: boolean = false
    ): Promise<TestResult> {
        // Gas estimation
        if (!this.config.dryRun && !skipConfirmation) {
            try {
                console.log(chalk.gray("\n⛽ Estimating gas..."));
                const gasInfo = await estimateGasWithCost(actionFn);
                console.log(chalk.gray(`  Estimated gas: ${gasInfo.gas.toString()}`));
                console.log(chalk.gray(`  Estimated cost: ${gasInfo.costEth} ETH`));
                
                const confirmed = await this.confirm(`\nProceed with ${actionName}?`);
                if (!confirmed) {
                    console.log(chalk.yellow("Transaction cancelled"));
                    return {
                        timestamp: Date.now(),
                        action: actionName,
                        params,
                        error: "User cancelled"
                    };
                }
            } catch (error) {
                console.log(chalk.yellow("Could not estimate gas, continuing..."));
            }
        }
        
        const result = await executeWithCapture(actionName, actionFn, {
            signer: this.signer,
            dryRun: this.config.dryRun,
            vault: this.vault,
            captureState: () => this.captureState(),
            params
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
                        } catch (e: any) {
                            console.log(chalk.yellow(`  Could not fetch spot price from price lens: ${e.message || e}`));
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
            (name, fn, params, skipConfirm) => this.executeAction(name, fn, params || {}, skipConfirm)
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
        }, params);
    }

    async testQueueWithdrawal() {
        console.log(chalk.blue("\n🏦 Test Queue Withdrawal\n"));
        
        // Show withdrawal context with balance and suggestions
        await ui.showShareWithdrawalContext(this.vault!, this.signer, this.tokenX!, this.tokenY!);
        
        const sharesInput = await this.question("");
        const recipient = await this.question("Enter recipient address (or press enter for self): ");
        
        // Handle "max" input
        let shares: bigint;
        if (sharesInput.toLowerCase() === "max") {
            // Calculate available shares (total - queued)
            const totalShares = await this.vault!.balanceOf(this.signer.address);
            const currentRound = await this.vault!.getCurrentRound();
            let totalQueued = 0n;
            for (let i = 0; i <= Number(currentRound); i++) {
                const queued = await this.vault!.getQueuedWithdrawal(i, this.signer.address);
                totalQueued += queued;
            }
            shares = totalShares - totalQueued;
            console.log(chalk.cyan(`Using max available shares: ${shares.toString()}`));
        } else {
            shares = BigInt(sharesInput || "0");
        }
        
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
        }, params);
    }

    async testRebalance() {
        console.log(chalk.blue("\n🔄 Test Rebalance\n"));
        
        // Show current state
        const { activeId } = await this.pair!.getActiveId();
        console.log(chalk.gray(`Current Active Bin ID: ${activeId}`));
        
        try {
            const [currentLow, currentUpper] = await this.strategy!.getRange();
            console.log(chalk.gray(`Current Bin Range: [${currentLow}, ${currentUpper}]`));
            
            // Show current range visualization
            displayVisualRange(Number(currentLow), Number(currentUpper), Number(activeId), "bin");
        } catch (e) {
            console.log(chalk.gray(`Current Bin Range: Not set`));
        }
        
        const newLower = await this.question("Enter new lower bin ID: ");
        const newUpper = await this.question("Enter new upper bin ID: ");
        const desiredActiveId = await this.question("Enter desired active bin ID: ");
        const slippageActiveId = await this.question("Enter slippage active bin ID: ");

        // Get current balances for the rebalance
        const [amountX, amountY] = await this.vault!.getBalances();
        console.log(chalk.gray(`\nCurrent vault balances: X=${amountX}, Y=${amountY}`));
        
        // For simplicity, we'll create a uniform distribution
        const numBins = parseInt(newUpper) - parseInt(newLower) + 1;
        console.log(chalk.gray(`Number of bins: ${numBins}`));
        
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
                // TODO
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
        
        // TODO: Admin function implementations...
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

    async testCancelQueuedWithdrawal() {
        console.log(chalk.blue("\n❌ Test Cancel Queued Withdrawal\n"));
        
        // First show what's queued
        const currentRound = await this.vault!.getCurrentRound();
        const queuedShares = await this.vault!.getQueuedWithdrawal(currentRound, this.signer.address);
        
        if (queuedShares === 0n) {
            console.log(chalk.yellow("You have no queued withdrawals in the current round"));
            return;
        }
        
        const decimals = Number(await this.vault!.decimals());
        const queuedFormatted = formatters.formatShareAmount(queuedShares, decimals);
        console.log(chalk.cyan(`Your queued withdrawal: ${queuedFormatted}`));
        
        // TODO: help the user enter a correct amount (writing a share amount in wei is not intuitive)
        // We can possibly refactor and then re-use the code for the "Queue Withdrawal" where we suggest amounts and offer the "max" option
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
            const [idleX, idleY] = await this.strategy!.getIdleBalances();
            
            console.log(chalk.white("Management:"));
            console.log(chalk.gray(`  Operator: ${operator}`));
            console.log(chalk.gray(`  Last Rebalance: ${new Date(Number(lastRebalance) * 1000).toLocaleString()}`));
            
            console.log(chalk.white("\nIdle Balances:"));
            console.log(chalk.gray(`  Token X: ${await formatters.formatBalance(idleX, this.tokenX!)}`));
            console.log(chalk.gray(`  Token Y: ${await formatters.formatBalance(idleY, this.tokenY!)}`));
            
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
        // Create readline interface for user input
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        vaultAddress = await new Promise<string>((resolve) => {
            rl.question(chalk.yellow("Enter OracleRewardVault address: "), (answer) => {
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
        console.error(chalk.red("\n❌ Fatal error:"), error);
        process.exit(1);
    });
}

export { MetropolisVaultTester, TestConfig };