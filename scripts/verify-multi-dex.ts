import { run, network, ethers } from "hardhat";
import * as fs from "fs";
import { execSync } from "child_process";

// Type definition for deployment file
interface DeploymentFile {
  network: string;
  timestamp: string;
  deployer?: string;
  addresses: {
    vaultFactory: string;
    vaultFactoryImpl: string;
    proxyAdmin: string;
    oracleVaultImpl: string | null;
    oracleRewardVaultImpl: string;
    oracleRewardShadowVaultImpl: string;
    strategyImpl: string;
    shadowStrategyImpl: string;
    shadowNPM: string;
    shadowVoter: string;
    wnative: string;
    oracleHelperFactory?: string;
    shadowPriceHelper?: string;
  };
}

// Type for verification entries
interface VerificationEntry {
  name: string;
  address: string;
  constructorArguments: (string | number | bigint)[];
  contract?: string;
  isProxy?: boolean;
  libraries?: Record<string, string>;
}

// Helper function to get explorer URL based on network
function getExplorerUrl(networkName: string): string {
  switch (networkName) {
    case "sonic-mainnet":
      return "https://sonicscan.org";
    case "sonic-testnet":
      return "https://testnet.sonicscan.org";
    default:
      return "https://localhost";
  }
}

// Helper function to get the deployer address from deployment file or current signer
async function getDeployerAddress(deployment: DeploymentFile): Promise<string> {
  // Try to get from deployment file first (most accurate)
  if (deployment.deployer) {
    return deployment.deployer;
  }
  
  // Otherwise, get from current signer
  const [signer] = await ethers.getSigners();
  return signer.address;
}

async function main() {
  console.log(`\n📝 Verifying Multi-DEX contracts (Metropolis & Shadow) on ${network.name}...\n`);

  // Load deployment addresses
  const deploymentPath = `./deployments/metropolis-${network.name}.json`;
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ Deployment file not found: ${deploymentPath}`);
    console.error(`Run deployment first: npm run deploy:metropolis:${network.name}`);
    process.exit(1);
  }

  const deployment: DeploymentFile = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const addresses = deployment.addresses;

  console.log("Loaded deployment from:", deploymentPath);
  console.log("Timestamp:", deployment.timestamp);

  // Get VaultFactory interface to encode initialization data
  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const deployerAddress = await getDeployerAddress(deployment);
  const initData = VaultFactory.interface.encodeFunctionData("initialize4", [
    deployerAddress,
    0n // creation fee
  ]);

  // If oracleHelperFactory is missing, try to get it from the deployed VaultFactory
  if (!addresses.oracleHelperFactory || addresses.oracleHelperFactory === "0x0000000000000000000000000000000000000000") {
    try {
      const vaultFactory = VaultFactory.attach(addresses.vaultFactory);
      addresses.oracleHelperFactory = await vaultFactory.getOracleHelperFactory();
      console.log("Retrieved oracleHelperFactory from deployed contract:", addresses.oracleHelperFactory);
    } catch {
      console.log("⚠️  Warning: Could not retrieve oracleHelperFactory from contract");
      // Use zero address as fallback
      addresses.oracleHelperFactory = "0x0000000000000000000000000000000000000000";
    }
  }

  // Build verifications array dynamically to handle optional contracts
  const verifications: VerificationEntry[] = [];

  // Add OracleHelperFactory if present
  if (addresses.oracleHelperFactory && addresses.oracleHelperFactory !== "0x0000000000000000000000000000000000000000") {
    verifications.push({
      name: "OracleHelperFactory",
      address: addresses.oracleHelperFactory,
      constructorArguments: [],
      contract: "contracts-metropolis/src/OracleHelperFactory.sol:OracleHelperFactory"
    });
  }

  // Add ShadowPriceHelper if present
  if (addresses.shadowPriceHelper && addresses.shadowPriceHelper !== "0x0000000000000000000000000000000000000000") {
    verifications.push({
      name: "ShadowPriceHelper",
      address: addresses.shadowPriceHelper,
      constructorArguments: [],
      contract: "contracts-shadow/src/libraries/ShadowPriceHelper.sol:ShadowPriceHelper"
    });
  }

  // VaultFactory now takes two constructor arguments
  verifications.push({
    name: "VaultFactory Implementation",
    address: addresses.vaultFactoryImpl,
    constructorArguments: [
      addresses.wnative,
      addresses.oracleHelperFactory || "0x0000000000000000000000000000000000000000"
    ],
  });

  verifications.push({
    name: "ProxyAdmin",
    address: addresses.proxyAdmin,
    constructorArguments: [deployerAddress], // Use actual deployer from deployment file
    contract: "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol:ProxyAdmin"
  });

  verifications.push({
    name: "TransparentUpgradeableProxy (VaultFactory)",
    address: addresses.vaultFactory,
    constructorArguments: [
      addresses.vaultFactoryImpl,
      addresses.proxyAdmin,
      initData // Use the actual initialization data
    ],
    contract: "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
    isProxy: true // Special flag for proxy handling
  });

  // Only add OracleVault if it was deployed (not null)
  if (addresses.oracleVaultImpl && addresses.oracleVaultImpl !== null) {
    verifications.push({
      name: "OracleVault Implementation",
      address: addresses.oracleVaultImpl,
      constructorArguments: [addresses.vaultFactory],
      contract: "contracts-metropolis/src/OracleVault.sol:OracleVault"
    });
  }

  verifications.push({
    name: "OracleRewardVault Implementation",
    address: addresses.oracleRewardVaultImpl,
    constructorArguments: [addresses.vaultFactory],
    contract: "contracts-metropolis/src/OracleRewardVault.sol:OracleRewardVault"
  });

  // Add OracleRewardShadowVault with library linking
  if (addresses.oracleRewardShadowVaultImpl) {
    const verifyEntry: VerificationEntry = {
      name: "OracleRewardShadowVault Implementation",
      address: addresses.oracleRewardShadowVaultImpl,
      constructorArguments: [addresses.vaultFactory],
      contract: "contracts-shadow/src/OracleRewardShadowVault.sol:OracleRewardShadowVault"
    };
    
    // Only add libraries if shadowPriceHelper is available and not zero address
    if (addresses.shadowPriceHelper && addresses.shadowPriceHelper !== "0x0000000000000000000000000000000000000000") {
      verifyEntry.libraries = {
        "contracts-shadow/src/libraries/ShadowPriceHelper.sol:ShadowPriceHelper": addresses.shadowPriceHelper
      };
    } else {
      console.log("⚠️  Warning: shadowPriceHelper address not available, skipping library linking for OracleRewardShadowVault");
    }
    
    verifications.push(verifyEntry);
  }

  verifications.push({
    name: "Strategy Implementation",
    address: addresses.strategyImpl,
    constructorArguments: [addresses.vaultFactory, 51], // maxRange = 51
    contract: "contracts-metropolis/src/MetropolisStrategy.sol:MetropolisStrategy"
  });

  verifications.push({
    name: "ShadowStrategy Implementation",
    address: addresses.shadowStrategyImpl,
    constructorArguments: [addresses.vaultFactory, 887272], // maxRange = 887272 for Shadow
    contract: "contracts-shadow/src/ShadowStrategy.sol:ShadowStrategy"
  });

  let successCount = 0;
  let failCount = 0;

  // Helper function to add delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const verification of verifications) {
    console.log(`\n🔍 Verifying ${verification.name}...`);
    console.log(`Address: ${verification.address}`);
    
    try {
      // Special handling for TransparentUpgradeableProxy
      if (verification.isProxy) {
        console.log("Using direct verification for proxy contract...");
        
        const args = verification.constructorArguments;
        
        // Try multiple approaches since proxy verification is complex
        const attempts = [
          // Attempt 1: Force with explicit contract
          {
            name: "Force with explicit contract",
            cmd: [
              "npx", "hardhat", "verify",
              "--network", network.name,
              "--contract", verification.contract,
              "--force",
              verification.address,
              args[0],
              args[1],
              args[2]
            ]
          },
          // Attempt 2: Force without explicit contract path
          {
            name: "Force without contract path",
            cmd: [
              "npx", "hardhat", "verify", 
              "--network", network.name,
              "--force",
              verification.address,
              args[0],
              args[1],
              args[2]
            ]
          },
          // Attempt 3: String command with quotes
          {
            name: "String command with quotes", 
            cmd: `npx hardhat verify --network ${network.name} --contract "${verification.contract}" --force ${verification.address} ${args[0]} ${args[1]} '${args[2]}'`
          }
        ];
        
        let success = false;
        
        for (const attempt of attempts) {
          if (success) break;
          
          // Add delay to avoid rate limiting
          await delay(2000);
          
          console.log(`\n🔧 Trying: ${attempt.name}`);
          
          try {
            if (typeof attempt.cmd === 'string') {
              execSync(attempt.cmd, { 
                stdio: 'inherit',
                encoding: 'utf-8'
              });
            } else {
              execSync(attempt.cmd.join(" "), { 
                stdio: 'inherit',
                encoding: 'utf-8'
              });
            }
            
            console.log(`✅ ${verification.name} verified successfully!`);
            successCount++;
            success = true;
            
          } catch (cmdError) {
            const errorMessage = cmdError instanceof Error ? cmdError.message : String(cmdError);
            
            if (errorMessage.includes("Already Verified") || 
                errorMessage.includes("already been verified") ||
                errorMessage.includes("already verified")) {
              console.log(`✅ ${verification.name} is already verified`);
              successCount++;
              success = true;
            } else {
              console.log(`❌ ${attempt.name} failed:`, errorMessage.split('\n')[0]);
            }
          }
        }
        
        if (!success) {
          console.log(`❌ All attempts failed for ${verification.name}`);
          failCount++;
        }
      } else if (verification.libraries) {
        // Special handling for contracts with libraries
        console.log("Using command-line verification for library-linked contract...");
        
        const librariesArg = Object.entries(verification.libraries)
          .map(([lib, addr]) => `${lib}:${addr}`)
          .join(",");
        
        try {
          const cmd = [
            "npx", "hardhat", "verify",
            "--network", network.name,
            "--contract", verification.contract,
            "--libraries", librariesArg,
            "--force",
            verification.address,
            ...verification.constructorArguments.map(arg => String(arg))
          ].join(" ");
          
          execSync(cmd, { 
            stdio: 'inherit',
            encoding: 'utf-8'
          });
          
          console.log(`✅ ${verification.name} verified successfully!`);
          successCount++;
          
        } catch (cmdError) {
          const errorMessage = cmdError instanceof Error ? cmdError.message : String(cmdError);
          
          if (errorMessage.includes("Already Verified") || 
              errorMessage.includes("already been verified") ||
              errorMessage.includes("already verified")) {
            console.log(`✅ ${verification.name} is already verified`);
            successCount++;
          } else {
            console.log(`❌ Failed to verify ${verification.name}:`, errorMessage.split('\n')[0]);
            failCount++;
          }
        }
      } else {
        // Regular verification for other contracts
        try {
          await run("verify:verify", {
            address: verification.address,
            constructorArguments: verification.constructorArguments,
            contract: verification.contract,
            force: true, // Force verification even if already verified
          });
          console.log(`✅ ${verification.name} verified successfully!`);
          successCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes("Already Verified") || 
              errorMessage.includes("already been verified")) {
            console.log(`✅ ${verification.name} is already verified`);
            successCount++;
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Already Verified") || 
          errorMessage.includes("already been verified")) {
        console.log(`✅ ${verification.name} is already verified`);
        successCount++;
      } else {
        console.error(`❌ Failed to verify ${verification.name}:`, errorMessage);
        failCount++;
      }
    }
    
    // Add delay to avoid rate limiting
    await delay(2000);
  }

  console.log(`\n📊 Verification Summary:`);
  
  // Show manual verification commands for failed contracts
  if (failCount > 0) {
    console.log(`\n📝 Manual Verification Commands for Failed Contracts:`);
    console.log(`\nFor VaultFactory Implementation (if failed):`);
    console.log(`npx hardhat verify --network ${network.name} --contract contracts-metropolis/src/VaultFactory.sol:VaultFactory ${addresses.vaultFactoryImpl} ${addresses.wnative} ${addresses.oracleHelperFactory || "0x0000000000000000000000000000000000000000"}`);
  }
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log(`\n💡 Troubleshooting tips:`);
    console.log(`1. Make sure your API key is set in .env:`);
    console.log(`   - For testnet: SONIC_TESTNET_SCAN_API_KEY`);
    console.log(`   - For mainnet: SONIC_SCAN_API_KEY`);
    console.log(`2. Wait a few minutes after deployment before verifying`);
    console.log(`3. Check the explorer manually: ${getExplorerUrl(network.name)}`);
    console.log(`4. For proxy contracts, the linking might fail due to rate limits but the contract itself should be verified`);
  }
  
  console.log(`\n📌 Contract Addresses:`);
  console.log(`VaultFactory Proxy: ${addresses.vaultFactory}`);
  console.log(`View on Explorer: ${getExplorerUrl(network.name)}/address/${addresses.vaultFactory}#code`);
  
  console.log(`\n📌 Shadow Configuration:`);
  console.log(`Shadow NPM: ${addresses.shadowNPM}`);
  console.log(`Shadow Voter: ${addresses.shadowVoter}`);
  console.log(`ShadowStrategy Implementation: ${addresses.shadowStrategyImpl}`);
  console.log(`View ShadowStrategy: ${getExplorerUrl(network.name)}/address/${addresses.shadowStrategyImpl}#code`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });