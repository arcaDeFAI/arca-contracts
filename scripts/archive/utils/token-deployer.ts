import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { TokenConfig, NetworkConfig } from "../types/config";
import type { MockERC20 } from "../../typechain-types";

export interface DeployedToken {
  address: string;
  contract: MockERC20;
  config: TokenConfig;
}

/**
 * Deploy a mock token
 */
export async function deployMockToken(
  deployer: HardhatEthersSigner,
  tokenConfig: TokenConfig,
  networkName: string
): Promise<DeployedToken> {
  console.log(`Deploying ${tokenConfig.symbol} token...`);

  const MockERC20Factory = await ethers.getContractFactory("MockERC20", deployer);
  const token = await MockERC20Factory.deploy(
    tokenConfig.name,
    tokenConfig.symbol,
    tokenConfig.decimals,
    deployer.address // Initial holder gets 1B tokens
  ) as MockERC20;

  await token.waitForDeployment();
  const address = await token.getAddress();
  
  console.log(`✓ ${tokenConfig.symbol} deployed at: ${address}`);
  console.log(`  Initial supply: 1,000,000,000 ${tokenConfig.symbol} (${tokenConfig.decimals} decimals)`);

  return {
    address,
    contract: token,
    config: tokenConfig
  };
}

/**
 * Distribute tokens to test accounts
 */
export async function distributeTokens(
  token: MockERC20,
  recipients: string[],
  amountPerRecipient: string,
  decimals: number
): Promise<void> {
  const symbol = await token.symbol();
  console.log(`\nDistributing ${symbol} to ${recipients.length} accounts...`);

  const amount = ethers.parseUnits(amountPerRecipient, decimals);

  // Use transfers from deployer's initial balance
  for (const recipient of recipients) {
    const tx = await token.transfer(recipient, amount);
    await tx.wait();
    console.log(`✓ Sent ${amountPerRecipient} ${symbol} to ${recipient}`);
  }
}

/**
 * Deploy shared tokens (like METRO) that are used across multiple vaults
 */
export async function deploySharedTokens(
  deployer: HardhatEthersSigner,
  networkConfig: NetworkConfig
): Promise<Map<string, DeployedToken>> {
  const sharedTokens = new Map<string, DeployedToken>();

  // Deploy METRO token if needed
  if (networkConfig.sharedContracts.metroToken === "DEPLOY_MOCK") {
    const metroConfig: TokenConfig = {
      address: "DEPLOY_MOCK",
      symbol: "METRO",
      name: "Metropolis",
      decimals: 18,
      deployMock: true
    };
    
    const metroToken = await deployMockToken(deployer, metroConfig, networkConfig.name);
    sharedTokens.set("METRO", metroToken);
  }

  return sharedTokens;
}

/**
 * Get unique tokens that need to be deployed from vault configurations
 */
export function getUniqueTokensToDeploy(vaults: NetworkConfig["vaults"]): Map<string, TokenConfig> {
  const uniqueTokens = new Map<string, TokenConfig>();

  for (const vault of vaults) {
    if (!vault.enabled) continue;

    // Check tokenX
    if (vault.tokens.tokenX.deployMock && vault.tokens.tokenX.address === "DEPLOY_MOCK") {
      const key = vault.tokens.tokenX.symbol;
      if (!uniqueTokens.has(key)) {
        uniqueTokens.set(key, vault.tokens.tokenX);
      }
    }

    // Check tokenY
    if (vault.tokens.tokenY.deployMock && vault.tokens.tokenY.address === "DEPLOY_MOCK") {
      const key = vault.tokens.tokenY.symbol;
      if (!uniqueTokens.has(key)) {
        uniqueTokens.set(key, vault.tokens.tokenY);
      }
    }
  }

  return uniqueTokens;
}

/**
 * Fund native tokens (ETH/S) to test accounts
 */
export async function fundNativeTokens(
  deployer: HardhatEthersSigner,
  recipients: string[],
  amountPerRecipient: string
): Promise<void> {
  console.log(`\nFunding native tokens to ${recipients.length} accounts...`);
  
  const amount = ethers.parseEther(amountPerRecipient);
  
  for (const recipient of recipients) {
    const tx = await deployer.sendTransaction({
      to: recipient,
      value: amount
    });
    await tx.wait();
    console.log(`✓ Sent ${amountPerRecipient} ETH to ${recipient}`);
  }
}

/**
 * Deploy specific tokens by symbol
 */
export async function deploySpecificTokens(
  deployer: HardhatEthersSigner,
  networkConfig: NetworkConfig,
  tokenSymbols: string[]
): Promise<Map<string, DeployedToken>> {
  const deployedTokens = new Map<string, DeployedToken>();

  for (const symbol of tokenSymbols) {
    // Check if it's METRO (shared token)
    if (symbol === "METRO" && networkConfig.sharedContracts.metroToken === "DEPLOY_MOCK") {
      const metroConfig: TokenConfig = {
        address: "DEPLOY_MOCK",
        symbol: "METRO",
        name: "Metropolis",
        decimals: 18,
        deployMock: true
      };
      const metroToken = await deployMockToken(deployer, metroConfig, networkConfig.name);
      deployedTokens.set("METRO", metroToken);
      continue;
    }

    // Find token config in vault configurations
    let tokenConfig: TokenConfig | undefined;
    for (const vault of networkConfig.vaults) {
      if (vault.tokens.tokenX.symbol === symbol && vault.tokens.tokenX.deployMock) {
        tokenConfig = vault.tokens.tokenX;
        break;
      }
      if (vault.tokens.tokenY.symbol === symbol && vault.tokens.tokenY.deployMock) {
        tokenConfig = vault.tokens.tokenY;
        break;
      }
    }

    if (tokenConfig) {
      const deployedToken = await deployMockToken(deployer, tokenConfig, networkConfig.name);
      deployedTokens.set(symbol, deployedToken);
    } else {
      console.warn(`⚠️  Token config not found for symbol: ${symbol}`);
    }
  }

  return deployedTokens;
}

/**
 * Deploy all tokens needed for the network configuration
 */
export async function deployAllTokens(
  deployer: HardhatEthersSigner,
  networkConfig: NetworkConfig
): Promise<Map<string, DeployedToken>> {
  const deployedTokens = new Map<string, DeployedToken>();

  // Deploy shared tokens first
  const sharedTokens = await deploySharedTokens(deployer, networkConfig);
  sharedTokens.forEach((token, symbol) => {
    deployedTokens.set(symbol, token);
  });

  // Get unique tokens from vault configurations
  const uniqueTokens = getUniqueTokensToDeploy(networkConfig.vaults);
  
  // Deploy each unique token
  for (const [symbol, tokenConfig] of uniqueTokens) {
    // Skip if already deployed (e.g., METRO might be shared)
    if (!deployedTokens.has(symbol)) {
      const deployedToken = await deployMockToken(deployer, tokenConfig, networkConfig.name);
      deployedTokens.set(symbol, deployedToken);
    }
  }

  // Distribute tokens to test accounts if configured
  if (networkConfig.testAccounts && networkConfig.testAccounts.count > 0) {
    const signers = await ethers.getSigners();
    const testAccounts = signers
      .slice(1, Math.min(networkConfig.testAccounts.count + 1, signers.length))
      .map(signer => signer.address);

    if (testAccounts.length > 0) {
      console.log(`\n📦 Distributing tokens to ${testAccounts.length} test accounts...`);
      
      for (const [symbol, deployedToken] of deployedTokens) {
        await distributeTokens(
          deployedToken.contract,
          testAccounts,
          networkConfig.testAccounts.fundingAmount,
          deployedToken.config.decimals
        );
      }

      // Fund native tokens if on localhost
      if (networkConfig.name === "localhost" || networkConfig.name === "hardhat") {
        await fundNativeTokens(deployer, testAccounts, "10");
      }
    }
  }

  return deployedTokens;
}