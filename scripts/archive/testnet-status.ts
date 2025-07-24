import { ethers, network } from "hardhat";
import { loadNetworkConfig } from "./utils/multi-vault-config";
import { getEnabledVaults, getTokenSymbolPair, shouldDeployToken } from "./types/config";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log(`\n📊 Sonic Blaze Testnet Status Check\n`);
  
  if (network.name !== "sonic-testnet") {
    console.error("❌ This script must be run with --network sonic-testnet");
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  const networkConfig = loadNetworkConfig(network.name);
  const enabledVaults = getEnabledVaults(networkConfig);
  
  console.log(`🔍 Network Information:`);
  console.log(`Network: ${networkConfig.testnet?.documentation?.networkName || networkConfig.name}`);
  console.log(`Chain ID: ${networkConfig.chainId}`);
  console.log(`RPC URL: ${networkConfig.testnet?.documentation?.rpcUrl || networkConfig.rpcUrl || 'Default provider'}`);
  console.log(`Explorer: ${networkConfig.testnet?.explorerUrl || networkConfig.blockExplorer || 'N/A'}`);
  
  console.log(`\n👤 Wallet Status:`);
  console.log(`Address: ${signer.address}`);
  
  // Check wallet balance
  const balance = await ethers.provider.getBalance(signer.address);
  const balanceInEther = ethers.formatEther(balance);
  console.log(`Balance: ${balanceInEther} S`);
  
  if (parseFloat(balanceInEther) < 0.01) {
    console.log(`⚠️  Warning: Low balance. Visit faucet: ${networkConfig.testnet?.faucetUrl}`);
  } else {
    console.log(`✅ Balance sufficient for deployment`);
  }
  
  console.log(`\n🔗 Shared Contract Status:`);
  
  // Check shared contracts
  const sharedContractsToCheck = [
    { name: "LB Router", address: networkConfig.sharedContracts.lbRouter },
    { name: "LB Factory", address: networkConfig.sharedContracts.lbFactory },
    { name: "METRO Token", address: networkConfig.sharedContracts.metroToken }
  ];
  
  // Gather all unique tokens from enabled vaults
  const uniqueTokens = new Map<string, string>();
  for (const vault of enabledVaults) {
    if (!shouldDeployToken(vault.tokens.tokenX.address)) {
      uniqueTokens.set(vault.tokens.tokenX.symbol, vault.tokens.tokenX.address);
    }
    if (!shouldDeployToken(vault.tokens.tokenY.address)) {
      uniqueTokens.set(vault.tokens.tokenY.symbol, vault.tokens.tokenY.address);
    }
  }
  
  const contractsToCheck = [
    ...sharedContractsToCheck,
    ...Array.from(uniqueTokens.entries()).map(([symbol, address]) => ({ name: `Token ${symbol}`, address }))
  ];
  
  for (const contract of contractsToCheck) {
    try {
      const code = await ethers.provider.getCode(contract.address);
      if (code === "0x") {
        console.log(`❌ ${contract.name}: Not found at ${contract.address}`);
      } else {
        console.log(`✅ ${contract.name}: ${contract.address}`);
      }
    } catch (error) {
      console.log(`❌ ${contract.name}: Error checking ${contract.address} - ${error}`);
    }
  }
  
  // Check for existing deployments
  console.log(`\n📂 Deployment Status:`);
  const deploymentsDir = path.join(__dirname, "../deployments", network.name);
  
  if (fs.existsSync(deploymentsDir)) {
    const deploymentFiles = fs.readdirSync(deploymentsDir);
    if (deploymentFiles.length > 0) {
      console.log(`Found existing deployments:`);
      deploymentFiles.forEach(file => {
        if (file.endsWith('.json')) {
          console.log(`  - ${file}`);
        }
      });
    } else {
      console.log(`No deployments found in ${deploymentsDir}`);
    }
  } else {
    console.log(`No deployment directory found - first time deployment`);
  }
  
  // Check vault configurations
  console.log(`\n🏛️ Vault Configurations:`);
  console.log(`Enabled vaults: ${enabledVaults.length}`);
  for (const vault of enabledVaults) {
    console.log(`\n  Vault: ${vault.id} (${getTokenSymbolPair(vault)})`);
    console.log(`  - Token X: ${vault.tokens.tokenX.symbol} (${vault.tokens.tokenX.deployMock ? 'DEPLOY_MOCK' : vault.tokens.tokenX.address})`);
    console.log(`  - Token Y: ${vault.tokens.tokenY.symbol} (${vault.tokens.tokenY.deployMock ? 'DEPLOY_MOCK' : vault.tokens.tokenY.address})`);
    console.log(`  - LB Pair: ${vault.lbPair.deployMock ? 'DEPLOY_MOCK' : vault.lbPair.address}`);
  }
  
  console.log(`\n🚀 Ready to Deploy?`);
  
  // Check readiness
  let readyToDeploy = true;
  const issues = [];
  
  if (parseFloat(balanceInEther) < 0.01) {
    readyToDeploy = false;
    issues.push("Insufficient testnet tokens - visit faucet");
  }
  
  // Check if essential contracts exist
  for (const contract of contractsToCheck) {
    try {
      if (shouldDeployToken(contract.address)) {
        continue; // Skip DEPLOY_MOCK addresses
      }
      const code = await ethers.provider.getCode(contract.address);
      if (code === "0x") {
        readyToDeploy = false;
        issues.push(`${contract.name} not found on testnet`);
      }
    } catch {
      readyToDeploy = false;
      issues.push(`Cannot verify ${contract.name}`);
    }
  }
  
  if (readyToDeploy) {
    console.log(`✅ All checks passed! Ready to deploy.`);
    console.log(`\nRun: npm run deploy:testnet`);
  } else {
    console.log(`❌ Issues found:`);
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log(`\nResolve issues above before deployment.`);
  }
  
  console.log(`\n📚 Useful Commands:`);
  console.log(`- Get testnet tokens: npm run dev:testnet:faucet`);
  console.log(`- Deploy to testnet: npm run deploy:testnet`);
  console.log(`- Verify deployment: npm run deploy:verify:testnet`);
  console.log(`- Test deployment: npm run deploy:test:testnet`);
  console.log(`- Export addresses: npm run deploy:export`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });