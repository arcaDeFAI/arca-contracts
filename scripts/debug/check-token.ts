import { ethers } from "hardhat";

async function main() {
  const tokenAddress = "0xFc00C80b0000007B73004edB00094caD80626d8D";
  const checksumAddress = ethers.getAddress(tokenAddress.toLowerCase());
  console.log("Checksum address:", checksumAddress);
  
  try {
    const token = await ethers.getContractAt("MockERC20", tokenAddress);
    const symbol = await token.symbol();
    const name = await token.name();
    const decimals = await token.decimals();
    
    console.log(`Token at ${tokenAddress}:`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Name: ${name}`);
    console.log(`Decimals: ${decimals}`);
  } catch (error) {
    console.error("Failed to read token:", error);
  }
}

main().catch(console.error);