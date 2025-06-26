/* eslint-disable no-console */
import hre from "hardhat";

async function main() {
  console.log("🏠 Deploying to local network...\n");
  
  // Ensure we're on localhost
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    throw new Error(`This script is for localhost only. Current network: ${hre.network.name}`);
  }
  
  // Note: No private key required for localhost - uses Hardhat's built-in accounts
  
  // Import required functions
  const { deployArcaSystem } = await import("./deployArcaSystem");
  const { loadNetworkConfig, networkConfigToDeploymentConfig } = await import("./utils/network-config");
  const { deployMockContracts } = await import("./setup-local-mocks");
  
  console.log("\n📦 Setting up mock contracts for local testing...");
  const mockContracts = await deployMockContracts();
  
  // Load network configuration and deploy
  const networkConfig = loadNetworkConfig("localhost");
  let deploymentConfig = networkConfigToDeploymentConfig(networkConfig);
  
  // Update deployment config with mock addresses
  deploymentConfig = {
    ...deploymentConfig,
    tokenX: mockContracts.tokenX,
    tokenY: mockContracts.tokenY,
    rewardToken: mockContracts.rewardToken,
    lbRouter: mockContracts.lbRouter,
    lbpAMM: mockContracts.lbPair,
    lbpContract: mockContracts.lbPair,
    rewarder: mockContracts.rewarder,
    nativeToken: mockContracts.tokenX,
    lbpContractUSD: mockContracts.lbPair,
  };
  
  // Deploy Arca system
  const addresses = await deployArcaSystem(deploymentConfig);
  
  console.log("\n✅ Local deployment completed successfully!");
  console.log("\nDeployment addresses:", JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});