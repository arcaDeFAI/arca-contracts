import { ethers } from "hardhat";
import type { IERC20, ILBPair } from "../../typechain-types";

// Testnet addresses
const ADDRESSES = {
  WS_TOKEN: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
  USDC_TOKEN: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0",
  LB_ROUTER: "0xe77DA7F5B6927fD5E0e825B2B27aca526341069B",
  WS_USDC_POOL_20: "0x76F4aeb24dD5681dCDC23ef9778a95C6aB76a995",
  WS_USDC_POOL_50: "0xAeB979e6f291F82028A29C2240448472B96FA7F2"
};

// Full Router ABI with all swap methods
const ROUTER_ABI = [
  // V2.2 style swap
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) returns (uint256 amountOut)",
  // Alternative swap functions
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) returns (uint256 amountOut)",
  // Get swap quote
  "function getSwapOut(address pair, uint128 amountIn, bool swapForY) view returns (uint128 amountInLeft, uint128 amountOut, uint128 fee)"
];

async function checkPoolAndSwap(poolAddress: string, binStep: number) {
  const [signer] = await ethers.getSigners();
  
  console.log(`\n🔍 Checking pool ${poolAddress} (bin step ${binStep})`);
  
  try {
    // Connect to pool
    const lbPair = await ethers.getContractAt("ILBPair", poolAddress, signer) as ILBPair;
    
    // Get pool info
    const tokenX = await lbPair.getTokenX();
    const tokenY = await lbPair.getTokenY();
    const activeId = await lbPair.getActiveId();
    const { reserveX, reserveY } = await lbPair.getReserves();
    
    console.log(`Token X: ${tokenX} (${tokenX === ADDRESSES.WS_TOKEN ? 'wS' : 'USDC'})`);
    console.log(`Token Y: ${tokenY} (${tokenY === ADDRESSES.USDC_TOKEN ? 'USDC' : 'wS'})`);
    console.log(`Active Bin: ${activeId}`);
    console.log(`Reserves: ${ethers.formatEther(reserveX)} X, ${ethers.formatUnits(reserveY, 6)} Y`);
    
    if (reserveX === 0n && reserveY === 0n) {
      console.log("❌ Pool has no liquidity!");
      return false;
    }
    
    // Determine swap direction
    const swapForY = tokenX === ADDRESSES.WS_TOKEN;
    console.log(`Swap direction: wS → USDC (swapForY: ${swapForY})`);
    
    // Try to get a quote
    const lbRouter = new ethers.Contract(ADDRESSES.LB_ROUTER, ROUTER_ABI, signer);
    const amountIn = ethers.parseEther("1"); // Test with 1 wS
    
    try {
      const quote = await lbRouter.getSwapOut(poolAddress, amountIn, swapForY);
      console.log(`Quote for 1 wS: ${ethers.formatUnits(quote.amountOut, 6)} USDC`);
      return true;
    } catch (quoteError) {
      console.log("❌ Could not get swap quote");
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Error checking pool: ${error}`);
    return false;
  }
}

async function executeSwap(poolAddress: string, binStep: number) {
  const [signer] = await ethers.getSigners();
  
  // Connect to contracts
  const wsToken = await ethers.getContractAt("IERC20", ADDRESSES.WS_TOKEN, signer) as IERC20;
  const usdcToken = await ethers.getContractAt("IERC20", ADDRESSES.USDC_TOKEN, signer) as IERC20;
  const lbRouter = new ethers.Contract(ADDRESSES.LB_ROUTER, ROUTER_ABI, signer);
  
  const wsBalance = await wsToken.balanceOf(signer.address);
  const usdcBalanceBefore = await usdcToken.balanceOf(signer.address);
  
  console.log(`\n💸 Executing swap of ${ethers.formatEther(wsBalance)} wS`);
  
  // Build path - try different version numbers
  const versions = [3, 2, 1, 0]; // Try V2.2, V2.1, V2, V1
  
  for (const version of versions) {
    console.log(`\nTrying with version ${version}...`);
    
    const path = {
      pairBinSteps: [binStep],
      versions: [version],
      tokenPath: [ADDRESSES.WS_TOKEN, ADDRESSES.USDC_TOKEN]
    };
    
    try {
      // Try regular swap first
      const tx = await lbRouter.swapExactTokensForTokens(
        wsBalance,
        0,
        path,
        signer.address,
        Math.floor(Date.now() / 1000) + 3600
      );
      
      const receipt = await tx.wait();
      console.log("✅ Swap successful!");
      console.log(`Transaction: https://testnet.sonicscan.org/tx/${receipt.hash}`);
      
      // Check results
      const usdcBalanceAfter = await usdcToken.balanceOf(signer.address);
      const usdcReceived = usdcBalanceAfter - usdcBalanceBefore;
      console.log(`Received: ${ethers.formatUnits(usdcReceived, 6)} USDC`);
      
      return true;
    } catch (error: any) {
      console.log(`Regular swap failed: ${error?.reason || 'Unknown error'}`);
      
      // Try fee-on-transfer version
      try {
        console.log("Trying fee-on-transfer swap...");
        const tx = await lbRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          wsBalance,
          0,
          path,
          signer.address,
          Math.floor(Date.now() / 1000) + 3600
        );
        
        const receipt = await tx.wait();
        console.log("✅ Fee-on-transfer swap successful!");
        console.log(`Transaction: https://testnet.sonicscan.org/tx/${receipt.hash}`);
        
        const usdcBalanceAfter = await usdcToken.balanceOf(signer.address);
        const usdcReceived = usdcBalanceAfter - usdcBalanceBefore;
        console.log(`Received: ${ethers.formatUnits(usdcReceived, 6)} USDC`);
        
        return true;
      } catch (feeError: any) {
        console.log(`Fee-on-transfer swap also failed: ${feeError?.reason || 'Unknown error'}`);
      }
    }
  }
  
  return false;
}

async function main() {
  console.log("🔄 Pool Check and Swap Script");
  console.log("=============================");
  
  const [signer] = await ethers.getSigners();
  console.log(`Wallet: ${signer.address}`);
  
  // Check both pools
  const pool20Valid = await checkPoolAndSwap(ADDRESSES.WS_USDC_POOL_20, 20);
  const pool50Valid = await checkPoolAndSwap(ADDRESSES.WS_USDC_POOL_50, 50);
  
  // Try to swap using the best pool
  if (pool20Valid) {
    console.log("\n📈 Using 20 bin step pool for swap");
    await executeSwap(ADDRESSES.WS_USDC_POOL_20, 20);
  } else if (pool50Valid) {
    console.log("\n📈 Using 50 bin step pool for swap");
    await executeSwap(ADDRESSES.WS_USDC_POOL_50, 50);
  } else {
    console.log("\n❌ No valid pools found for swapping!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });