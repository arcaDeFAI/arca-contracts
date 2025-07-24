import { ethers, network } from "hardhat";
import { deployArcaSystem } from "./deployArcaSystem";
import { loadNetworkConfig, networkConfigToDeploymentConfig, validateDeploymentConfig } from "./utils/network-config";
import { deployMockContracts } from "./archive/utils/deploy-mocks";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log(`\n📦 Deploying Arca System to ${network.name}...`);
  console.log(`Chain ID: ${network.config.chainId}`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  try {
    // Load network configuration
    const networkConfig = loadNetworkConfig(network.name);
    let deploymentConfig = networkConfigToDeploymentConfig(networkConfig);
    
    // Handle localhost/hardhat mock deployment
    if (network.name === "localhost" || network.name === "hardhat") {
      console.log("🎭 Deploying mock contracts for local development...\n");
      
      const mockAddresses = await deployMockContracts(
        deployer,
        networkConfig.mockTokens!,
        networkConfig.testAccounts!
      );
      
      // Override config with mock addresses
      deploymentConfig = {
        ...deploymentConfig,
        ...mockAddresses
      };
      
      console.log("✅ Mock contracts deployed successfully\n");
    }
    
    // Validate configuration before deployment
    validateDeploymentConfig(deploymentConfig, network.name);
    
    // For fork and testnet networks, verify contracts exist
    if (network.name === "sonic-fork" || network.name === "sonic-testnet") {
      const networkType = network.name === "sonic-fork" ? "mainnet contracts on fork" : "testnet contracts";
      console.log(`🔍 Verifying ${networkType} exist...\n`);
      
      const contractsToVerify = [
        { name: "LB Router", address: deploymentConfig.lbRouter },
        { name: "LB Pair", address: deploymentConfig.lbpContract },
        { name: "Token X", address: deploymentConfig.tokenX },
        { name: "Token Y", address: deploymentConfig.tokenY },
        { name: "Reward Token", address: deploymentConfig.rewardToken }
      ];
      
      for (const contract of contractsToVerify) {
        const code = await ethers.provider.getCode(contract.address);
        if (code === "0x") {
          throw new Error(`${contract.name} not found at ${contract.address}`);
        }
        console.log(`✓ ${contract.name}: ${contract.address}`);
      }
      
      console.log(`\n✅ All ${networkType} verified\n`);
    }
    
    // Deploy Arca system
    console.log("🚀 Deploying Arca contracts...\n");
    const deployment = await deployArcaSystem(deploymentConfig);
    
    console.log("\n✅ Arca system deployed successfully!");
    console.log("\n📋 Deployment Summary:");
    console.log("====================");
    console.log(`Vault: ${deployment.vault}`);
    console.log(`Queue Handler: ${deployment.queueHandler}`);
    console.log(`Fee Manager: ${deployment.feeManager}`);
    console.log(`Reward Claimer: ${deployment.rewardClaimer}`);
    console.log(`Registry: ${deployment.registry}`);
    
    // Save deployment artifacts
    const deploymentsDir = path.join(__dirname, "..", "deployments", network.name);
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const deploymentData = {
      network: network.name,
      chainId: network.config.chainId,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployment,
      config: {
        ...deploymentConfig,
        // Convert BigInt values to strings for JSON serialization
        amountXMin: deploymentConfig.amountXMin.toString(),
        amountYMin: deploymentConfig.amountYMin.toString(),
        idSlippage: deploymentConfig.idSlippage.toString()
      },
      version: "1.0.0"
    };
    
    // Save timestamped version
    fs.writeFileSync(
      path.join(deploymentsDir, `deployment-${timestamp}.json`),
      JSON.stringify(deploymentData, null, 2)
    );
    
    // Save latest version
    fs.writeFileSync(
      path.join(deploymentsDir, "latest.json"),
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log(`\n💾 Deployment artifacts saved to deployments/${network.name}/`);
    
    // Display next steps
    console.log("\n📝 Next Steps:");
    console.log("=============");
    
    if (network.name === "localhost" || network.name === "hardhat") {
      console.log("1. Verify deployment: npm run deploy:verify:local");
      console.log("2. Run integration tests: npm run deploy:test:local");
      console.log("3. Export addresses for UI: npm run deploy:export");
      console.log("4. Start the UI: cd UI && npm run dev");
    } else if (network.name === "sonic-fork") {
      console.log("1. Verify deployment: npm run deploy:verify:fork");
      console.log("2. Run integration tests: npm run deploy:test:fork");
      console.log("3. When ready, deploy to mainnet: npm run deploy:mainnet");
    } else if (network.name.includes("mainnet")) {
      console.log("1. Verify deployment: npm run deploy:verify:mainnet");
      console.log("2. Verify contracts on block explorer");
      console.log("3. Transfer ownership to multisig");
      console.log("4. Configure monitoring and alerts");
      console.log("5. Update UI with production addresses: npm run deploy:export");
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("\n❌ Deployment failed:", errorMessage);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});