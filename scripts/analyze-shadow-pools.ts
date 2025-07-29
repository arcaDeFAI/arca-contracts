import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as csv from "csv-parse/sync";

interface PoolData {
  poolAddress: string;
  token0Address: string;
  token0Symbol: string;
  token0Balance: string;
  token1Address: string;
  token1Symbol: string;
  token1Balance: string;
  currentLiquidity: string;
  fee: number;
  currentTick: number;
  sqrtPriceX96: string;
}

// SafeERC20Namer-inspired functions
function bytes32ToString(bytes32: string): string {
  const hex = bytes32.slice(2);
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.substr(i, 2), 16);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str;
}

async function getTokenSymbol(tokenAddress: string): Promise<string> {
  try {
    // Try to get symbol using the standard interface
    const tokenContract = await ethers.getContractAt(
      ["function symbol() view returns (string)"], 
      tokenAddress
    );
    const symbol = await tokenContract.symbol();
    return symbol;
  } catch (error) {
    // If standard call fails, try bytes32 version
    try {
      const tokenContract = await ethers.getContractAt(
        ["function symbol() view returns (bytes32)"], 
        tokenAddress
      );
      const symbolBytes32 = await tokenContract.symbol();
      return bytes32ToString(symbolBytes32);
    } catch {
      // If both fail, return a shortened address as fallback
      return tokenAddress.slice(0, 6) + "..." + tokenAddress.slice(-4);
    }
  }
}

async function getTokenBalance(tokenAddress: string, holderAddress: string): Promise<bigint> {
  try {
    const token = await ethers.getContractAt(
      ["function balanceOf(address) view returns (uint256)"],
      tokenAddress
    );
    return await token.balanceOf(holderAddress);
  } catch {
    return 0n;
  }
}

async function analyzePool(poolAddress: string, showDetails: boolean = false): Promise<PoolData | null> {
  try {
    // Get pool contract
    const pool = await ethers.getContractAt("IRamsesV3Pool", poolAddress);
    
    // Get token addresses
    const token0Address = await pool.token0();
    const token1Address = await pool.token1();
    
    // Get token symbols
    const token0Symbol = await getTokenSymbol(token0Address);
    const token1Symbol = await getTokenSymbol(token1Address);
    
    // Get token balances in the pool
    const token0Balance = await getTokenBalance(token0Address, poolAddress);
    const token1Balance = await getTokenBalance(token1Address, poolAddress);
    
    // Get pool state
    const [sqrtPriceX96, currentTick, , , , , ] = await pool.slot0();
    const currentLiquidity = await pool.liquidity();
    const fee = await pool.fee();
    
    // Only show details if requested
    if (showDetails) {
      console.log(`  Token0: ${token0Address} (${token0Symbol})`);
      console.log(`  Token1: ${token1Address} (${token1Symbol})`);
      console.log(`  Token0 Balance: ${ethers.formatUnits(token0Balance, 18)}`);
      console.log(`  Token1 Balance: ${ethers.formatUnits(token1Balance, 18)}`);
      console.log(`  Current Liquidity: ${currentLiquidity.toString()}`);
      console.log(`  Fee Tier: ${Number(fee) / 10000}%`);
      console.log(`  Current Tick: ${currentTick}`);
    } else {
      // Compact output for batch processing
      console.log(`  ✓ ${token0Symbol}/${token1Symbol} - Fee: ${Number(fee) / 10000}%`);
    }
    
    return {
      poolAddress,
      token0Address,
      token0Symbol,
      token0Balance: token0Balance.toString(),
      token1Address,
      token1Symbol,
      token1Balance: token1Balance.toString(),
      currentLiquidity: currentLiquidity.toString(),
      fee: Number(fee),
      currentTick,
      sqrtPriceX96: sqrtPriceX96.toString()
    };
  } catch (error) {
    // Quiet error handling for batch processing
    console.log(`  ✗ Failed to analyze`);
    return null;
  }
}

async function main() {
  console.log(`Analyzing Shadow pools on ${network.name}...`);
  
  // Find all export-internal-transactions-*.csv files
  const researchDir = path.join(__dirname, "../research");
  const csvFiles = fs.readdirSync(researchDir)
    .filter(file => file.startsWith("export-internal-transactions-") && file.endsWith(".csv"))
    .map(file => path.join(researchDir, file));
  
  console.log(`Found ${csvFiles.length} CSV files to process`);
  
  // Use a Set to collect unique pool addresses
  const uniquePoolAddresses = new Set<string>();
  let totalRecords = 0;
  let failedFiles = 0;
  
  // Process each CSV file
  for (const csvPath of csvFiles) {
    try {
      console.log(`\nProcessing: ${path.basename(csvPath)}`);
      const csvContent = fs.readFileSync(csvPath, "utf-8");
      const records = csv.parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        bom: true
      });
      
      totalRecords += records.length;
      
      // Extract pool addresses from the "To" column
      const poolAddresses = records
        .map((record: any) => record.To)
        .filter((addr: string) => addr && addr !== "" && addr !== "0x0000000000000000000000000000000000000000");
      
      // Add to the Set (automatically handles duplicates)
      // Use checksummed addresses for consistency
      poolAddresses.forEach((addr: string) => {
        try {
          const checksummedAddr = ethers.getAddress(addr);
          uniquePoolAddresses.add(checksummedAddr);
        } catch {
          // Skip invalid addresses
        }
      });
      
      console.log(`  - Found ${records.length} records, ${poolAddresses.length} pool addresses`);
    } catch (error) {
      console.error(`  ❌ Failed to process ${path.basename(csvPath)}:`, error);
      failedFiles++;
    }
  }
  
  const poolAddressArray = Array.from(uniquePoolAddresses);
  console.log(`\n📊 Summary:`);
  console.log(`  - Total CSV files: ${csvFiles.length}`);
  console.log(`  - Successfully processed: ${csvFiles.length - failedFiles}`);
  console.log(`  - Failed files: ${failedFiles}`);
  console.log(`  - Total records: ${totalRecords}`);
  console.log(`  - Unique pool addresses: ${poolAddressArray.length}`);
  
  console.log(`\nAnalyzing ${poolAddressArray.length} unique pools...`);
  
  // Analyze each pool with progress tracking
  const poolDataList: PoolData[] = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < poolAddressArray.length; i++) {
    const poolAddress = poolAddressArray[i];
    console.log(`\n[${i + 1}/${poolAddressArray.length}] Analyzing pool: ${poolAddress}`);
    
    const poolData = await analyzePool(poolAddress);
    if (poolData) {
      poolDataList.push(poolData);
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`\n📊 Analysis Complete:`);
  console.log(`  - Total unique pools: ${poolAddressArray.length}`);
  console.log(`  - Successfully analyzed: ${successCount}`);
  console.log(`  - Failed to analyze: ${failCount}`);
  
  // Create output CSV
  const outputPath = path.join(__dirname, "../research", `shadow-pools-analysis-${Date.now()}.csv`);
  
  const csvHeader = [
    "Pool Address",
    "Token0 Address", 
    "Token0 Symbol",
    "Token0 Balance",
    "Token1 Address",
    "Token1 Symbol", 
    "Token1 Balance",
    "Current Liquidity",
    "Fee Tier (%)",
    "Current Tick",
    "Sqrt Price X96"
  ].join(",");
  
  const csvRows = poolDataList.map(data => [
    data.poolAddress,
    data.token0Address,
    data.token0Symbol,
    data.token0Balance,
    data.token1Address,
    data.token1Symbol,
    data.token1Balance,
    data.currentLiquidity,
    (data.fee / 10000).toString(),
    data.currentTick.toString(),
    data.sqrtPriceX96
  ].join(","));
  
  const csvOutput = [csvHeader, ...csvRows].join("\n");
  
  fs.writeFileSync(outputPath, csvOutput);
  console.log(`\n📄 Analysis results saved to: ${outputPath}`);
  
  // Print summary
  console.log("\n=== Summary ===");
  console.log(`Total pools analyzed: ${poolDataList.length}`);
  
  // Group by token pairs
  const pairCounts = new Map<string, number>();
  poolDataList.forEach(data => {
    const pair = `${data.token0Symbol}/${data.token1Symbol}`;
    pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
  });
  
  console.log("\nToken pairs found:");
  Array.from(pairCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([pair, count]) => {
      console.log(`  ${pair}: ${count} pool(s)`);
    });
  
  // Show fee tier distribution
  const feeTierCounts = new Map<number, number>();
  poolDataList.forEach(data => {
    feeTierCounts.set(data.fee, (feeTierCounts.get(data.fee) || 0) + 1);
  });
  
  console.log("\nFee tier distribution:");
  Array.from(feeTierCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([fee, count]) => {
      console.log(`  ${fee / 10000}%: ${count} pool(s)`);
    });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });