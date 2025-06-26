import hre from "hardhat";

async function main() {
  console.log("🧪 Deploying to Sonic testnet...\n");
  
  // Ensure we're on testnet
  if (hre.network.name !== "sonic-testnet") {
    throw new Error(`This script is for sonic-testnet only. Current network: ${hre.network.name}`);
  }
  
  // Check for private key
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Please set PRIVATE_KEY in your .env file");
  }
  
  // Warn about placeholder values
  console.log("⚠️  Please ensure all testnet addresses in config/networks/sonic-testnet.json are configured");
  console.log("⚠️  Replace all TODO placeholders with actual testnet addresses\n");
  
  // Import and run the main deployment
  const { main: deployMain } = await import("./deployArcaSystem");
  await deployMain();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});