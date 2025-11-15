// Multi-Vault Network Configuration Types

export interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  deployMock?: boolean;
}

export interface LBPairConfig {
  address: string;
  deployMock?: boolean;
  binStep: number;
  activeId: number;
}

export interface VaultDeploymentConfig {
  vaultName: string;
  vaultSymbol: string;
  amountXMin: string;
  amountYMin: string;
  idSlippage: string;
  feeRecipient: string;
}

export interface VaultConfig {
  id: string;
  enabled: boolean;
  tokens: {
    tokenX: TokenConfig;
    tokenY: TokenConfig;
  };
  lbPair: LBPairConfig;
  deployment: VaultDeploymentConfig;
}

export interface SharedContracts {
  metroToken: string;
  lbRouter: string;
  lbFactory: string;
}

export interface TestAccountConfig {
  fundingAmount: string;
  count?: number;
}

export interface GasSettings {
  gasPrice: string | number;
  gasLimit?: number;
}

export interface SecuritySettings {
  requireMultisig?: boolean;
  timelockDelay?: number;
  upgradeDelay?: number;
}

export interface TestnetInfo {
  faucetUrl?: string;
  explorerUrl?: string;
  documentation?: {
    networkName?: string;
    currencySymbol?: string;
    rpcUrl?: string;
    alchemyRpcUrl?: string;
  };
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl?: string;
  blockExplorer?: string;
  sharedContracts: SharedContracts;
  testAccounts?: TestAccountConfig;
  vaults: VaultConfig[];
  gasSettings?: GasSettings;
  security?: SecuritySettings;
  testnet?: TestnetInfo;
}

// Validation functions
export function validateTokenConfig(token: TokenConfig): void {
  if (!token.symbol || !token.name) {
    throw new Error(`Invalid token config: missing symbol or name`);
  }
  if (token.decimals < 0 || token.decimals > 18) {
    throw new Error(`Invalid token decimals: ${token.decimals}`);
  }
  if (token.address !== 'DEPLOY_MOCK' && !token.address.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error(`Invalid token address: ${token.address}`);
  }
}

export function validateVaultConfig(vault: VaultConfig): void {
  if (!vault.id.match(/^[a-z0-9-]+$/)) {
    throw new Error(`Invalid vault ID: ${vault.id}. Must be lowercase alphanumeric with hyphens only.`);
  }
  
  validateTokenConfig(vault.tokens.tokenX);
  validateTokenConfig(vault.tokens.tokenY);
  
  if (vault.lbPair.binStep < 1) {
    throw new Error(`Invalid bin step for vault ${vault.id}: ${vault.lbPair.binStep}`);
  }
  
  if (!vault.deployment.feeRecipient.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error(`Invalid fee recipient for vault ${vault.id}: ${vault.deployment.feeRecipient}`);
  }
}

export function validateNetworkConfig(config: NetworkConfig): void {
  if (!config.name || !config.chainId) {
    throw new Error('Invalid network config: missing name or chainId');
  }
  
  if (!config.sharedContracts || !config.sharedContracts.metroToken || 
      !config.sharedContracts.lbRouter || !config.sharedContracts.lbFactory) {
    throw new Error('Invalid network config: missing shared contracts');
  }
  
  if (!config.vaults || config.vaults.length === 0) {
    throw new Error('Invalid network config: no vaults defined');
  }
  
  const vaultIds = new Set<string>();
  for (const vault of config.vaults) {
    if (vaultIds.has(vault.id)) {
      throw new Error(`Duplicate vault ID: ${vault.id}`);
    }
    vaultIds.add(vault.id);
    
    if (vault.enabled) {
      validateVaultConfig(vault);
    }
  }
}

// Helper functions
export function getEnabledVaults(config: NetworkConfig): VaultConfig[] {
  return config.vaults.filter(vault => vault.enabled);
}

export function findVaultById(config: NetworkConfig, vaultId: string): VaultConfig | undefined {
  return config.vaults.find(vault => vault.id === vaultId);
}

export function getTokenSymbolPair(vault: VaultConfig): string {
  return `${vault.tokens.tokenX.symbol}-${vault.tokens.tokenY.symbol}`;
}

export function shouldDeployToken(address: string): boolean {
  return address === 'DEPLOY_MOCK';
}

export function getUniqueTokensToDeploy(vaults: VaultConfig[]): Map<string, TokenConfig> {
  const tokens = new Map<string, TokenConfig>();
  
  for (const vault of vaults) {
    if (vault.enabled) {
      // Check tokenX
      if (vault.tokens.tokenX.deployMock && shouldDeployToken(vault.tokens.tokenX.address)) {
        const key = vault.tokens.tokenX.symbol;
        if (!tokens.has(key)) {
          tokens.set(key, vault.tokens.tokenX);
        }
      }
      
      // Check tokenY
      if (vault.tokens.tokenY.deployMock && shouldDeployToken(vault.tokens.tokenY.address)) {
        const key = vault.tokens.tokenY.symbol;
        if (!tokens.has(key)) {
          tokens.set(key, vault.tokens.tokenY);
        }
      }
    }
  }
  
  return tokens;
}