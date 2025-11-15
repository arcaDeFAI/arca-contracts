import * as fs from "fs";
import * as path from "path";
import type { NetworkConfig} from "../types/config";
import { validateNetworkConfig as validateConfig } from "../types/config";

/**
 * Load network configuration for multi-vault deployment
 */
export function loadNetworkConfig(network: string): NetworkConfig {
  const configPath = path.join(__dirname, "../../config/networks", `${network}.json`);
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`Network configuration not found for ${network} at ${configPath}`);
  }
  
  try {
    const configData = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configData) as NetworkConfig;
    
    // Basic validation
    if (!config.name || config.name !== network) {
      throw new Error(`Network name mismatch: expected ${network}, got ${config.name}`);
    }
    
    if (!config.chainId) {
      throw new Error(`Missing chainId in configuration`);
    }
    
    if (!config.sharedContracts) {
      throw new Error(`Missing sharedContracts in configuration`);
    }
    
    if (!config.vaults || !Array.isArray(config.vaults)) {
      throw new Error(`Missing or invalid vaults array in configuration`);
    }
    
    return config;
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in network configuration: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate network configuration for deployment
 */
export function validateNetworkConfig(config: NetworkConfig): void {
  try {
    // Use the validation from types/config.ts
    validateConfig(config);
    
    // Additional deployment-specific validation
    const network = config.name;
    
    // Check for placeholder values in non-local networks
    if (network !== "localhost" && network !== "hardhat") {
      // Check shared contracts
      if (config.sharedContracts.metroToken === "DEPLOY_MOCK" ||
          config.sharedContracts.lbRouter === "DEPLOY_MOCK" ||
          config.sharedContracts.lbFactory === "DEPLOY_MOCK") {
        throw new Error(`DEPLOY_MOCK placeholders not allowed on ${network}`);
      }
      
      // Check vault configurations
      for (const vault of config.vaults) {
        if (!vault.enabled) continue;
        
        if (vault.tokens.tokenX.address === "DEPLOY_MOCK" && !vault.tokens.tokenX.deployMock) {
          throw new Error(`Vault ${vault.id}: tokenX has DEPLOY_MOCK but deployMock is false`);
        }
        
        if (vault.tokens.tokenY.address === "DEPLOY_MOCK" && !vault.tokens.tokenY.deployMock) {
          throw new Error(`Vault ${vault.id}: tokenY has DEPLOY_MOCK but deployMock is false`);
        }
        
        if (vault.lbPair.address === "DEPLOY_MOCK" && !vault.lbPair.deployMock) {
          throw new Error(`Vault ${vault.id}: lbPair has DEPLOY_MOCK but deployMock is false`);
        }
      }
    }
    
    // Warn about disabled vaults
    const disabledVaults = config.vaults.filter(v => !v.enabled);
    if (disabledVaults.length > 0) {
      console.log(`⚠️  ${disabledVaults.length} vault(s) are disabled: ${disabledVaults.map(v => v.id).join(", ")}`);
    }
    
    // Check for duplicate vault IDs
    const vaultIds = new Set<string>();
    for (const vault of config.vaults) {
      if (vaultIds.has(vault.id)) {
        throw new Error(`Duplicate vault ID: ${vault.id}`);
      }
      vaultIds.add(vault.id);
    }
    
  } catch (error) {
    throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get environment variable overrides for fee recipients
 */
export function getFeeRecipientOverrides(network: string): Map<string, string> {
  const overrides = new Map<string, string>();
  
  // Look for environment variables like LOCALHOST_VAULT_WS_USDC_FEE_RECIPIENT
  const prefix = `${network.toUpperCase().replace("-", "_")}_VAULT_`;
  
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && key.endsWith("_FEE_RECIPIENT") && value) {
      // Extract vault ID from key
      const vaultId = key
        .replace(prefix, "")
        .replace("_FEE_RECIPIENT", "")
        .toLowerCase()
        .replace(/_/g, "-");
      
      overrides.set(vaultId, value);
    }
  }
  
  return overrides;
}

/**
 * Apply fee recipient overrides to configuration
 */
export function applyFeeRecipientOverrides(config: NetworkConfig): NetworkConfig {
  const overrides = getFeeRecipientOverrides(config.name);
  
  if (overrides.size === 0) {
    return config;
  }
  
  console.log(`\n💰 Applying fee recipient overrides from environment variables:`);
  
  // Deep clone the config to avoid mutations
  const updatedConfig = JSON.parse(JSON.stringify(config)) as NetworkConfig;
  
  for (const vault of updatedConfig.vaults) {
    const override = overrides.get(vault.id);
    if (override) {
      console.log(`  - ${vault.id}: ${override}`);
      vault.deployment.feeRecipient = override;
    }
  }
  
  return updatedConfig;
}