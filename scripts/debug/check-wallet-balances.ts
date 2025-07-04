import { ethers } from "hardhat";
import type { IERC20 } from "../../typechain-types";

const WALLET_ADDRESS = "0x6daF0A44419201a00d8364bbE57e6Ca7B4dC0A98";

// Testnet addresses
const ADDRESSES = {
  S_TOKEN: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
  USDC_TOKEN: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0",
};

async function main() {
  console.log("💰 Checking Wallet Balances");
  console.log("===========================");
  console.log(`Wallet: ${WALLET_ADDRESS}`);

  const [signer] = await ethers.getSigners();
  
  // Connect to tokens
  const sToken = await ethers.getContractAt("IERC20", ADDRESSES.S_TOKEN, signer) as IERC20;
  const usdcToken = await ethers.getContractAt("IERC20", ADDRESSES.USDC_TOKEN, signer) as IERC20;

  // Get balances
  const sBalance = await sToken.balanceOf(WALLET_ADDRESS);
  const usdcBalance = await usdcToken.balanceOf(WALLET_ADDRESS);
  
  // Also check native S balance
  const nativeBalance = await ethers.provider.getBalance(WALLET_ADDRESS);
  
  console.log(`\n📊 Token Balances:`);
  console.log(`Native S: ${ethers.formatEther(nativeBalance)} S`);
  console.log(`Wrapped S (wS): ${ethers.formatEther(sBalance)} S`);
  console.log(`USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  
  if (sBalance > 0n) {
    console.log(`\n✅ You have ${ethers.formatEther(sBalance)} wS ready to swap!`);
  } else {
    console.log("\n⚠️  No wrapped S tokens found. You may need to wrap your native S first.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });