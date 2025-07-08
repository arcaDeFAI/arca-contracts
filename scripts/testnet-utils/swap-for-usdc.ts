import { ethers } from "hardhat";
import type { IERC20, ILBPair } from "../../typechain-types";
import * as readline from 'node:readline';

// Testnet addresses
const ADDRESSES = {
  WS_TOKEN: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
  USDC_TOKEN: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0",
  LB_ROUTER: "0xe77DA7F5B6927fD5E0e825B2B27aca526341069B",
  WS_USDC_POOL_20: "0x76F4aeb24dD5681dCDC23ef9778a95C6aB76a995", // Better liquidity
  WS_USDC_POOL_50: "0xAeB979e6f291F82028A29C2240448472B96FA7F2"
};

// WETH-style interface for Wrapped S
const WRAPPED_S_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// Router ABI with swap functions
const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) returns (uint256 amountOut)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) returns (uint256 amountOut)",
  "function getSwapOut(address pair, uint128 amountIn, bool swapForY) view returns (uint128 amountInLeft, uint128 amountOut, uint128 fee)"
];

async function checkPoolStatus(poolAddress: string, binStep: number) {
  const [signer] = await ethers.getSigners();
  
  console.log(`\n🔍 Checking pool ${poolAddress} (bin step ${binStep})`);
  
  try {
    const lbPair = await ethers.getContractAt("ILBPair", poolAddress, signer) as ILBPair;
    const { reserveX, reserveY } = await lbPair.getReserves();
    
    console.log(`Reserves: ${ethers.formatEther(reserveX)} wS, ${ethers.formatUnits(reserveY, 6)} USDC`);
    
    if (reserveX === 0n && reserveY === 0n) {
      console.log("❌ Pool has no liquidity!");
      return false;
    }
    
    // Get a quote for 1 wS
    const lbRouter = new ethers.Contract(ADDRESSES.LB_ROUTER, ROUTER_ABI, signer);
    const quote = await lbRouter.getSwapOut(poolAddress, ethers.parseEther("1"), true);
    console.log(`Price: 1 wS = ${ethers.formatUnits(quote.amountOut, 6)} USDC`);
    
    return true;
  } catch (error) {
    console.log(`❌ Error checking pool`);
    return false;
  }
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("💱 Swap S to USDC on Sonic Testnet");
  console.log("==================================");
  console.log(`Wallet: ${signer.address}`);

  // Connect to contracts
  const wrappedS = new ethers.Contract(ADDRESSES.WS_TOKEN, WRAPPED_S_ABI, signer);
  const usdcToken = await ethers.getContractAt("IERC20", ADDRESSES.USDC_TOKEN, signer) as IERC20;
  const lbRouter = new ethers.Contract(ADDRESSES.LB_ROUTER, ROUTER_ABI, signer);

  // Check balances
  const nativeBalance = await ethers.provider.getBalance(signer.address);
  const wsBalance = await wrappedS.balanceOf(signer.address);
  const usdcBalanceBefore = await usdcToken.balanceOf(signer.address);
  
  console.log(`\n💰 Current Balances:`);
  console.log(`Native S: ${ethers.formatEther(nativeBalance)}`);
  console.log(`Wrapped S: ${ethers.formatEther(wsBalance)}`);
  console.log(`USDC: ${ethers.formatUnits(usdcBalanceBefore, 6)}`);

  // Determine how much to wrap (if needed)
  let amountToProcess = wsBalance;
  
  if (wsBalance === 0n) {
    if (nativeBalance === 0n) {
      console.log("\n❌ No S tokens! Get some from: https://testnet.soniclabs.com/account");
      return;
    }
    
    // Ask user how much to wrap
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const amountToWrap = await new Promise<string>((resolve) => {
      rl.question(`\nHow much S to wrap and swap? (max: ${ethers.formatEther(nativeBalance - ethers.parseEther("0.1"))}): `, resolve);
    });
    rl.close();
    
    const wrapAmount = ethers.parseEther(amountToWrap);
    if (wrapAmount > nativeBalance - ethers.parseEther("0.1")) {
      console.log("❌ Amount too high! Keep some S for gas.");
      return;
    }
    
    // Wrap S tokens
    console.log(`\n1️⃣ Wrapping ${amountToWrap} S...`);
    const wrapTx = await wrappedS.deposit({ value: wrapAmount });
    await wrapTx.wait();
    console.log("✅ Wrapped!");
    
    amountToProcess = wrapAmount;
  }

  // Check pools
  const pool20Valid = await checkPoolStatus(ADDRESSES.WS_USDC_POOL_20, 20);
  const pool50Valid = await checkPoolStatus(ADDRESSES.WS_USDC_POOL_50, 50);
  
  if (!pool20Valid && !pool50Valid) {
    console.log("\n❌ No valid pools with liquidity!");
    return;
  }

  // Use the pool with better liquidity (20 bin step preferred)
  const poolToUse = pool20Valid ? 
    { address: ADDRESSES.WS_USDC_POOL_20, binStep: 20 } : 
    { address: ADDRESSES.WS_USDC_POOL_50, binStep: 50 };

  // Approve router
  console.log(`\n2️⃣ Approving router...`);
  const currentAllowance = await wrappedS.allowance(signer.address, ADDRESSES.LB_ROUTER);
  if (currentAllowance < amountToProcess) {
    const approveTx = await wrappedS.approve(ADDRESSES.LB_ROUTER, amountToProcess);
    await approveTx.wait();
    console.log("✅ Approved!");
  } else {
    console.log("✅ Already approved!");
  }

  // Execute swap (Version 2 works on testnet)
  console.log(`\n3️⃣ Swapping ${ethers.formatEther(amountToProcess)} wS for USDC...`);
  const path = {
    pairBinSteps: [poolToUse.binStep],
    versions: [2], // Version 2 works on Sonic testnet
    tokenPath: [ADDRESSES.WS_TOKEN, ADDRESSES.USDC_TOKEN]
  };

  try {
    const tx = await lbRouter.swapExactTokensForTokens(
      amountToProcess,
      0, // Accept any amount
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
    
    console.log(`\n💰 Final Balances:`);
    console.log(`USDC: ${ethers.formatUnits(usdcBalanceAfter, 6)}`);
    console.log(`\n✨ Received: ${ethers.formatUnits(usdcReceived, 6)} USDC`);

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("❌ Swap failed:", error.message || error);
    }
    else {
      console.error("❌ Swap failed:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });