import { run, network, ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log(`\n📝 Verifying Metropolis contracts on ${network.name}...\n`);

  // Load deployment addresses
  const deploymentPath = `./deployments/metropolis-${network.name}.json`;
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ Deployment file not found: ${deploymentPath}`);
    console.error(`Run deployment first: npm run deploy:metropolis:${network.name}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const addresses = deployment.addresses;

  console.log("Loaded deployment from:", deploymentPath);
  console.log("Timestamp:", deployment.timestamp);

  // Get VaultFactory interface to encode initialization data
  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const initData = VaultFactory.interface.encodeFunctionData("initialize4", [
    "0x6daF0A44419201a00d8364bbE57e6Ca7B4dC0A98", // deployer address
    0n // creation fee
  ]);

  // Verify each contract
  const verifications = [
    {
      name: "VaultFactory Implementation",
      address: addresses.vaultFactoryImpl,
      constructorArguments: [addresses.wnative],
    },
    {
      name: "ProxyAdmin",
      address: addresses.proxyAdmin,
      constructorArguments: ["0x6daF0A44419201a00d8364bbE57e6Ca7B4dC0A98"], // Deployer address as initial owner
      contract: "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol:ProxyAdmin"
    },
    {
      name: "TransparentUpgradeableProxy (VaultFactory)",
      address: addresses.vaultFactory,
      constructorArguments: [
        addresses.vaultFactoryImpl,
        addresses.proxyAdmin,
        initData // Use the actual initialization data
      ],
      contract: "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy"
    },
    {
      name: "OracleVault Implementation",
      address: addresses.oracleVaultImpl,
      constructorArguments: [addresses.vaultFactory],
      contract: "contracts-metropolis/src/OracleVault.sol:OracleVault"
    },
    {
      name: "OracleRewardVault Implementation",
      address: addresses.oracleRewardVaultImpl,
      constructorArguments: [addresses.vaultFactory],
      contract: "contracts-metropolis/src/OracleRewardVault.sol:OracleRewardVault"
    },
    {
      name: "Strategy Implementation",
      address: addresses.strategyImpl,
      constructorArguments: [addresses.vaultFactory, 51], // maxRange = 51
      contract: "contracts-metropolis/src/Strategy.sol:Strategy"
    },
  ];

  let successCount = 0;
  let failCount = 0;

  // Helper function to add delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const verification of verifications) {
    console.log(`\n🔍 Verifying ${verification.name}...`);
    console.log(`Address: ${verification.address}`);
    
    try {
      await run("verify:verify", {
        address: verification.address,
        constructorArguments: verification.constructorArguments,
        contract: verification.contract,
      });
      console.log(`✅ ${verification.name} verified successfully!`);
      successCount++;
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`✅ ${verification.name} is already verified`);
        successCount++;
      } else {
        console.error(`❌ Failed to verify ${verification.name}:`, error.message);
        failCount++;
      }
    }
    
    // Add delay to avoid rate limiting (500ms between requests)
    await delay(500);
  }

  console.log(`\n📊 Verification Summary:`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log(`\n💡 Troubleshooting tips:`);
    console.log(`1. Make sure your API key is set in .env: SONIC_TESTNET_SCAN_API_KEY`);
    console.log(`2. Wait a few minutes after deployment before verifying`);
    console.log(`3. Check the explorer manually: https://testnet.sonicscan.org`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });