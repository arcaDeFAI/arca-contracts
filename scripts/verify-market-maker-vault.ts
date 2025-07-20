import { ethers, network } from "hardhat";
import * as fs from "fs";

const VAULT_ADDRESS = "0x9541962342A344569FEAD20F6f824856aAC8cad9";
const STRATEGY_ADDRESS = "0xe4b564f305f762363B526697f9fb682c8BA2605F";

async function main() {
  console.log(`🔍 Discovering contracts for market maker vault verification on ${network.name}...\n`);

  // Load PriceLens address from HybridPriceLens deployment
  const priceLensPath = `./deployments/hybrid-price-lens-${network.name}.json`;
  let priceLensAddress = "";
  
  try {
    const priceLensDeployment = JSON.parse(fs.readFileSync(priceLensPath, "utf-8"));
    priceLensAddress = priceLensDeployment.addresses.hybridPriceLens;
    console.log("✅ PriceLens address:", priceLensAddress);
  } catch (error) {
    console.log("❌ Could not load PriceLens address from:", priceLensPath);
    console.log("   Make sure you have deployed HybridPriceLens first");
  }

  // Load VaultFactory address from Metropolis deployment
  const metropolisPath = `./deployments/metropolis-${network.name}.json`;
  let vaultFactoryAddress = "";
  
  try {
    const metropolisDeployment = JSON.parse(fs.readFileSync(metropolisPath, "utf-8"));
    vaultFactoryAddress = metropolisDeployment.addresses.vaultFactory;
    console.log("✅ VaultFactory address:", vaultFactoryAddress);
  } catch (error) {
    console.log("❌ Could not load VaultFactory address from:", metropolisPath);
    console.log("   Make sure you have deployed Metropolis contracts first");
  }

  // Connect to the vault
  const vault = await ethers.getContractAt("IOracleVault", VAULT_ADDRESS);
  
  try {
    console.log("\n📋 Market Maker Vault Details:");
    console.log("Vault address:", VAULT_ADDRESS);
    console.log("Strategy address:", STRATEGY_ADDRESS);
    
    // Get the LB Pair
    const lbPair = await vault.getPair();
    console.log("LB Pair:", lbPair);
    
    // Get pair details
    const lbPairContract = await ethers.getContractAt("joe-v2/interfaces/ILBPair.sol:ILBPair", lbPair);
    const tokenX = await lbPairContract.getTokenX();
    const tokenY = await lbPairContract.getTokenY();
    
    // Get token names for readability
    let tokenXName = "TokenX", tokenYName = "TokenY";
    try {
      const tokenXContract = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenX);
      const tokenYContract = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenY);
      tokenXName = await tokenXContract.symbol();
      tokenYName = await tokenYContract.symbol();
    } catch (error) {
      // Names are optional for display
    }
    
    console.log(`Token X (${tokenXName}):`, tokenX);
    console.log(`Token Y (${tokenYName}):`, tokenY);

    // Get oracle helper
    const oracleHelper = await vault.getOracleHelper();
    console.log("Oracle Helper:", oracleHelper);

    // Get oracle feeds from helper
    const helper = await ethers.getContractAt("OracleHelper", oracleHelper);
    const dataFeedX = await helper.getDataFeedX();
    const dataFeedY = await helper.getDataFeedY();
    
    console.log(`Data Feed X (${tokenXName} OracleLensAggregator):`, dataFeedX);
    console.log(`Data Feed Y (${tokenYName} OracleLensAggregator):`, dataFeedY);

    // Get token decimals for OracleHelper constructor
    const tokenXContract = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenX);
    const tokenYContract = await ethers.getContractAt("IERC20MetadataUpgradeable", tokenY);
    const decimalsX = await tokenXContract.decimals();
    const decimalsY = await tokenYContract.decimals();
    
    console.log(`${tokenXName} decimals: ${decimalsX}`);
    console.log(`${tokenYName} decimals: ${decimalsY}`);

    console.log("\n🎯 Contract Verification Status:");
    console.log("━".repeat(50));

    // Check if contracts are already verified by attempting to get bytecode
    const contracts = [
      { name: `${tokenXName} OracleLensAggregator`, address: dataFeedX },
      { name: `${tokenYName} OracleLensAggregator`, address: dataFeedY },
      { name: "OracleHelper", address: oracleHelper }
    ];

    const unverifiedContracts = [];
    
    for (const contract of contracts) {
      try {
        const code = await ethers.provider.getCode(contract.address);
        if (code === "0x") {
          console.log(`❌ ${contract.name}: No bytecode found`);
        } else {
          console.log(`📋 ${contract.name}: Deployed at ${contract.address}`);
          unverifiedContracts.push(contract);
        }
      } catch (error) {
        console.log(`❌ ${contract.name}: Error checking contract`);
      }
    }

    console.log("\n📝 Verification Commands:");
    console.log("━".repeat(50));

    if (priceLensAddress && unverifiedContracts.length > 0) {
      // OracleLensAggregator commands
      const oracleAggregators = unverifiedContracts.filter(c => c.name.includes("OracleLensAggregator"));
      
      if (oracleAggregators.length > 0) {
        console.log("\n# OracleLensAggregator Contracts:");
        console.log("# Constructor: (priceLens, token)");
        
        if (oracleAggregators.find(c => c.address === dataFeedX)) {
          console.log(`\n# ${tokenXName} OracleLensAggregator`);
          console.log(`npx hardhat verify --network ${network.name} ${dataFeedX} "${priceLensAddress}" "${tokenX}"`);
        }
        
        if (oracleAggregators.find(c => c.address === dataFeedY)) {
          console.log(`\n# ${tokenYName} OracleLensAggregator`);
          console.log(`npx hardhat verify --network ${network.name} ${dataFeedY} "${priceLensAddress}" "${tokenY}"`);
        }
      }

      // OracleHelper command
      if (vaultFactoryAddress && unverifiedContracts.find(c => c.name === "OracleHelper")) {
        console.log(`\n# OracleHelper`);
        console.log("# Constructor: (vaultFactory, lbPair, dataFeedX, dataFeedY, decimalsX, decimalsY)");
        console.log(`npx hardhat verify --network ${network.name} ${oracleHelper} "${vaultFactoryAddress}" "${lbPair}" "${dataFeedX}" "${dataFeedY}" ${decimalsX} ${decimalsY}`);
      }
    } else {
      if (!priceLensAddress) {
        console.log("❌ Cannot generate verification commands: PriceLens address not found");
        console.log(`   Deploy HybridPriceLens first: npm run deploy:metropolis:${network.name.replace('sonic-', '')}`);
      }
      if (!vaultFactoryAddress) {
        console.log("❌ Cannot generate verification commands: VaultFactory address not found");
        console.log(`   Deploy Metropolis contracts first: npm run deploy:metropolis:${network.name.replace('sonic-', '')}`);
      }
    }

    console.log("\n🔗 Minimal Proxy Information:");
    console.log("━".repeat(50));
    console.log("The vault and strategy are minimal proxy clones:");
    console.log(`Vault (proxy): ${VAULT_ADDRESS}`);
    console.log(`Strategy (proxy): ${STRATEGY_ADDRESS}`);
    console.log("These automatically show implementation source code on Sonicscan.");
    console.log("No verification needed for proxy contracts themselves.");

    console.log("\n🌐 Explorer Links:");
    console.log("━".repeat(50));
    const explorerUrl = network.name === "sonic-mainnet" ? "https://sonicscan.org" : "https://testnet.sonicscan.org";
    console.log(`Vault: ${explorerUrl}/address/${VAULT_ADDRESS}#code`);
    console.log(`Strategy: ${explorerUrl}/address/${STRATEGY_ADDRESS}#code`);
    console.log(`${tokenXName} Oracle: ${explorerUrl}/address/${dataFeedX}#code`);
    console.log(`${tokenYName} Oracle: ${explorerUrl}/address/${dataFeedY}#code`);
    console.log(`Oracle Helper: ${explorerUrl}/address/${oracleHelper}#code`);

    console.log("\n💡 Notes:");
    console.log("━".repeat(50));
    console.log("• OracleLensAggregator wraps HybridPriceLens for Chainlink compatibility");
    console.log("• OracleHelper manages price feeds and TWAP calculations");
    console.log("• Implementation contracts are already verified from Metropolis deployment");
    console.log("• Proxy contracts delegate to implementations, showing their source code");

    // Save verification info
    const verificationInfo = {
      network: network.name,
      timestamp: new Date().toISOString(),
      vault: {
        proxy: VAULT_ADDRESS,
        lbPair: lbPair,
        tokenX: { address: tokenX, symbol: tokenXName },
        tokenY: { address: tokenY, symbol: tokenYName },
        oracleHelper: oracleHelper
      },
      strategy: {
        proxy: STRATEGY_ADDRESS
      },
      oracles: {
        dataFeedX: dataFeedX,
        dataFeedY: dataFeedY,
        priceLens: priceLensAddress
      },
      dependencies: {
        vaultFactory: vaultFactoryAddress,
        priceLens: priceLensAddress
      }
    };

    const verificationPath = `./deployments/market-maker-vault-verification-${network.name}.json`;
    fs.writeFileSync(verificationPath, JSON.stringify(verificationInfo, null, 2));
    console.log(`\n💾 Verification info saved to: ${verificationPath}`);

  } catch (error) {
    console.error("❌ Error discovering contracts:", error);
    console.log("\n💡 Troubleshooting:");
    console.log("• Check that the vault address is correct");
    console.log("• Ensure you're connected to the right network");
    console.log("• Verify the vault was successfully created");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });