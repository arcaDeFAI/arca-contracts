import { ethers } from "hardhat";

async function decodeFactoryErrors() {
  console.log("\n🔍 Decoding LB Factory Error Codes\n");
  
  // Common custom errors from LBFactory
  const errorSignatures = [
    "LBFactory__IdenticalAddresses()",
    "LBFactory__QuoteAssetNotWhitelisted(address)",
    "LBFactory__QuoteAssetAlreadyWhitelisted(address)", 
    "LBFactory__AddressZero()",
    "LBFactory__LBPairAlreadyExists(address,address,uint256)",
    "LBFactory__FlashLoanFeeAboveMax(uint256,uint256)",
    "LBFactory__BinStepTooLow(uint256)",
    "LBFactory__PresetIsLockedForUsers(uint256)",
    "LBFactory__LBPairIgnoredIsZero()",
    "LBFactory__BinStepHasNoPreset(uint256)",
    "LBFactory__PresetOpenStateIsAlreadyInTheSameState()",
    "LBFactory__SameFeeRecipient(address)",
    "LBFactory__SameFlashLoanFee()",
    "LBFactory__LBPairSafetyCheckFailed(address)",
    "LBFactory__SameImplementation(address)",
    "LBFactory__ImplementationNotSet()",
    "Ownable__NotOwner()",
    "Ownable__NotPendingOwner()",
    "PendingOwnable__NotOwner()",
    "PendingOwnable__NotPendingOwner()",
    "PendingOwnable__PendingOwnerAlreadySet()",
    "PendingOwnable__NoPendingOwner()",
    "SafeCast__Exceeds248Bits()",
    "SafeCast__Exceeds240Bits()",
    "SafeCast__Exceeds232Bits()",
    "SafeCast__Exceeds224Bits()",
    "SafeCast__Exceeds216Bits()",
    "SafeCast__Exceeds208Bits()",
    "SafeCast__Exceeds200Bits()",
    "SafeCast__Exceeds192Bits()",
    "SafeCast__Exceeds184Bits()",
    "SafeCast__Exceeds176Bits()",
    "SafeCast__Exceeds168Bits()",
    "SafeCast__Exceeds160Bits()",
    "SafeCast__Exceeds152Bits()",
    "SafeCast__Exceeds144Bits()",
    "SafeCast__Exceeds136Bits()",
    "SafeCast__Exceeds128Bits()",
    "SafeCast__Exceeds120Bits()",
    "SafeCast__Exceeds112Bits()",
    "SafeCast__Exceeds104Bits()",
    "SafeCast__Exceeds96Bits()",
    "SafeCast__Exceeds88Bits()",
    "SafeCast__Exceeds80Bits()",
    "SafeCast__Exceeds72Bits()",
    "SafeCast__Exceeds64Bits()",
    "SafeCast__Exceeds56Bits()",
    "SafeCast__Exceeds48Bits()",
    "SafeCast__Exceeds40Bits()",
    "SafeCast__Exceeds32Bits()",
    "SafeCast__Exceeds24Bits()",
    "SafeCast__Exceeds16Bits()",
    "SafeCast__Exceeds8Bits()"
  ];
  
  // Calculate selectors
  console.log("Calculating error selectors...\n");
  const errorMap = new Map();
  
  for (const sig of errorSignatures) {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(sig));
    const selector = hash.slice(0, 10); // First 4 bytes as hex string
    errorMap.set(selector, sig);
  }
  
  // Check our specific errors
  const ourErrors = ["0x8e888ef3", "0x09f85fce"];
  
  console.log("=== Our Error Codes ===");
  for (const error of ourErrors) {
    const sig = errorMap.get(error);
    if (sig) {
      console.log(`${error}: ${sig}`);
      
      // Provide specific explanation
      if (sig.includes("PresetIsLockedForUsers")) {
        console.log("  → This means the bin step preset is not open for public use");
        console.log("  → Only the factory owner can create pairs with this bin step");
      } else if (sig.includes("BinStepHasNoPreset")) {
        console.log("  → This bin step is not configured in the factory at all");
      } else if (sig.includes("BinStepTooLow")) {
        console.log("  → The bin step value is below the minimum allowed");
      }
    } else {
      console.log(`${error}: Unknown error (not in standard list)`);
    }
  }
  
  // Additional analysis
  console.log("\n\n=== Analysis ===");
  console.log("Based on the errors:");
  console.log("- Bin steps 25 and 20 give error 0x8e888ef3");
  console.log("- Bin steps 10, 5, and 1 give error 0x09f85fce");
  console.log("\nThis pattern suggests different bin steps have different issues.");
  
  // Let's also check what the error would be for owner-only functions
  console.log("\n\n=== Checking Specific Error Selectors ===");
  const importantErrors = [
    "LBFactory__PresetIsLockedForUsers(uint256)",
    "LBFactory__BinStepHasNoPreset(uint256)",
    "Ownable__NotOwner()"
  ];
  
  for (const sig of importantErrors) {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(sig));
    const selector = hash.slice(0, 10);
    console.log(`${sig}: ${selector}`);
  }
}

async function main() {
  try {
    await decodeFactoryErrors();
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});