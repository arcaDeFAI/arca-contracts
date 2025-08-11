import * as fs from "fs";
import * as path from "path";
import type { DeploymentConfig } from "../../archive/deployArcaSystem";

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl?: string;
  blockExplorer?: string;
  deployment: {
    binStep: number;
    amountXMin: string;
    amountYMin: string;
    vaultName: string;
    vaultSymbol: string;
    idSlippage: string;
    feeRecipient: string;
  };
  contracts: {
    tokenX: string;
    tokenY: string;
    lbRouter: string;
    lbpAMM: string;
    lbpContract: string;
    rewarder: string;
    rewardToken: string;
    nativeToken: string;
    lbpContractUSD: string;
  };
  mockTokens?: {
    tokenX: {
      name: string;
      symbol: string;
      decimals: number;
      initialSupply: string;
    };
    tokenY: {
      name: string;
      symbol: string;
      decimals: number;
      initialSupply: string;
    };
    rewardToken: {
      name: string;
      symbol: string;
      decimals: number;
      initialSupply: string;
    };
  };
  testAccounts?: {
    fundingAmounts: {
      tokenX: string;
      tokenY: string;
      native: string;
    };
    count: number;
  };
  gasSettings?: {
    gasPrice: string | number;
    gasLimit: number;
  };
  security?: {
    requireMultisig: boolean;
    timelockDelay: number;
    upgradeDelay: number;
  };
}

export function loadNetworkConfig(network: string): NetworkConfig {
  const configPath = path.join(__dirname, "../../config/networks", `${network}.json`);
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`Network configuration not found for ${network} at ${configPath}`);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  
  // Validate required fields
  if (!config.name || !config.chainId || !config.deployment || !config.contracts) {
    throw new Error(`Invalid network configuration for ${network}`);
  }
  
  return config;
}

export function networkConfigToDeploymentConfig(
  networkConfig: NetworkConfig,
  overrides?: Partial<DeploymentConfig>
): DeploymentConfig {
  // Check for environment variable overrides
  const feeRecipient = process.env[`${networkConfig.name.toUpperCase().replace("-", "_")}_FEE_RECIPIENT`] 
    || networkConfig.deployment.feeRecipient;
  
  return {
    tokenX: networkConfig.contracts.tokenX,
    tokenY: networkConfig.contracts.tokenY,
    binStep: networkConfig.deployment.binStep,
    amountXMin: BigInt(networkConfig.deployment.amountXMin),
    amountYMin: BigInt(networkConfig.deployment.amountYMin),
    name: networkConfig.deployment.vaultName,
    symbol: networkConfig.deployment.vaultSymbol,
    lbRouter: networkConfig.contracts.lbRouter,
    lbpAMM: networkConfig.contracts.lbpAMM,
    lbpContract: networkConfig.contracts.lbpContract,
    rewarder: networkConfig.contracts.rewarder,
    rewardToken: networkConfig.contracts.rewardToken,
    nativeToken: networkConfig.contracts.nativeToken,
    lbpContractUSD: networkConfig.contracts.lbpContractUSD,
    idSlippage: BigInt(networkConfig.deployment.idSlippage),
    feeRecipient: feeRecipient,
    ...overrides
  };
}

export function validateDeploymentConfig(config: DeploymentConfig, network: string): void {
  // Check for placeholder values
  const placeholders = ["TODO", "DEPLOY_MOCK"];
  
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && placeholders.some(p => value.includes(p))) {
      if (network !== "localhost" && network !== "hardhat") {
        throw new Error(`Configuration value for ${key} contains placeholder: ${value}`);
      }
    }
  }
  
  // Validate addresses (basic check)
  const addressFields = [
    "tokenX", "tokenY", "lbRouter", "lbpAMM", "lbpContract", 
    "rewarder", "rewardToken", "nativeToken", "lbpContractUSD", "feeRecipient"
  ];
  
  for (const field of addressFields) {
    const value = config[field as keyof DeploymentConfig] as string;
    if (network !== "localhost" && network !== "hardhat" && value !== "DEPLOY_MOCK") {
      if (!value.startsWith("0x") || value.length !== 42) {
        throw new Error(`Invalid address for ${field}: ${value}`);
      }
    }
  }
}