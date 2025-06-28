/* eslint-disable no-console */
import hre from "hardhat";
import { loadNetworkConfig, validateDeploymentConfig, networkConfigToDeploymentConfig } from "./utils/network-config";

interface ReadinessCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: "error" | "warning" | "info";
}

async function checkMainnetReadiness(): Promise<void> {
  console.log("🔍 Checking Sonic Mainnet Deployment Readiness...\n");
  
  const checks: ReadinessCheck[] = [];
  
  // Check 1: Network configuration exists and loads
  try {
    const config = loadNetworkConfig("sonic-mainnet");
    checks.push({
      name: "Network Config",
      passed: true,
      message: "sonic-mainnet.json loads successfully",
      severity: "info"
    });
    
    // Check 2: Environment variables
    const envChecks = [
      { key: "PRIVATE_KEY", name: "Private Key" },
      { key: "MAINNET_FEE_RECIPIENT", name: "Fee Recipient" },
      { key: "SONIC_SCAN_API_KEY", name: "Block Explorer API Key", optional: true },
      { key: "ALCHEMY_API_KEY", name: "Alchemy API Key", recommended: true }
    ];
    
    for (const envCheck of envChecks) {
      const value = process.env[envCheck.key];
      const passed = !!value || (envCheck.optional ?? false);
      checks.push({
        name: envCheck.name,
        passed,
        message: passed 
          ? `${envCheck.key} is set${envCheck.optional && !value ? " (optional)" : ""}`
          : `${envCheck.key} is missing from .env file`,
        severity: envCheck.optional ? "warning" : "error"
      });
    }
    
    // Check 3: Contract addresses validation
    const deploymentConfig = networkConfigToDeploymentConfig(config);
    
    const addressFields = [
      { key: "tokenX", name: "Token X" },
      { key: "tokenY", name: "Token Y" },
      { key: "lbRouter", name: "LB Router" },
      { key: "lbpAMM", name: "LBP AMM" },
      { key: "lbpContract", name: "LBP Contract" },
      { key: "rewarder", name: "Rewarder" },
      { key: "rewardToken", name: "METRO Token" },
      { key: "nativeToken", name: "Native Token (wS)" },
      { key: "lbpContractUSD", name: "USD Pair Contract" },
      { key: "feeRecipient", name: "Fee Recipient" }
    ];
    
    for (const field of addressFields) {
      const value = deploymentConfig[field.key as keyof typeof deploymentConfig] as string;
      const isTodo = value.includes("TODO");
      const isValidAddress = !isTodo && value.startsWith("0x") && value.length === 42;
      
      checks.push({
        name: field.name,
        passed: isValidAddress,
        message: isTodo 
          ? `${field.name} is still TODO placeholder`
          : isValidAddress 
            ? `${field.name} address format is valid`
            : `${field.name} has invalid address format`,
        severity: "error"
      });
    }
    
    // Check 4: Network connectivity
    try {
      const provider = new hre.ethers.JsonRpcProvider("https://rpc.blaze.soniclabs.com");
      const blockNumber = await provider.getBlockNumber();
      checks.push({
        name: "Network Connection",
        passed: true,
        message: `Connected to Sonic testnet (block ${blockNumber})`,
        severity: "info"
      });
    } catch (error) {
      checks.push({
        name: "Network Connection",
        passed: false,
        message: `Failed to connect to Sonic testnet: ${error}`,
        severity: "error"
      });
    }
    
    // Check 5: Wallet balance (if private key provided)
    if (process.env.PRIVATE_KEY) {
      try {
        const [deployer] = await hre.ethers.getSigners();
        const balance = await deployer.provider.getBalance(deployer.address);
        const balanceEth = hre.ethers.formatEther(balance);
        const hasEnoughGas = parseFloat(balanceEth) >= 0.1; // Need at least 0.1 S for deployment
        
        checks.push({
          name: "Wallet Balance",
          passed: hasEnoughGas,
          message: hasEnoughGas 
            ? `Wallet has sufficient balance: ${balanceEth} S`
            : `Wallet balance too low: ${balanceEth} S (need at least 0.1 S)`,
          severity: hasEnoughGas ? "info" : "warning"
        });
      } catch (error) {
        checks.push({
          name: "Wallet Balance",
          passed: false,
          message: `Could not check wallet balance: ${error}`,
          severity: "warning"
        });
      }
    }
    
    // Check 6: Deployment validation
    try {
      validateDeploymentConfig(deploymentConfig, "sonic-mainnet");
      checks.push({
        name: "Config Validation",
        passed: true,
        message: "All configuration validation passed",
        severity: "info"
      });
    } catch (error) {
      checks.push({
        name: "Config Validation",
        passed: false,
        message: `Configuration validation failed: ${error}`,
        severity: "error"
      });
    }
    
  } catch (error) {
    checks.push({
      name: "Network Config",
      passed: false,
      message: `Failed to load sonic-mainnet.json: ${error}`,
      severity: "error"
    });
  }
  
  // Print results
  console.log("📊 READINESS CHECK RESULTS:\n");
  
  let hasErrors = false;
  let hasWarnings = false;
  
  for (const check of checks) {
    const icon = check.passed ? "✅" : "❌";
    const severity = check.severity === "error" ? "🚨" : check.severity === "warning" ? "⚠️" : "ℹ️";
    
    console.log(`${icon} ${severity} ${check.name}: ${check.message}`);
    
    if (!check.passed && check.severity === "error") hasErrors = true;
    if (!check.passed && check.severity === "warning") hasWarnings = true;
  }
  
  console.log("\n" + "=".repeat(60));
  
  if (hasErrors) {
    console.log("❌ NOT READY FOR DEPLOYMENT");
    console.log("🚨 Critical errors must be resolved before deploying to mainnet");
    console.log("\n📋 Next steps:");
    console.log("1. Review DEPLOYMENT.md");
    console.log("2. Set up .env file with private key and fee recipient");
    console.log("3. Fund deployment wallet with Sonic mainnet tokens");
    console.log("4. Consider testing on mainnet fork first (npm run deploy:fork)");
    process.exit(1);
  } else if (hasWarnings) {
    console.log("⚠️  READY WITH WARNINGS");
    console.log("✅ No critical errors, but some optional items missing");
    console.log("💡 Consider using Alchemy for better reliability");
  } else {
    console.log("🎉 READY FOR MAINNET DEPLOYMENT!");
    console.log("✅ All checks passed - you can deploy to mainnet");
    console.log("🚀 Use: npm run deploy:mainnet");
  }
  
  console.log("=".repeat(60));
}

async function main() {
  await checkMainnetReadiness();
}

main().catch((error) => {
  console.error("❌ Readiness check failed:", error);
  process.exit(1);
});