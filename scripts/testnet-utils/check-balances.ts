import { ethers } from "hardhat";
import type { IERC20 } from "../../typechain-types";

// Testnet addresses
const ADDRESSES = {
  S_TOKEN: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // Wrapped S
  USDC_TOKEN: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0",
};

async function main() {
  const [signer] = await ethers.getSigners();
  const walletAddress = signer.address;
  
  console.log("💰 Sonic Testnet Balance Check");
  console.log("==============================");
  console.log(`Wallet: ${walletAddress}`);

  // Connect to tokens
  const sToken = await ethers.getContractAt("IERC20", ADDRESSES.S_TOKEN, signer) as IERC20;
  const usdcToken = await ethers.getContractAt("IERC20", ADDRESSES.USDC_TOKEN, signer) as IERC20;

  // Get balances
  const sBalance = await sToken.balanceOf(walletAddress);
  const usdcBalance = await usdcToken.balanceOf(walletAddress);
  
  // Also check native S balance
  const nativeBalance = await ethers.provider.getBalance(walletAddress);
  
  console.log(`\n📊 Token Balances:`);
  console.log(`Native S: ${ethers.formatEther(nativeBalance)} S`);
  console.log(`Wrapped S (wS): ${ethers.formatEther(sBalance)} wS`);
  console.log(`USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  
  if (nativeBalance > 0n && sBalance === 0n) {
    console.log(`\n💡 Tip: You have native S but no wrapped S. Use swap-for-usdc.ts to wrap and swap.`);
  }
  
  if (sBalance > 0n) {
    console.log(`\n✅ You have ${ethers.formatEther(sBalance)} wS ready to swap for USDC!`);
  }
  
  if (nativeBalance === 0n) {
    console.log("\n⚠️  No native S tokens. Get some from: https://testnet.soniclabs.com/account");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });