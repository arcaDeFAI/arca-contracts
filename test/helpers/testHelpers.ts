import { ethers } from "hardhat";
import { Contract } from "ethers";

/**
 * Test helper utilities for vault unit tests
 */

// Common test constants
export const SHARES_DECIMALS = 6;
export const SHARES_PRECISION = 10n ** BigInt(SHARES_DECIMALS);

// Common test addresses
export const TEST_ADDRESSES = {
  ALICE: "0x0000000000000000000000000000000000000001",
  BOB: "0x0000000000000000000000000000000000000002",
  OPERATOR: "0x0000000000000000000000000000000000000003",
  FACTORY: "0x0000000000000000000000000000000000000004"
};

/**
 * Calculate expected shares for first deposit
 */
export function calculateFirstDepositShares(valueInY: bigint): bigint {
  return valueInY * SHARES_PRECISION;
}

/**
 * Calculate expected shares for subsequent deposits
 */
export function calculateSubsequentDepositShares(
  valueInY: bigint,
  totalShares: bigint,
  totalValueInY: bigint
): bigint {
  if (totalValueInY === 0n) return 0n;
  return (valueInY * totalShares) / totalValueInY;
}

/**
 * Convert amount between different decimal precisions
 */
export function convertDecimals(
  amount: bigint,
  fromDecimals: number,
  toDecimals: number
): bigint {
  if (fromDecimals === toDecimals) {
    return amount;
  } else if (fromDecimals > toDecimals) {
    return amount / (10n ** BigInt(fromDecimals - toDecimals));
  } else {
    return amount * (10n ** BigInt(toDecimals - fromDecimals));
  }
}

/**
 * Calculate value in Y token units given price
 */
export function calculateValueInY(
  amountX: bigint,
  amountY: bigint,
  priceXInY: bigint,
  decimalsX: number,
  decimalsY: number
): bigint {
  // Convert X to Y value: (amountX * priceXInY) / 10^decimalsX
  const amountXInY = (amountX * priceXInY) / (10n ** BigInt(decimalsX));
  
  // Total value = X value in Y + Y amount
  return amountXInY + amountY;
}

/**
 * Assert values are equal within a small tolerance for rounding
 */
export function expectWithinTolerance(
  actual: bigint,
  expected: bigint,
  tolerance: bigint
): void {
  const diff = actual > expected ? actual - expected : expected - actual;
  if (diff > tolerance) {
    throw new Error(
      `Values differ by more than tolerance. Actual: ${actual}, Expected: ${expected}, Diff: ${diff}, Tolerance: ${tolerance}`
    );
  }
}

/**
 * Deploy a mock ERC20 token with specified decimals
 */
export async function deployMockToken(
  name: string,
  symbol: string,
  decimals: number,
  initialHolder: string = ethers.ZeroAddress
): Promise<Contract> {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  return await MockERC20.deploy(name, symbol, decimals, initialHolder);
}

/**
 * Setup test tokens with different decimals and mint to addresses
 */
export async function setupTestTokens() {
  const [deployer] = await ethers.getSigners();
  
  // Deploy tokens with deployer as initial holder
  const tokenX = await deployMockToken("Token X", "TX", 18, deployer.address); // ETH-like
  const tokenY = await deployMockToken("Token Y", "TY", 6, deployer.address);  // USDC-like
  
  // Mint additional tokens to test addresses
  const mintAmount18 = ethers.parseEther("1000000"); // 1M tokens with 18 decimals
  const mintAmount6 = ethers.parseUnits("1000000", 6); // 1M tokens with 6 decimals
  
  await tokenX.mint(TEST_ADDRESSES.ALICE, mintAmount18);
  await tokenX.mint(TEST_ADDRESSES.BOB, mintAmount18);
  await tokenY.mint(TEST_ADDRESSES.ALICE, mintAmount6);
  await tokenY.mint(TEST_ADDRESSES.BOB, mintAmount6);
  
  return { tokenX, tokenY };
}

/**
 * Get sqrt price X96 from a simple price ratio
 * Simplified calculation for testing purposes
 */
export function getSqrtPriceX96FromPrice(price: number): bigint {
  // For testing: convert price to sqrt(price) * 2^96
  // This is a simplified version - real implementation would be more precise
  const sqrtPrice = Math.sqrt(price);
  const Q96 = 2n ** 96n;
  return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

/**
 * Get tick from price (simplified for testing)
 */
export function getTickFromPrice(price: number): number {
  // log_1.0001(price) = ln(price) / ln(1.0001)
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

/**
 * Create test vault initialization data
 */
export function createVaultInitData(
  tokenX: string,
  tokenY: string,
  decimalsX: number,
  decimalsY: number,
  extraAddress: string, // oracle helper or pool
  wnative: string = ethers.ZeroAddress,
  factory: string = TEST_ADDRESSES.FACTORY
): string {
  return ethers.solidityPacked(
    ["address", "address", "address", "uint8", "uint8", "address", "address"],
    [tokenX, tokenY, extraAddress, decimalsX, decimalsY, wnative, factory]
  );
}