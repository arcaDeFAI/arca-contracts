import { ethers } from "hardhat";

interface LBPairInfo {
  tokenX: string;
  tokenY: string;
  binStep: number;
  lbPair: string;
  tokenXSymbol?: string;
  tokenYSymbol?: string;
  tokenXName?: string;
  tokenYName?: string;
  reserves?: {
    reserveX: string;
    reserveY: string;
  };
}

async function discoverAllLBPairs() {
  console.log("\n🔍 Discovering All LB Pairs on Sonic Blaze Testnet\n");

  const factoryAddress = "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7";
  
  // Factory ABI with events and functions we need
  const factoryABI = [
    "event LBPairCreated(address indexed tokenX, address indexed tokenY, uint256 indexed binStep, address lbPair, uint256 pid)",
    "function getNumberOfLBPairs() view returns (uint256)",
    "function getLBPairAtIndex(uint256 index) view returns (address)",
    "function allLBPairs(uint256) view returns (address)",
    "function getLBPairInformation(address tokenA, address tokenB, uint16 binStep) view returns (uint16 binStep, address lbPair, bool createdByOwner, bool ignoredForRouting)"
  ];

  // LB Pair ABI
  const pairABI = [
    "function getTokenX() view returns (address)",
    "function getTokenY() view returns (address)",
    "function getBinStep() view returns (uint16)",
    "function getReserves() view returns (uint128 reserveX, uint128 reserveY)",
    "function getActiveId() view returns (uint24)"
  ];

  // ERC20 ABI for token info
  const erc20ABI = [
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function decimals() view returns (uint8)"
  ];

  const [signer] = await ethers.getSigners();
  const factory = new ethers.Contract(factoryAddress, factoryABI, signer);

  console.log("Factory Address:", factoryAddress);
  console.log("Connected with:", await signer.getAddress());
  
  const allPairs: LBPairInfo[] = [];

  // Method 1: Try to get number of pairs and iterate
  try {
    console.log("\n=== Method 1: Using getNumberOfLBPairs ===");
    const numberOfPairs = await factory.getNumberOfLBPairs();
    console.log(`Total number of LB Pairs: ${numberOfPairs}`);

    if (numberOfPairs > 0) {
      const maxPairs = numberOfPairs > 20n ? 20n : numberOfPairs;
      for (let i = 0n; i < maxPairs; i++) { // Limit to first 20 pairs
        try {
          // Try different methods to get pair at index
          let pairAddress;
          try {
            pairAddress = await factory.getLBPairAtIndex(i);
          } catch {
            try {
              pairAddress = await factory.allLBPairs(i);
            } catch {
              console.log(`Could not get pair at index ${i}`);
              continue;
            }
          }

          if (pairAddress && pairAddress !== ethers.ZeroAddress) {
            const pairInfo = await getPairInfo(pairAddress, pairABI, erc20ABI, signer);
            if (pairInfo) {
              allPairs.push(pairInfo);
              console.log(`\nPair ${i}:`, formatPairInfo(pairInfo));
            }
          }
        } catch (error) {
          console.log(`Error getting pair at index ${i}:`, error);
        }
      }
    }
  } catch (error) {
    console.log("getNumberOfLBPairs not available or failed:", error);
  }

  // Method 2: Query historical events
  console.log("\n\n=== Method 2: Querying LBPairCreated Events ===");
  try {
    // Get recent blocks (last 10000 blocks, but query in chunks of 500)
    const currentBlock = await ethers.provider.getBlockNumber();
    const startBlock = Math.max(0, currentBlock - 10000);
    
    console.log(`Querying events from block ${startBlock} to ${currentBlock}...`);
    
    const filter = factory.filters.LBPairCreated();
    const allEvents = [];
    
    // Query in chunks of 500 blocks
    for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += 500) {
      const toBlock = Math.min(fromBlock + 499, currentBlock);
      try {
        const events = await factory.queryFilter(filter, fromBlock, toBlock);
        allEvents.push(...events);
      } catch (error) {
        console.log(`Error querying blocks ${fromBlock}-${toBlock}:`, error.message);
      }
    }
    
    const events = allEvents;
    
    console.log(`Found ${events.length} LBPairCreated events`);

    for (const event of events) {
      if (event.args) {
        const pairInfo: LBPairInfo = {
          tokenX: event.args.tokenX,
          tokenY: event.args.tokenY,
          binStep: Number(event.args.binStep),
          lbPair: event.args.lbPair
        };

        // Get additional info
        try {
          const extendedInfo = await getPairInfo(pairInfo.lbPair, pairABI, erc20ABI, signer);
          if (extendedInfo) {
            Object.assign(pairInfo, extendedInfo);
          }
        } catch (error) {
          console.log(`Could not get extended info for pair ${pairInfo.lbPair}`);
        }

        // Check if already in list
        const exists = allPairs.some(p => p.lbPair === pairInfo.lbPair);
        if (!exists) {
          allPairs.push(pairInfo);
          console.log(`\nDiscovered Pair:`, formatPairInfo(pairInfo));
        }
      }
    }
  } catch (error) {
    console.log("Error querying events:", error);
  }

  // Method 3: Check known pairs from deployment files
  console.log("\n\n=== Method 3: Checking Known Pairs ===");
  const knownPairs = [
    "0xf931d5d6a019961096aaf4749e05d123e1b38a55", // S-USDC
    "0xc1603bA905f4E268CDf451591eF51bdFb1185EEB", // TEST1-USDC  
    "0xf8a54e0045dd6be8F13D40dAe1d162f5e3Cd3bbB", // TEST2-USDC
    "0xE46d2bC68B23c680f717D40fC2E7CC68b2F2F8a5"  // FUNKY1-USDC
  ];

  for (const pairAddress of knownPairs) {
    try {
      const pairInfo = await getPairInfo(pairAddress, pairABI, erc20ABI, signer);
      if (pairInfo) {
        const exists = allPairs.some(p => p.lbPair === pairInfo.lbPair);
        if (!exists) {
          allPairs.push(pairInfo);
          console.log(`\nKnown Pair:`, formatPairInfo(pairInfo));
        }
      }
    } catch (error) {
      console.log(`Error checking known pair ${pairAddress}:`, error);
    }
  }

  // Summary
  console.log("\n\n=== SUMMARY ===");
  console.log(`Total unique LB Pairs discovered: ${allPairs.length}`);
  
  if (allPairs.length > 0) {
    console.log("\nAll discovered pairs:");
    allPairs.forEach((pair, index) => {
      console.log(`\n${index + 1}. ${formatPairInfo(pair)}`);
    });

    // Group by token pairs
    console.log("\n\n=== Pairs grouped by tokens ===");
    const groupedPairs = new Map<string, LBPairInfo[]>();
    
    for (const pair of allPairs) {
      const key = `${pair.tokenXSymbol || pair.tokenX}-${pair.tokenYSymbol || pair.tokenY}`;
      if (!groupedPairs.has(key)) {
        groupedPairs.set(key, []);
      }
      groupedPairs.get(key)!.push(pair);
    }

    for (const [tokens, pairs] of groupedPairs) {
      console.log(`\n${tokens}:`);
      pairs.forEach(p => {
        console.log(`  - Bin Step: ${p.binStep}, Address: ${p.lbPair}`);
        if (p.reserves) {
          console.log(`    Reserves: ${p.reserves.reserveX} / ${p.reserves.reserveY}`);
        }
      });
    }
  }
}

async function getPairInfo(
  pairAddress: string,
  pairABI: string[],
  erc20ABI: string[],
  signer: ethers.Signer
): Promise<LBPairInfo | null> {
  try {
    const pair = new ethers.Contract(pairAddress, pairABI, signer);
    
    const [tokenX, tokenY, binStep] = await Promise.all([
      pair.getTokenX(),
      pair.getTokenY(),
      pair.getBinStep()
    ]);

    const pairInfo: LBPairInfo = {
      tokenX,
      tokenY,
      binStep: Number(binStep),
      lbPair: pairAddress
    };

    // Try to get token info
    try {
      const tokenXContract = new ethers.Contract(tokenX, erc20ABI, signer);
      const tokenYContract = new ethers.Contract(tokenY, erc20ABI, signer);

      const [symbolX, symbolY, nameX, nameY] = await Promise.all([
        tokenXContract.symbol().catch(() => "???"),
        tokenYContract.symbol().catch(() => "???"),
        tokenXContract.name().catch(() => "Unknown"),
        tokenYContract.name().catch(() => "Unknown")
      ]);

      pairInfo.tokenXSymbol = symbolX;
      pairInfo.tokenYSymbol = symbolY;
      pairInfo.tokenXName = nameX;
      pairInfo.tokenYName = nameY;
    } catch (error) {
      // Token info not available
    }

    // Try to get reserves
    try {
      const reserves = await pair.getReserves();
      pairInfo.reserves = {
        reserveX: reserves.reserveX.toString(),
        reserveY: reserves.reserveY.toString()
      };
    } catch (error) {
      // Reserves not available
    }

    return pairInfo;
  } catch (error) {
    return null;
  }
}

function formatPairInfo(pair: LBPairInfo): string {
  const tokenXDisplay = pair.tokenXSymbol || pair.tokenX.slice(0, 6) + "...";
  const tokenYDisplay = pair.tokenYSymbol || pair.tokenY.slice(0, 6) + "...";
  let info = `${tokenXDisplay}-${tokenYDisplay} (Bin Step: ${pair.binStep}) at ${pair.lbPair}`;
  
  if (pair.reserves && (pair.reserves.reserveX !== "0" || pair.reserves.reserveY !== "0")) {
    info += ` [Liquidity: ✓]`;
  } else {
    info += ` [Liquidity: Empty]`;
  }
  
  return info;
}

async function main() {
  try {
    await discoverAllLBPairs();
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});