import { ethers, network } from "hardhat";

async function main() {
  console.log(`Configuring HybridPriceLens on ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);

  // HybridPriceLens address from deployment
  const PRICE_LENS_ADDRESS = "0xb35EC128DBBefb262A2188F6E55443f187eA428b";
  const USDC_ADDRESS = "0x29219dd400f2Bf60E5a23d13Be72B486D4038894";
  const WS_ADDRESS = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38";
  const LB_PAIR_ADDRESS = "0x32c0D87389E72E46b54bc4Ea6310C1a0e921C4DC";

  const priceLens = await ethers.getContractAt("HybridPriceLens", PRICE_LENS_ADDRESS);

  // Step 1: Check if we're the owner
  try {
    const owner = await priceLens.owner();
    console.log("PriceLens owner:", owner);
    console.log("Deployer address:", deployer.address);
    console.log("Is deployer owner?", owner.toLowerCase() === deployer.address.toLowerCase());
  } catch (error) {
    console.log("Could not check owner:", error);
  }

  // Step 2: Try setting reference token with more specific error handling
  console.log("\nStep 1: Setting USDC as reference token...");
  try {
    // First check if USDC exists as a contract
    const usdcCode = await ethers.provider.getCode(USDC_ADDRESS);
    console.log("USDC contract exists:", usdcCode !== "0x");
    
    const tx = await priceLens.setReferenceToken(USDC_ADDRESS, true);
    console.log("Transaction submitted:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Reference token set successfully!");
  } catch (error) {
    console.log("❌ Failed to set reference token:");
    if (error && typeof error === 'object' && 'data' in error) {
      try {
        const decodedError = priceLens.interface.parseError(error.data);
        console.log("Decoded error:", decodedError);
      } catch {
        console.log("Could not decode error");
      }
    }
    console.log("Error:", error);
    return;
  }

  // Step 3: Configure LB Pair route for USDC
  console.log("\nStep 2: Configuring LB Pair route for USDC...");
  try {
    const tx = await priceLens.setLBPairRoute(
      USDC_ADDRESS,           // token
      LB_PAIR_ADDRESS,        // LB pair  
      ethers.ZeroAddress,     // reference token (ZeroAddress means direct to native)
      false                   // isTokenX (USDC is tokenY)
    );
    console.log("Transaction submitted:", tx.hash);
    await tx.wait();
    console.log("✅ LB Pair route configured!");
  } catch (error) {
    console.log("❌ Failed to configure LB Pair route:", error);
    return;
  }

  // Step 4: Test price feeds
  console.log("\nStep 3: Testing price feeds...");
  try {
    const wsPrice = await priceLens.getTokenPriceNative(WS_ADDRESS);
    console.log("wS price in wS:", ethers.formatEther(wsPrice), "(should be 1.0)");
    
    const usdcPrice = await priceLens.getTokenPriceNative(USDC_ADDRESS);
    console.log("USDC price in wS:", ethers.formatEther(usdcPrice));
    
    console.log("✅ PriceLens is working correctly!");
  } catch (error) {
    console.log("❌ Price feed test failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });