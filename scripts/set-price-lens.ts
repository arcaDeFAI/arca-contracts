import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Setting PriceLens with account:", signer.address);
  
  const vaultFactory = await ethers.getContractAt("VaultFactory", "0x1DD9f2cCD4b48a274938E88E205516FF3eF6720C");
  const priceLens = "0x8bF65Ab156b83bB6169866e5D2A14AeC0Ff87c7B";
  
  console.log("Calling setPriceLens...");
  const tx = await vaultFactory.setPriceLens(priceLens);
  console.log("Transaction hash:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("✅ PriceLens set successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });