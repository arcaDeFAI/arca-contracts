import { ethers } from "hardhat";

async function parseLBPairLogs() {
  console.log("\n🔍 Parsing LB Pair Creation Logs\n");
  
  const provider = ethers.provider;
  const txHash = "0xf94ebc1d0a62589d248abfbdf468b646fcec909548f784e2f521e709bf66abf6";
  
  const receipt = await provider.getTransactionReceipt(txHash);
  console.log(`Transaction: ${txHash}`);
  console.log(`Status: ${receipt.status === 1 ? "Success" : "Failed"}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`\nLogs (${receipt.logs.length} total):\n`);
  
  // Try to decode each log
  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`Log ${i}:`);
    console.log(`  Address: ${log.address}`);
    console.log(`  Topics: ${log.topics.length}`);
    for (let j = 0; j < log.topics.length; j++) {
      console.log(`    [${j}]: ${log.topics[j]}`);
    }
    console.log(`  Data: ${log.data}`);
    
    // Try to decode as LBPairCreated event
    if (log.topics.length === 4) {
      console.log(`\n  Attempting to decode as LBPairCreated...`);
      try {
        // Event signature: LBPairCreated(address indexed tokenX, address indexed tokenY, uint16 indexed binStep, address lbPair, uint256 pid)
        const eventSig = "LBPairCreated(address,address,uint16,address,uint256)";
        const eventHash = ethers.keccak256(ethers.toUtf8Bytes(eventSig));
        
        console.log(`  Expected hash: ${eventHash}`);
        console.log(`  Actual hash:   ${log.topics[0]}`);
        
        if (log.topics[0] === eventHash) {
          console.log("  ✅ This is an LBPairCreated event!");
          
          // Decode indexed parameters from topics
          const tokenX = "0x" + log.topics[1].slice(26); // Remove padding
          const tokenY = "0x" + log.topics[2].slice(26); // Remove padding
          const binStep = parseInt(log.topics[3], 16);
          
          // Decode non-indexed parameters from data
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ["address", "uint256"],
            log.data
          );
          
          const lbPair = decoded[0];
          const pid = decoded[1];
          
          console.log(`  Token X: ${tokenX}`);
          console.log(`  Token Y: ${tokenY}`);
          console.log(`  Bin Step: ${binStep}`);
          console.log(`  LB Pair: ${lbPair}`);
          console.log(`  PID: ${pid}`);
          
          return lbPair;
        }
      } catch (e) {
        console.log(`  Could not decode: ${e}`);
      }
    }
    
    console.log("");
  }
  
  console.log("\nChecking factory address...");
  console.log("Factory: 0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7");
  
  // Find which contract emitted the logs
  const uniqueAddresses = [...new Set(receipt.logs.map(log => log.address))];
  console.log("\nUnique addresses in logs:");
  uniqueAddresses.forEach(addr => console.log(`- ${addr}`));
}

async function main() {
  try {
    const pairAddress = await parseLBPairLogs();
    if (pairAddress) {
      console.log(`\n\n✅ Found LB Pair address: ${pairAddress}`);
    }
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});