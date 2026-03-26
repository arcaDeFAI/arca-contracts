import { ethers, network } from "hardhat";
import readline from "readline";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import type {
    VaultFactory,
    ILBPair,
    IRamsesV3Pool,
    OracleRewardVault,
    OracleRewardShadowVault,
    ShadowStrategy
} from "../typechain-types";
import type { IERC20MetadataUpgradeable } from "../typechain-types/@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { Contract, ContractTransactionResponse, TransactionResponse, TransactionReceipt } from "ethers";

// ================================
// Types and Interfaces
// ================================
interface VaultFactoryConfig {
    factoryAddress: string;
    signer: SignerWithAddress;
    dryRun: boolean;
    exportPath: string;
}

interface GasTransaction {
    name: string;
    gasUsed: bigint;
    gasPrice: bigint;
    cost: bigint;
    txHash: string;
    category: "deployment" | "configuration" | "admin";
}

interface DeploymentResult {
    vault: string;
    strategy: string;
    txHash: string;
    gasUsed: bigint;
    cost: string;
}

enum VaultType {
    None = 0,
    Simple = 1,
    Oracle = 2,
    OracleReward = 3,
    ShadowOracleReward = 4
}

enum StrategyType {
    None = 0,
    Default = 1, // Default for Metropolis Maker Vaults
    Shadow = 2
}

// ================================
// Gas Tracking Utility
// ================================
class GasTracker {
    private transactions: GasTransaction[] = [];

    async trackTransaction(name: string, txResponse: TransactionResponse, category: "deployment" | "configuration" | "admin" = "configuration"): Promise<TransactionReceipt> {
        const receipt = await txResponse.wait();
        if (!receipt) {
            throw new Error(`Failed to get receipt for transaction: ${name}`);
        }

        this.addTransaction(name, receipt, category);
        return receipt;
    }

    private addTransaction(name: string, receipt: TransactionReceipt, category: "deployment" | "configuration" | "admin") {
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || BigInt(0);
        const cost = gasUsed * gasPrice;

        this.transactions.push({
            name,
            gasUsed,
            gasPrice,
            cost,
            txHash: receipt.hash,
            category
        });

        console.log(chalk.gray(`  ⛽ Gas used: ${gasUsed.toString()}, Cost: ${ethers.formatEther(cost)} S`));
    }

    getReport() {
        if (this.transactions.length === 0) return null;

        const totalGas = this.transactions.reduce((sum, tx) => sum + tx.gasUsed, BigInt(0));
        const totalCost = this.transactions.reduce((sum, tx) => sum + tx.cost, BigInt(0));

        console.log(chalk.blue("\n💰 GAS USAGE SUMMARY"));
        console.log("=".repeat(50));
        console.log(chalk.gray(`Total Gas Used: ${totalGas.toLocaleString()}`));
        console.log(chalk.gray(`Total Cost: ${ethers.formatEther(totalCost)} S`));

        if (this.transactions.length > 0 && this.transactions[0].gasPrice > BigInt(0)) {
            const avgGasPrice = this.transactions.reduce((sum, tx) => sum + tx.gasPrice, BigInt(0)) / BigInt(this.transactions.length);
            console.log(chalk.gray(`Average Gas Price: ${ethers.formatUnits(avgGasPrice, "gwei")} Gwei`));
        }

        console.log("=".repeat(50));

        return {
            totalGas,
            totalCost,
            totalCostInS: ethers.formatEther(totalCost),
            transactionCount: this.transactions.length
        };
    }

    exportToFile(filePath: string) {
        const data = {
            timestamp: new Date().toISOString(),
            network: network.name,
            transactions: this.transactions.map(tx => ({
                ...tx,
                gasUsed: tx.gasUsed.toString(),
                gasPrice: tx.gasPrice.toString(),
                cost: tx.cost.toString()
            }))
        };

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(chalk.green(`\n📊 Gas report exported to: ${filePath}`));
    }
}

// ================================
// Main VaultFactory CLI Class
// ================================
class VaultFactoryCLI {
    private rl: readline.Interface;
    private config: VaultFactoryConfig;
    private factory?: VaultFactory;
    private gasTracker: GasTracker;

    constructor(config: VaultFactoryConfig) {
        this.config = config;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.gasTracker = new GasTracker();
    }

    async initialize() {
        console.log(chalk.blue("\n🏭 Initializing Vault Factory CLI...\n"));

        try {
            console.log(chalk.gray("Loading VaultFactory contract..."));
            this.factory = await ethers.getContractAt("VaultFactory", this.config.factoryAddress, this.config.signer);
            console.log(chalk.gray(`✓ VaultFactory loaded at: ${await this.factory.getAddress()}`));

            // Verify we can access the factory
            const owner = await this.factory.owner();
            console.log(chalk.gray(`✓ Factory owner: ${owner}`));
            console.log(chalk.gray(`✓ Your address: ${this.config.signer.address}`));

            if (owner.toLowerCase() !== this.config.signer.address.toLowerCase()) {
                console.log(chalk.yellow(`⚠️  You are not the factory owner. Some operations may fail.`));
            }

            console.log(chalk.green("\n✅ VaultFactory CLI initialized successfully"));
        } catch (error) {
            console.error(chalk.red("\n❌ Failed to initialize VaultFactory CLI:"), error);
            throw error;
        }
    }

    async question(prompt: string): Promise<string> {
        return new Promise((resolve) => {
            this.rl.question(chalk.yellow(prompt), (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async questionWithDefault(prompt: string, defaultValue: string, formatDefault?: string): Promise<string> {
        const formattedDefault = formatDefault || defaultValue;
        const fullPrompt = `${prompt} [${chalk.gray(formattedDefault)}]: `;

        const answer = await this.question(fullPrompt);
        return answer || defaultValue;
    }

    async confirm(prompt: string): Promise<boolean> {
        const answer = await this.question(`${prompt} (y/n): `);
        return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    }

    async executeWithGasTracking(
        actionName: string,
        actionFn: () => Promise<ContractTransactionResponse>,
        category: "deployment" | "configuration" | "admin" = "configuration"
    ): Promise<TransactionReceipt> {
        if (this.config.dryRun) {
            console.log(chalk.yellow(`\n🔍 DRY RUN: Would execute ${actionName}`));
            return {} as TransactionReceipt; // Mock receipt for dry run
        }

        console.log(chalk.blue(`\n📤 Executing: ${actionName}...`));

        try {
            const tx = await actionFn();
            console.log(chalk.gray(`  Transaction hash: ${tx.hash}`));

            const receipt = await this.gasTracker.trackTransaction(actionName, tx, category);
            console.log(chalk.green(`✅ ${actionName} completed successfully`));

            return receipt;
        } catch (error) {
            console.error(chalk.red(`❌ ${actionName} failed:`), error);
            throw error;
        }
    }

    async registerContract(displayName: string, contract: Contract): Promise<void> {
        // Only register on sonic-mainnet
        if (network.name !== "sonic-mainnet") {
            console.log(chalk.gray(`⏭️  Skipping registerMe for ${displayName} (not on mainnet)`));
            return;
        }

        if (this.config.dryRun) {
            console.log(chalk.yellow(`\n🔍 DRY RUN: Would register ${displayName} on Sonic FeeM`));
            return;
        }

        try {
            console.log(chalk.blue(`\n📝 Registering ${displayName} on Sonic FeeM...`));
            const tx = await contract.registerMe();
            console.log(chalk.gray(`  Transaction hash: ${tx.hash}`));

            await this.gasTracker.trackTransaction(`Register ${displayName}`, tx, "configuration");
            console.log(chalk.green(`✅ ${displayName} registered successfully`));
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Failed to register ${displayName}:`), error);
            // Don't throw - registration failure shouldn't halt deployment
        }
    }

    async showFactoryInfo() {
        console.log(chalk.blue("\n🏭 Vault Factory Information\n"));

        try {
            const factoryAddress = await this.factory!.getAddress();
            const owner = await this.factory!.owner();
            const defaultOperator = await this.factory!.getDefaultOperator();
            const feeRecipient = await this.factory!.getFeeRecipient();
            const creationFee = await this.factory!.getCreationFee();
            const wnative = await this.factory!.getWNative();

            console.log(chalk.white("Basic Information:"));
            console.log(chalk.gray(`  Factory Address: ${factoryAddress}`));
            console.log(chalk.gray(`  Owner: ${owner}`));
            console.log(chalk.gray(`  Default Operator: ${defaultOperator}`));
            console.log(chalk.gray(`  Fee Recipient: ${feeRecipient}`));
            console.log(chalk.gray(`  Creation Fee: ${ethers.formatEther(creationFee)} S`));
            console.log(chalk.gray(`  Wrapped Native: ${wnative}`));

            // Shadow protocol addresses
            const shadowNPM = await this.factory!.getShadowNonfungiblePositionManager();
            const shadowVoter = await this.factory!.getShadowVoter();

            console.log(chalk.white("\nShadow Protocol:"));
            console.log(chalk.gray(`  Shadow NPM: ${shadowNPM}`));
            console.log(chalk.gray(`  Shadow Voter: ${shadowVoter}`));

            // Vault counts
            const simpleVaults = await this.factory!.getNumberOfVaults(VaultType.Simple);
            const oracleVaults = await this.factory!.getNumberOfVaults(VaultType.Oracle);
            const oracleRewardVaults = await this.factory!.getNumberOfVaults(VaultType.OracleReward);
            const shadowVaults = await this.factory!.getNumberOfVaults(VaultType.ShadowOracleReward);

            console.log(chalk.white("\nVault Statistics:"));
            console.log(chalk.gray(`  Simple Vaults: ${simpleVaults}`));
            console.log(chalk.gray(`  Oracle Vaults: ${oracleVaults}`));
            console.log(chalk.gray(`  Oracle Reward Vaults: ${oracleRewardVaults}`));
            console.log(chalk.gray(`  Shadow Oracle Reward Vaults: ${shadowVaults}`));

            // Strategy counts
            const defaultStrategies = await this.factory!.getNumberOfStrategies(StrategyType.Default);
            const shadowStrategies = await this.factory!.getNumberOfStrategies(StrategyType.Shadow);

            console.log(chalk.white("\nStrategy Statistics:"));
            console.log(chalk.gray(`  Default Strategies: ${defaultStrategies}`));
            console.log(chalk.gray(`  Shadow Strategies: ${shadowStrategies}`));

            // Implementation addresses
            const oracleVaultImpl = await this.factory!.getVaultImplementation(VaultType.Oracle);
            const shadowVaultImpl = await this.factory!.getVaultImplementation(VaultType.ShadowOracleReward);
            const defaultStrategyImpl = await this.factory!.getStrategyImplementation(StrategyType.Default);
            const shadowStrategyImpl = await this.factory!.getStrategyImplementation(StrategyType.Shadow);

            console.log(chalk.white("\nImplementation Addresses:"));
            console.log(chalk.gray(`  Oracle Vault Implementation: ${oracleVaultImpl}`));
            console.log(chalk.gray(`  Shadow Vault Implementation: ${shadowVaultImpl}`));
            console.log(chalk.gray(`  Default Strategy Implementation: ${defaultStrategyImpl}`));
            console.log(chalk.gray(`  Shadow Strategy Implementation: ${shadowStrategyImpl}`));

        } catch (error) {
            console.error(chalk.red("Error fetching factory info:"), error);
        }
    }

    async showMainMenu() {
        console.log(chalk.blue("\n=== Vault Factory Control Panel ===\n"));

        console.log(chalk.gray("🏭 Factory Operations"));
        console.log(chalk.gray("  1. View Factory Information"));
        console.log(chalk.gray("  2. List Vaults"));
        console.log(chalk.gray("  3. List Strategies"));

        console.log(chalk.gray("\n🚀 Vault Deployment"));
        console.log(chalk.gray("  4. Deploy Shadow Vault"));
        console.log(chalk.gray("  5. Deploy Metropolis Vault"));

        console.log(chalk.gray("\n🔧 Admin Functions"));
        console.log(chalk.gray("  6. Manage Operators"));
        console.log(chalk.gray("  7. Manage Fees"));
        console.log(chalk.gray("  8. Manage Whitelist"));
        console.log(chalk.gray("  9. Emergency Operations"));

        console.log(chalk.gray("\n📊 Utilities"));
        console.log(chalk.gray("  10. Export Gas Report"));
        console.log(chalk.gray("  0. Exit"));

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
                        await this.showFactoryInfo();
                        break;
                    case '2':
                        await this.listVaults();
                        break;
                    case '3':
                        await this.listStrategies();
                        break;
                    case '4':
                        await this.deployShadowVault();
                        break;
                    case '5':
                        await this.deployMetropolisVault();
                        break;
                    case '6':
                        await this.manageOperators();
                        break;
                    case '7':
                        await this.manageFees();
                        break;
                    case '8':
                        await this.manageWhitelist();
                        break;
                    case '9':
                        await this.emergencyOperations();
                        break;
                    case '10':
                        await this.exportGasReport();
                        break;
                    case '0':
                        running = false;
                        break;
                    default:
                        if (choice.trim() !== '') {
                            console.log(chalk.red("Invalid option"));
                        }
                }
            } catch (error) {
                console.error(chalk.red("\n❌ An error occurred:"), error);
                console.log(chalk.yellow("\nPress Enter to continue..."));
                await this.question("");
            }
        }

        this.rl.close();

        // Show final gas report
        const gasReport = this.gasTracker.getReport();
        if (gasReport) {
            console.log(chalk.green("\n✅ Session completed successfully!"));
        }
    }

    async listVaults() {
        console.log(chalk.blue("\n📋 Vault Listings\n"));

        try {
            console.log(chalk.white("Simple Vaults:"));
            const simpleCount = await this.factory!.getNumberOfVaults(VaultType.Simple);
            await this.displayVaultList(VaultType.Simple, Number(simpleCount));

            console.log(chalk.white("\nOracle Vaults:"));
            const oracleCount = await this.factory!.getNumberOfVaults(VaultType.Oracle);
            await this.displayVaultList(VaultType.Oracle, Number(oracleCount));

            console.log(chalk.white("\nOracle Reward Vaults:"));
            const oracleRewardCount = await this.factory!.getNumberOfVaults(VaultType.OracleReward);
            await this.displayVaultList(VaultType.OracleReward, Number(oracleRewardCount));

            console.log(chalk.white("\nShadow Oracle Reward Vaults:"));
            const shadowCount = await this.factory!.getNumberOfVaults(VaultType.ShadowOracleReward);
            await this.displayVaultList(VaultType.ShadowOracleReward, Number(shadowCount));

        } catch (error) {
            console.error(chalk.red("Error listing vaults:"), error);
        }
    }

    private async displayVaultList(vaultType: VaultType, count: number) {
        if (count === 0) {
            console.log(chalk.gray("  None"));
            return;
        }

        for (let i = 0; i < Math.min(count, 10); i++) { // Limit to first 10 for readability
            try {
                const vaultAddress = await this.factory!.getVaultAt(vaultType, i);
                console.log(chalk.gray(`  ${i}: ${vaultAddress}`));
            } catch (error) {
                console.log(chalk.gray(`  ${i}: Error loading vault`));
            }
        }

        if (count > 10) {
            console.log(chalk.gray(`  ... and ${count - 10} more`));
        }
    }

    async listStrategies() {
        console.log(chalk.blue("\n📋 Strategy Listings\n"));

        try {
            console.log(chalk.white("Default Strategies (Metropolis):"));
            const defaultCount = await this.factory!.getNumberOfStrategies(StrategyType.Default);
            await this.displayStrategyList(StrategyType.Default, Number(defaultCount));

            console.log(chalk.white("\nShadow Strategies:"));
            const shadowCount = await this.factory!.getNumberOfStrategies(StrategyType.Shadow);
            await this.displayStrategyList(StrategyType.Shadow, Number(shadowCount));

        } catch (error) {
            console.error(chalk.red("Error listing strategies:"), error);
        }
    }

    private async displayStrategyList(strategyType: StrategyType, count: number) {
        if (count === 0) {
            console.log(chalk.gray("  None"));
            return;
        }

        for (let i = 0; i < Math.min(count, 10); i++) { // Limit to first 10 for readability
            try {
                const strategyAddress = await this.factory!.getStrategyAt(strategyType, i);
                console.log(chalk.gray(`  ${i}: ${strategyAddress}`));
            } catch (error) {
                console.log(chalk.gray(`  ${i}: Error loading strategy`));
            }
        }

        if (count > 10) {
            console.log(chalk.gray(`  ... and ${count - 10} more`));
        }
    }

    async deployShadowVault() {
        console.log(chalk.blue("\n🚀 Deploy Shadow Oracle Reward Vault\n"));

        try {
            // Get pool address
            const poolAddress = await this.question("Enter Ramses V3 Pool address: ");
            if (!ethers.isAddress(poolAddress)) {
                console.log(chalk.red("❌ Invalid pool address"));
                return;
            }

            // Load pool contract to get token info
            console.log(chalk.gray("Loading pool information..."));
            const pool = await ethers.getContractAt("IRamsesV3Pool", poolAddress, this.config.signer);

            const token0Address = await pool.token0();
            const token1Address = await pool.token1();

            const token0 = await ethers.getContractAt("IERC20MetadataUpgradeable", token0Address, this.config.signer);
            const token1 = await ethers.getContractAt("IERC20MetadataUpgradeable", token1Address, this.config.signer);

            const token0Symbol = await token0.symbol();
            const token1Symbol = await token1.symbol();

            console.log(chalk.cyan("\n📊 Pool Information:"));
            console.log(chalk.gray(`  Pool: ${poolAddress}`));
            console.log(chalk.gray(`  Token0: ${token0Symbol} (${token0Address})`));
            console.log(chalk.gray(`  Token1: ${token1Symbol} (${token1Address})`));

            // Check if pool is whitelisted
            const isWhitelisted = await this.factory!.isPairWhitelisted(poolAddress);
            if (!isWhitelisted) {
                console.log(chalk.red("❌ Pool is not whitelisted"));
                console.log(chalk.yellow("💡 Use the whitelist management option first"));
                return;
            }
            console.log(chalk.green("✓ Pool is whitelisted"));

            // Get AUM fee
            const aumFeeStr = await this.questionWithDefault(
                "Enter AUM fee (basis points, e.g., 1000 = 10%)",
                "1000",
                "1000 (10%)"
            );
            const aumFee = parseInt(aumFeeStr);

            if (aumFee < 0 || aumFee > 3000) {
                console.log(chalk.red("❌ AUM fee must be between 0 and 3000 basis points (0-30%)"));
                return;
            }

            // Get TWAP interval
            const twapIntervalStr = await this.questionWithDefault(
                "Enter TWAP interval in seconds (0 for spot price)",
                "300",
                "300 (5 minutes)"
            );
            const twapInterval = parseInt(twapIntervalStr);

            if (twapInterval < 0) {
                console.log(chalk.red("❌ TWAP interval must be >= 0"));
                return;
            }

            // Validate TWAP requirements if interval > 0
            if (twapInterval > 0) {
                console.log(chalk.gray("Checking pool TWAP compatibility..."));
                const slot0 = await pool.slot0();
                const observationCardinality = slot0[2];

                if (observationCardinality < 10) {
                    console.log(chalk.red(`❌ Pool has insufficient observation cardinality (${observationCardinality})`));
                    console.log(chalk.yellow("💡 Pool needs at least 10 observation slots for TWAP"));
                    return;
                }
                console.log(chalk.green(`✓ Pool has sufficient observation cardinality (${observationCardinality})`));
            }

            // Get creation fee
            const creationFee = await this.factory!.getCreationFee();
            console.log(chalk.cyan(`\n💰 Creation fee required: ${ethers.formatEther(creationFee)} S`));

            // Show deployment summary
            console.log(chalk.cyan("\n📋 Deployment Summary:"));
            console.log(chalk.gray(`  Pool: ${token0Symbol}/${token1Symbol}`));
            console.log(chalk.gray(`  AUM Fee: ${aumFee} basis points (${aumFee/100}%)`));
            console.log(chalk.gray(`  TWAP Interval: ${twapInterval} seconds`));
            console.log(chalk.gray(`  Creation Fee: ${ethers.formatEther(creationFee)} S`));

            const confirmed = await this.confirm("\nProceed with deployment?");
            if (!confirmed) {
                console.log(chalk.yellow("Deployment cancelled"));
                return;
            }

            // Execute deployment
            const receipt = await this.executeWithGasTracking(
                "Deploy Shadow Oracle Reward Vault",
                async () => {
                    return this.factory!.createMarketMakerShadowOracleRewardVault(
                        poolAddress,
                        aumFee,
                        twapInterval,
                        { value: creationFee }
                    );
                },
                "deployment"
            );

            if (this.config.dryRun) return;

            // Parse deployment events to get vault and strategy addresses
            const events = receipt.logs.map(log => {
                try {
                    return this.factory!.interface.parseLog({
                        topics: [...log.topics],
                        data: log.data
                    });
                } catch {
                    return null;
                }
            }).filter(event => event !== null);

            let vaultAddress: string | undefined;
            let strategyAddress: string | undefined;

            for (const event of events) {
                if (event && event.name === 'VaultCreated') {
                    vaultAddress = event.args.vault;
                } else if (event && event.name === 'StrategyCreated') {
                    strategyAddress = event.args.strategy;
                }
            }

            if (vaultAddress && strategyAddress) {
                console.log(chalk.green("\n🎉 Deployment successful!"));
                console.log(chalk.cyan("📊 Deployment Results:"));
                console.log(chalk.gray(`  Vault Address: ${vaultAddress}`));
                console.log(chalk.gray(`  Strategy Address: ${strategyAddress}`));

                // Register vault and strategy on Sonic FeeM
                const vault = await ethers.getContractAt("OracleRewardShadowVault", vaultAddress, this.config.signer);
                const strategy = await ethers.getContractAt("ShadowStrategy", strategyAddress, this.config.signer);

                await this.registerContract("Shadow Vault", vault);
                await this.registerContract("Shadow Strategy", strategy);

                // Save to cache for easy access
                const cacheDir = path.join(__dirname, "../cache");
                if (!fs.existsSync(cacheDir)) {
                    fs.mkdirSync(cacheDir, { recursive: true });
                }

                const deploymentInfo = {
                    vault: vaultAddress,
                    strategy: strategyAddress,
                    pool: poolAddress,
                    token0: `${token0Symbol} (${token0Address})`,
                    token1: `${token1Symbol} (${token1Address})`,
                    aumFee,
                    twapInterval,
                    timestamp: new Date().toISOString(),
                    network: network.name
                };

                fs.writeFileSync(
                    path.join(cacheDir, "latest-shadow-vault.json"),
                    JSON.stringify(deploymentInfo, null, 2)
                );

                console.log(chalk.green(`💾 Deployment info saved to cache/latest-shadow-vault.json`));
            } else {
                console.log(chalk.yellow("⚠️ Deployment completed but couldn't parse addresses from events"));
            }

        } catch (error) {
            console.error(chalk.red("❌ Shadow vault deployment failed:"), error);
        }
    }

    async deployMetropolisVault() {
        console.log(chalk.blue("\n🚀 Deploy Metropolis Oracle Vault\n"));

        try {
            // Get LBPair address
            const lbPairAddress = await this.question("Enter LBPair address: ");
            if (!ethers.isAddress(lbPairAddress)) {
                console.log(chalk.red("❌ Invalid LBPair address"));
                return;
            }

            // Load LBPair contract to get token info
            console.log(chalk.gray("Loading LBPair information..."));
            const lbPair = await ethers.getContractAt("ILBPair", lbPairAddress, this.config.signer);

            const tokenXAddress = await lbPair.getTokenX();
            const tokenYAddress = await lbPair.getTokenY();

            const tokenX = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenXAddress, this.config.signer);
            const tokenY = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenYAddress, this.config.signer);

            const tokenXSymbol = await tokenX.symbol();
            const tokenYSymbol = await tokenY.symbol();

            console.log(chalk.cyan("\n📊 LBPair Information:"));
            console.log(chalk.gray(`  LBPair: ${lbPairAddress}`));
            console.log(chalk.gray(`  TokenX: ${tokenXSymbol} (${tokenXAddress})`));
            console.log(chalk.gray(`  TokenY: ${tokenYSymbol} (${tokenYAddress})`));

            // Check if pair is whitelisted
            const isWhitelisted = await this.factory!.isPairWhitelisted(lbPairAddress);
            if (!isWhitelisted) {
                console.log(chalk.red("❌ LBPair is not whitelisted"));
                console.log(chalk.yellow("💡 Use the whitelist management option first"));
                return;
            }
            console.log(chalk.green("✓ LBPair is whitelisted"));

            // Check TWAP oracle size
            const oracleParams = await lbPair.getOracleParameters();
            const oracleSize = oracleParams[1]; // size is at index 1

            if (oracleSize === 0) {
                console.log(chalk.red("❌ LBPair has no TWAP oracle configured"));
                console.log(chalk.yellow("💡 LBPair must have TWAP oracle for Oracle Vault"));
                return;
            }
            console.log(chalk.green(`✓ LBPair has TWAP oracle (size: ${oracleSize})`));

            // Get AUM fee
            const aumFeeStr = await this.questionWithDefault(
                "Enter AUM fee (basis points, e.g., 1000 = 10%)",
                "1000",
                "1000 (10%)"
            );
            const aumFee = parseInt(aumFeeStr);

            if (aumFee < 0 || aumFee > 3000) {
                console.log(chalk.red("❌ AUM fee must be between 0 and 3000 basis points (0-30%)"));
                return;
            }

            // Get creation fee
            const creationFee = await this.factory!.getCreationFee();
            console.log(chalk.cyan(`\n💰 Creation fee required: ${ethers.formatEther(creationFee)} S`));

            // Show deployment summary
            console.log(chalk.cyan("\n📋 Deployment Summary:"));
            console.log(chalk.gray(`  LBPair: ${tokenXSymbol}/${tokenYSymbol}`));
            console.log(chalk.gray(`  AUM Fee: ${aumFee} basis points (${aumFee/100}%)`));
            console.log(chalk.gray(`  Creation Fee: ${ethers.formatEther(creationFee)} S`));

            const confirmed = await this.confirm("\nProceed with deployment?");
            if (!confirmed) {
                console.log(chalk.yellow("Deployment cancelled"));
                return;
            }

            // Execute deployment
            const receipt = await this.executeWithGasTracking(
                "Deploy Metropolis Oracle Vault",
                async () => {
                    return this.factory!.createMarketMakerOracleVault(
                        lbPair,
                        aumFee,
                        { value: creationFee }
                    );
                },
                "deployment"
            );

            if (this.config.dryRun) return;

            // Parse deployment events to get vault and strategy addresses
            const events = receipt.logs.map(log => {
                try {
                    return this.factory!.interface.parseLog({
                        topics: [...log.topics],
                        data: log.data
                    });
                } catch {
                    return null;
                }
            }).filter(event => event !== null);

            let vaultAddress: string | undefined;
            let strategyAddress: string | undefined;

            for (const event of events) {
                if (event && event.name === 'VaultCreated') {
                    vaultAddress = event.args.vault;
                } else if (event && event.name === 'StrategyCreated') {
                    strategyAddress = event.args.strategy;
                }
            }

            if (vaultAddress && strategyAddress) {
                console.log(chalk.green("\n🎉 Deployment successful!"));
                console.log(chalk.cyan("📊 Deployment Results:"));
                console.log(chalk.gray(`  Vault Address: ${vaultAddress}`));
                console.log(chalk.gray(`  Strategy Address: ${strategyAddress}`));

                // Register vault and strategy on Sonic FeeM
                const vault = await ethers.getContractAt("OracleRewardVault", vaultAddress, this.config.signer);
                const strategy = await ethers.getContractAt("MetropolisStrategy", strategyAddress, this.config.signer);

                await this.registerContract("Metropolis Vault", vault);
                await this.registerContract("Metropolis Strategy", strategy);

                // Save to cache for easy access
                const cacheDir = path.join(__dirname, "../cache");
                if (!fs.existsSync(cacheDir)) {
                    fs.mkdirSync(cacheDir, { recursive: true });
                }

                const deploymentInfo = {
                    vault: vaultAddress,
                    strategy: strategyAddress,
                    lbPair: lbPairAddress,
                    tokenX: `${tokenXSymbol} (${tokenXAddress})`,
                    tokenY: `${tokenYSymbol} (${tokenYAddress})`,
                    aumFee,
                    timestamp: new Date().toISOString(),
                    network: network.name
                };

                fs.writeFileSync(
                    path.join(cacheDir, "latest-metropolis-vault.json"),
                    JSON.stringify(deploymentInfo, null, 2)
                );

                console.log(chalk.green(`💾 Deployment info saved to cache/latest-metropolis-vault.json`));
            } else {
                console.log(chalk.yellow("⚠️ Deployment completed but couldn't parse addresses from events"));
            }

        } catch (error) {
            console.error(chalk.red("❌ Metropolis vault deployment failed:"), error);
        }
    }

    async manageOperators() {
        console.log(chalk.blue("\n👥 Operator Management\n"));

        console.log(chalk.gray("1. View Default Operator"));
        console.log(chalk.gray("2. Set Default Operator"));
        console.log(chalk.gray("3. Set Strategy Operator"));
        console.log(chalk.gray("4. Back"));

        const choice = await this.question("\nSelect option: ");

        switch (choice) {
            case '1':
                await this.viewDefaultOperator();
                break;
            case '2':
                await this.setDefaultOperator();
                break;
            case '3':
                await this.setStrategyOperator();
                break;
        }
    }

    private async viewDefaultOperator() {
        try {
            const defaultOperator = await this.factory!.getDefaultOperator();
            console.log(chalk.cyan(`\nDefault Operator: ${defaultOperator}`));
        } catch (error) {
            console.error(chalk.red("Error viewing default operator:"), error);
        }
    }

    private async setDefaultOperator() {
        try {
            const currentOperator = await this.factory!.getDefaultOperator();
            console.log(chalk.cyan(`Current Default Operator: ${currentOperator}`));

            const newOperator = await this.question("Enter new default operator address: ");
            if (!ethers.isAddress(newOperator)) {
                console.log(chalk.red("❌ Invalid address"));
                return;
            }

            const confirmed = await this.confirm(`Set default operator to ${newOperator}?`);
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Set Default Operator",
                async () => {
                    return this.factory!.setDefaultOperator(newOperator);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error setting default operator:"), error);
        }
    }

    private async setStrategyOperator() {
        try {
            const strategyAddress = await this.question("Enter strategy address: ");
            if (!ethers.isAddress(strategyAddress)) {
                console.log(chalk.red("❌ Invalid strategy address"));
                return;
            }

            const newOperator = await this.question("Enter new operator address: ");
            if (!ethers.isAddress(newOperator)) {
                console.log(chalk.red("❌ Invalid operator address"));
                return;
            }

            // Get strategy contract to show current operator
            const strategy = await ethers.getContractAt("IStrategyCommon", strategyAddress, this.config.signer);
            const currentOperator = await strategy.getOperator();

            console.log(chalk.cyan(`Current Operator: ${currentOperator}`));
            console.log(chalk.cyan(`New Operator: ${newOperator}`));

            const confirmed = await this.confirm("Update strategy operator?");
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Set Strategy Operator",
                async () => {
                    return this.factory!.setOperator(strategy, newOperator);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error setting strategy operator:"), error);
        }
    }

    async manageFees() {
        console.log(chalk.blue("\n💰 Fee Management\n"));

        console.log(chalk.gray("1. View Creation Fee"));
        console.log(chalk.gray("2. Set Creation Fee"));
        console.log(chalk.gray("3. View Fee Recipient"));
        console.log(chalk.gray("4. Set Fee Recipient"));
        console.log(chalk.gray("5. Set Pending AUM Fee"));
        console.log(chalk.gray("6. Reset Pending AUM Fee"));
        console.log(chalk.gray("7. Back"));

        const choice = await this.question("\nSelect option: ");

        switch (choice) {
            case '1':
                await this.viewCreationFee();
                break;
            case '2':
                await this.setCreationFee();
                break;
            case '3':
                await this.viewFeeRecipient();
                break;
            case '4':
                await this.setFeeRecipient();
                break;
            case '5':
                await this.setPendingAumFee();
                break;
            case '6':
                await this.resetPendingAumFee();
                break;
        }
    }

    private async viewCreationFee() {
        try {
            const creationFee = await this.factory!.getCreationFee();
            console.log(chalk.cyan(`\nCreation Fee: ${ethers.formatEther(creationFee)} S`));
        } catch (error) {
            console.error(chalk.red("Error viewing creation fee:"), error);
        }
    }

    private async setCreationFee() {
        try {
            const currentFee = await this.factory!.getCreationFee();
            console.log(chalk.cyan(`Current Creation Fee: ${ethers.formatEther(currentFee)} S`));

            const newFeeStr = await this.question("Enter new creation fee (in S): ");
            const newFee = ethers.parseEther(newFeeStr);

            const confirmed = await this.confirm(`Set creation fee to ${ethers.formatEther(newFee)} S?`);
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Set Creation Fee",
                async () => {
                    return this.factory!.setCreationFee(newFee);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error setting creation fee:"), error);
        }
    }

    private async viewFeeRecipient() {
        try {
            const feeRecipient = await this.factory!.getFeeRecipient();
            console.log(chalk.cyan(`\nFee Recipient: ${feeRecipient}`));
        } catch (error) {
            console.error(chalk.red("Error viewing fee recipient:"), error);
        }
    }

    private async setFeeRecipient() {
        try {
            const currentRecipient = await this.factory!.getFeeRecipient();
            console.log(chalk.cyan(`Current Fee Recipient: ${currentRecipient}`));

            const newRecipient = await this.question("Enter new fee recipient address: ");
            if (!ethers.isAddress(newRecipient)) {
                console.log(chalk.red("❌ Invalid address"));
                return;
            }

            const confirmed = await this.confirm(`Set fee recipient to ${newRecipient}?`);
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Set Fee Recipient",
                async () => {
                    return this.factory!.setFeeRecipient(newRecipient);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error setting fee recipient:"), error);
        }
    }

    private async setPendingAumFee() {
        try {
            const vaultAddress = await this.question("Enter vault address: ");
            if (!ethers.isAddress(vaultAddress)) {
                console.log(chalk.red("❌ Invalid vault address"));
                return;
            }

            const aumFeeStr = await this.question("Enter pending AUM fee (basis points, e.g., 1000 = 10%): ");
            const aumFee = parseInt(aumFeeStr);

            if (aumFee < 0 || aumFee > 3000) {
                console.log(chalk.red("❌ AUM fee must be between 0 and 3000 basis points"));
                return;
            }

            const vault = await ethers.getContractAt("IMinimalVault", vaultAddress, this.config.signer);

            const confirmed = await this.confirm(`Set pending AUM fee to ${aumFee} basis points (${aumFee/100}%)?`);
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Set Pending AUM Fee",
                async () => {
                    return this.factory!.setPendingAumAnnualFee(vault, aumFee);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error setting pending AUM fee:"), error);
        }
    }

    private async resetPendingAumFee() {
        try {
            const vaultAddress = await this.question("Enter vault address: ");
            if (!ethers.isAddress(vaultAddress)) {
                console.log(chalk.red("❌ Invalid vault address"));
                return;
            }

            const vault = await ethers.getContractAt("IMinimalVault", vaultAddress, this.config.signer);

            const confirmed = await this.confirm("Reset pending AUM fee?");
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Reset Pending AUM Fee",
                async () => {
                    return this.factory!.resetPendingAumAnnualFee(vault);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error resetting pending AUM fee:"), error);
        }
    }

    async manageWhitelist() {
        console.log(chalk.blue("\n📝 Whitelist Management\n"));

        console.log(chalk.gray("1. Check Pair Whitelist Status"));
        console.log(chalk.gray("2. Add Pairs to Whitelist"));
        console.log(chalk.gray("3. Remove Pairs from Whitelist"));
        console.log(chalk.gray("4. Back"));

        const choice = await this.question("\nSelect option: ");

        switch (choice) {
            case '1':
                await this.checkWhitelistStatus();
                break;
            case '2':
                await this.addToWhitelist();
                break;
            case '3':
                await this.removeFromWhitelist();
                break;
        }
    }

    private async checkWhitelistStatus() {
        try {
            const pairAddress = await this.question("Enter pair address to check: ");
            if (!ethers.isAddress(pairAddress)) {
                console.log(chalk.red("❌ Invalid pair address"));
                return;
            }

            const isWhitelisted = await this.factory!.isPairWhitelisted(pairAddress);
            console.log(chalk.cyan(`\nPair ${pairAddress} is ${isWhitelisted ? 'WHITELISTED' : 'NOT WHITELISTED'}`));

        } catch (error) {
            console.error(chalk.red("Error checking whitelist status:"), error);
        }
    }

    private async addToWhitelist() {
        try {
            const pairAddressesStr = await this.question("Enter pair addresses (comma-separated): ");
            const pairAddresses = pairAddressesStr.split(',').map(addr => addr.trim());

            // Validate addresses
            for (const addr of pairAddresses) {
                if (!ethers.isAddress(addr)) {
                    console.log(chalk.red(`❌ Invalid address: ${addr}`));
                    return;
                }
            }

            console.log(chalk.cyan("\n📋 Pairs to whitelist:"));
            pairAddresses.forEach(addr => {
                console.log(chalk.gray(`  ${addr}`));
            });

            const confirmed = await this.confirm("Add these pairs to whitelist?");
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Add Pairs to Whitelist",
                async () => {
                    return this.factory!.setPairWhitelist(pairAddresses, true);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error adding pairs to whitelist:"), error);
        }
    }

    private async removeFromWhitelist() {
        try {
            const pairAddressesStr = await this.question("Enter pair addresses to remove (comma-separated): ");
            const pairAddresses = pairAddressesStr.split(',').map(addr => addr.trim());

            // Validate addresses
            for (const addr of pairAddresses) {
                if (!ethers.isAddress(addr)) {
                    console.log(chalk.red(`❌ Invalid address: ${addr}`));
                    return;
                }
            }

            console.log(chalk.cyan("\n📋 Pairs to remove from whitelist:"));
            pairAddresses.forEach(addr => {
                console.log(chalk.gray(`  ${addr}`));
            });

            const confirmed = await this.confirm("Remove these pairs from whitelist?");
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Remove Pairs from Whitelist",
                async () => {
                    return this.factory!.setPairWhitelist(pairAddresses, false);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error removing pairs from whitelist:"), error);
        }
    }

    async emergencyOperations() {
        console.log(chalk.blue("\n🚨 Emergency Operations\n"));

        console.log(chalk.red("⚠️  WARNING: These operations can significantly impact vault operations"));
        console.log(chalk.gray("1. Set Emergency Mode"));
        console.log(chalk.gray("2. Cancel Shutdown"));
        console.log(chalk.gray("3. Recover ERC20 Tokens"));
        console.log(chalk.gray("4. Back"));

        const choice = await this.question("\nSelect option: ");

        switch (choice) {
            case '1':
                await this.setEmergencyMode();
                break;
            case '2':
                await this.cancelShutdown();
                break;
            case '3':
                await this.recoverERC20();
                break;
        }
    }

    private async setEmergencyMode() {
        try {
            const vaultAddress = await this.question("Enter vault address: ");
            if (!ethers.isAddress(vaultAddress)) {
                console.log(chalk.red("❌ Invalid vault address"));
                return;
            }

            console.log(chalk.red("\n⚠️  CRITICAL WARNING:"));
            console.log(chalk.red("Setting emergency mode will:"));
            console.log(chalk.red("• Withdraw ALL funds from strategy"));
            console.log(chalk.red("• Set strategy to address(0)"));
            console.log(chalk.red("• Disable new deposits"));
            console.log(chalk.red("• Allow only emergency withdrawals"));
            console.log(chalk.red("• This action is IRREVERSIBLE"));

            const vault = await ethers.getContractAt("IMinimalVault", vaultAddress, this.config.signer);

            const confirmed = await this.confirm("Proceed with setting emergency mode?");
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            const doubleConfirmed = await this.confirm("Are you absolutely sure? This action cannot be undone!");
            if (!doubleConfirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Set Emergency Mode",
                async () => {
                    return this.factory!.setEmergencyMode(vault);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error setting emergency mode:"), error);
        }
    }

    private async cancelShutdown() {
        try {
            const vaultAddress = await this.question("Enter oracle vault address: ");
            if (!ethers.isAddress(vaultAddress)) {
                console.log(chalk.red("❌ Invalid vault address"));
                return;
            }

            const confirmed = await this.confirm("Cancel vault shutdown?");
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Cancel Shutdown",
                async () => {
                    return this.factory!.cancelShutdown(vaultAddress);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error cancelling shutdown:"), error);
        }
    }

    private async recoverERC20() {
        try {
            const vaultAddress = await this.question("Enter vault address: ");
            if (!ethers.isAddress(vaultAddress)) {
                console.log(chalk.red("❌ Invalid vault address"));
                return;
            }

            const tokenAddress = await this.question("Enter token address to recover: ");
            if (!ethers.isAddress(tokenAddress)) {
                console.log(chalk.red("❌ Invalid token address"));
                return;
            }

            const recipient = await this.question("Enter recipient address: ");
            if (!ethers.isAddress(recipient)) {
                console.log(chalk.red("❌ Invalid recipient address"));
                return;
            }

            const amountStr = await this.question("Enter amount to recover (in wei): ");
            const amount = BigInt(amountStr);

            const vault = await ethers.getContractAt("IMinimalVault", vaultAddress, this.config.signer);
            const token = await ethers.getContractAt("IERC20Upgradeable", tokenAddress, this.config.signer);

            console.log(chalk.cyan("\n📋 Recovery Summary:"));
            console.log(chalk.gray(`  Vault: ${vaultAddress}`));
            console.log(chalk.gray(`  Token: ${tokenAddress}`));
            console.log(chalk.gray(`  Recipient: ${recipient}`));
            console.log(chalk.gray(`  Amount: ${amount.toString()} wei`));

            const confirmed = await this.confirm("Proceed with token recovery?");
            if (!confirmed) {
                console.log(chalk.yellow("Operation cancelled"));
                return;
            }

            await this.executeWithGasTracking(
                "Recover ERC20",
                async () => {
                    return this.factory!.recoverERC20(vault, token, recipient, amount);
                },
                "admin"
            );

        } catch (error) {
            console.error(chalk.red("Error recovering ERC20:"), error);
        }
    }

    async exportGasReport() {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `vault-factory-gas-report-${timestamp}.json`;
        const filepath = path.join(this.config.exportPath, filename);

        this.gasTracker.exportToFile(filepath);
    }
}

// ================================
// Main Function
// ================================
async function main() {
    console.log(chalk.blue.bold("\n🏭 Vault Factory Control Panel\n"));

    // Get network info
    console.log(chalk.gray(`Network: ${network.name}`));
    console.log(chalk.gray(`Chain ID: ${network.config.chainId}\n`));

    // Get signers
    const [signer] = await ethers.getSigners();
    console.log(chalk.gray(`Signer: ${signer.address}\n`));

    // Load factory address from deployment file
    let factoryAddress: string;
    const deploymentPath = path.join(__dirname, "../deployments", `metropolis-${network.name}.json`);

    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        factoryAddress = deployment.addresses?.vaultFactory;

        if (!factoryAddress || factoryAddress === ethers.ZeroAddress) {
            console.error(chalk.red("\n❌ VaultFactory address not found in deployment file"));
            process.exit(1);
        }

        console.log(chalk.gray(`✓ VaultFactory address loaded: ${factoryAddress}`));
    } else {
        console.error(chalk.red(`\n❌ Deployment file not found: ${deploymentPath}`));
        process.exit(1);
    }

    // Configuration
    const config: VaultFactoryConfig = {
        factoryAddress,
        signer,
        dryRun: false,
        exportPath: path.join(__dirname, "../gas-reports")
    };

    // Create export directory if it doesn't exist
    if (!fs.existsSync(config.exportPath)) {
        fs.mkdirSync(config.exportPath, { recursive: true });
    }

    // Create and run CLI
    const cli = new VaultFactoryCLI(config);
    await cli.run();

    console.log(chalk.green("\n✅ VaultFactory CLI session complete!\n"));
}

// Run the script
if (require.main === module) {
    main().catch((error) => {
        console.error(chalk.red("\n❌ Fatal error:"), error);
        process.exit(1);
    });
}

export { VaultFactoryCLI, VaultFactoryConfig };