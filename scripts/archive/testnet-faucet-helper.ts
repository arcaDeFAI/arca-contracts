import { ethers, network } from "hardhat";
import { loadNetworkConfig } from "./utils/network-config";

async function main() {
  console.log(`\n🚰 Sonic Blaze Testnet Faucet Helper\n`);
  
  if (network.name !== "sonic-testnet") {
    console.error("❌ This script must be run with --network sonic-testnet");
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  console.log(`Wallet Address: ${signer.address}`);
  
  // Get current balance
  const balance = await ethers.provider.getBalance(signer.address);
  const balanceInEther = ethers.formatEther(balance);
  console.log(`Current Balance: ${balanceInEther} S`);
  
  // Load testnet config
  const networkConfig = loadNetworkConfig(network.name);
  
  console.log(`\n📋 Testnet Information:`);
  console.log(`Network Name: ${networkConfig.testnet?.documentation?.networkName}`);
  console.log(`Chain ID: ${networkConfig.chainId}`);
  console.log(`RPC URL: ${networkConfig.testnet?.documentation?.rpcUrl}`);
  console.log(`Explorer: ${networkConfig.testnet?.explorerUrl}`);
  console.log(`Currency Symbol: ${networkConfig.testnet?.documentation?.currencySymbol}`);
  
  console.log(`\n🚰 Get Testnet Tokens:`);
  console.log(`1. Visit the faucet: ${networkConfig.testnet?.faucetUrl}`);
  console.log(`2. Connect your wallet or enter address: ${signer.address}`);
  console.log(`3. Request testnet S tokens`);
  
  if (parseFloat(balanceInEther) < 0.01) {
    console.log(`\n⚠️  Low Balance Warning:`);
    console.log(`Your current balance (${balanceInEther} S) is low.`);
    console.log(`You'll need testnet S tokens to deploy contracts and pay gas fees.`);
    console.log(`Please use the faucet above to get testnet tokens.`);
  } else {
    console.log(`\n✅ Balance looks good for testnet deployment!`);
  }
  
  console.log(`\n📖 Next Steps:`);
  console.log(`1. Ensure you have testnet tokens from the faucet`);
  console.log(`2. Run: npm run deploy:testnet`);
  console.log(`3. Verify deployment: npm run deploy:verify:testnet`);
  console.log(`4. Test deployment: npm run deploy:test:testnet`);
  
  console.log(`\n🔗 Useful Links:`);
  console.log(`- Faucet: ${networkConfig.testnet?.faucetUrl}`);
  console.log(`- Explorer: ${networkConfig.testnet?.explorerUrl}`);
  console.log(`- Add to MetaMask: Use RPC ${networkConfig.testnet?.documentation?.rpcUrl}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });