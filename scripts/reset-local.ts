import hre from "hardhat";

async function resetLocal() {
  console.log("\n🔄 Resetting local blockchain...\n");
  
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    throw new Error("This script can only be run on localhost network");
  }
  
  try {
    await hre.network.provider.send("hardhat_reset");
    console.log("✅ Local blockchain reset successfully!");
    console.log("\n💡 Tip: Run 'npm run deploy:local' to deploy fresh contracts");
  } catch (error) {
    console.error("❌ Failed to reset local blockchain:", error);
  }
}

async function main() {
  try {
    await resetLocal();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}