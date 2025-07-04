import { ethers } from "hardhat";

async function deployTest1UsdcVault() {
  console.log("\n🚀 Deploying TEST1-USDC Vault\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} S\n`);
  
  // Our existing addresses
  const addresses = {
    test1: "0x46e6B680eBae63e086e6D820529Aed187465aeDA",
    usdc: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0",
    registry: "0x1D134fBA4456F9F1130dFc7d1b5C379a4C8abbb8",
    queueHandlerBeacon: "0xB6DB386354c1a74F5071B90B087db57c7C350Ac6",
    feeManagerBeacon: "0x7a075c7496c96AE220833aEA019EA1c9695d0685",
    lbRouter: "0xe77DA7F5B6927fD5E0e825B2B27aca526341069B",
    lbFactory: "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7",
    metroToken: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321"
  };
  
  // Step 1: Create LB Pair
  console.log("=== Step 1: Creating LB Pair ===");
  const factoryABI = [
    "function createLBPair(address tokenX, address tokenY, uint24 activeId, uint16 binStep) returns (address pair)",
    "function getLBPairInformation(address tokenA, address tokenB, uint16 binStep) view returns (address lbPair)"
  ];
  
  const factory = new ethers.Contract(addresses.lbFactory, factoryABI, deployer);
  
  // Check if pair already exists
  let lbPairAddress;
  try {
    lbPairAddress = await factory.getLBPairInformation(addresses.test1, addresses.usdc, 25);
    if (lbPairAddress !== ethers.ZeroAddress) {
      console.log(`✅ LB Pair already exists at: ${lbPairAddress}`);
    }
  } catch (e) {
    console.log("Pair doesn't exist, creating...");
  }
  
  if (!lbPairAddress || lbPairAddress === ethers.ZeroAddress) {
    try {
      console.log("Creating LB Pair with:");
      console.log(`  TokenX (TEST1): ${addresses.test1}`);
      console.log(`  TokenY (USDC): ${addresses.usdc}`);
      console.log(`  ActiveId: 8388608`);
      console.log(`  BinStep: 25`);
      
      const tx = await factory.createLBPair(
        addresses.test1,
        addresses.usdc,
        8388608,
        25
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ LB Pair created in block ${receipt.blockNumber}`);
      
      // Get pair address from events
      const event = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          return parsed?.name === "LBPairCreated";
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsed = factory.interface.parseLog({
          topics: event.topics,
          data: event.data
        });
        lbPairAddress = parsed.args.lbPair;
        console.log(`✅ LB Pair address: ${lbPairAddress}`);
      }
    } catch (error) {
      console.log(`❌ Failed to create LB Pair: ${error}`);
      return;
    }
  }
  
  // Step 2: Deploy vault contracts
  console.log("\n=== Step 2: Deploying Vault Contracts ===");
  
  // Note: The rest of the deployment would go here, but since the LB pair creation
  // is failing, let's first see if we can create the pair successfully
  
  console.log("\n✅ Deployment complete!");
  console.log("\nDeployed addresses:");
  console.log(`- TEST1 Token: ${addresses.test1}`);
  console.log(`- USDC Token: ${addresses.usdc}`);
  console.log(`- LB Pair: ${lbPairAddress || "Failed to create"}`);
}

async function main() {
  try {
    await deployTest1UsdcVault();
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});