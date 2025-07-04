import * as fs from "fs";
import * as path from "path";

interface VaultDeployment {
  id: string;
  vault: string;
  queueHandler: string;
  feeManager: string;
  rewardClaimer: string;
  tokenX: string;
  tokenY: string;
  lbPair: string;
  name: string;
  symbol: string;
}

interface NetworkDeployment {
  registry: string;
  sharedInfrastructure: {
    queueHandlerBeacon: string;
    feeManagerBeacon: string;
    metroToken: string;
    lbRouter: string;
    lbFactory?: string;
  };
  vaults: VaultDeployment[];
  deploymentTime: string;
  deployedTokens: Record<string, string>;
}

interface ExportedDeployments {
  [network: string]: NetworkDeployment;
}

async function exportAddresses() {
  console.log("\n📤 Exporting deployment addresses for frontend integration...\n");
  
  const networks = ["localhost", "sonic-testnet", "sonic-fork", "sonic-mainnet"];
  const allAddresses: ExportedDeployments = {};
  
  for (const network of networks) {
    const deploymentPath = path.join(__dirname, "../deployments", network, "latest-multi-vault.json");
    
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      
      if (!deployment.sharedInfrastructure || !deployment.vaults) {
        console.log(`❌ Invalid deployment for ${network}`);
        continue;
      }
      
      allAddresses[network] = {
        registry: deployment.sharedInfrastructure.registry,
        sharedInfrastructure: {
          queueHandlerBeacon: deployment.sharedInfrastructure.queueHandlerBeacon,
          feeManagerBeacon: deployment.sharedInfrastructure.feeManagerBeacon,
          metroToken: deployment.sharedInfrastructure.metroToken,
          lbRouter: deployment.sharedInfrastructure.lbRouter,
          lbFactory: deployment.sharedInfrastructure.lbFactory
        },
        vaults: deployment.vaults.map((v: any) => ({
          id: v.id,
          vault: v.contracts.vault,
          queueHandler: v.contracts.queueHandler,
          feeManager: v.contracts.feeManager,
          rewardClaimer: v.contracts.rewardClaimer,
          tokenX: v.tokens.tokenX,
          tokenY: v.tokens.tokenY,
          lbPair: v.contracts.lbPair,
          name: v.config.vaultName,
          symbol: v.config.vaultSymbol
        })),
        deploymentTime: deployment.timestamp,
        deployedTokens: deployment.deployedTokens || {}
      };
      
      console.log(`✅ Found deployment for ${network} with ${deployment.vaults.length} vault(s)`);
    } else {
      console.log(`⏭️  No deployment found for ${network}`);
    }
  }
  
  // Save to multiple formats for flexibility
  const exportDir = path.join(__dirname, "../exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  
  // JSON format
  const jsonPath = path.join(exportDir, "deployments.json");
  fs.writeFileSync(jsonPath, JSON.stringify(allAddresses, null, 2));
  console.log(`\n📁 JSON addresses exported to: ${jsonPath}`);
  
  // TypeScript format with helpful types and utilities
  const tsContent = `// Auto-generated deployment addresses
// Generated at: ${new Date().toISOString()}

export interface VaultInfo {
  id: string;
  vault: string;
  queueHandler: string;
  feeManager: string;
  rewardClaimer: string;
  tokenX: string;
  tokenY: string;
  lbPair: string;
  name: string;
  symbol: string;
}

export interface SharedInfrastructure {
  queueHandlerBeacon: string;
  feeManagerBeacon: string;
  metroToken: string;
  lbRouter: string;
  lbFactory?: string;
}

export interface NetworkDeployment {
  registry: string;
  sharedInfrastructure: SharedInfrastructure;
  vaults: VaultInfo[];
  deploymentTime: string;
  deployedTokens: Record<string, string>;
}

export const deployments: Record<string, NetworkDeployment> = ${JSON.stringify(allAddresses, null, 2)} as const;

export type DeploymentNetwork = keyof typeof deployments;

// Helper functions
export function getVaultById(network: DeploymentNetwork, vaultId: string): VaultInfo | undefined {
  return deployments[network]?.vaults.find(v => v.id === vaultId);
}

export function getAllVaults(network: DeploymentNetwork): VaultInfo[] {
  return deployments[network]?.vaults || [];
}

export function getRegistry(network: DeploymentNetwork): string | undefined {
  return deployments[network]?.registry;
}

export function getSharedInfrastructure(network: DeploymentNetwork): SharedInfrastructure | undefined {
  return deployments[network]?.sharedInfrastructure;
}

export function getTokenAddress(network: DeploymentNetwork, symbol: string): string | undefined {
  return deployments[network]?.deployedTokens[symbol];
}

export function getVaultsByTokenPair(network: DeploymentNetwork, tokenX: string, tokenY: string): VaultInfo[] {
  return getAllVaults(network).filter(v => 
    (v.tokenX.toLowerCase() === tokenX.toLowerCase() && v.tokenY.toLowerCase() === tokenY.toLowerCase()) ||
    (v.tokenX.toLowerCase() === tokenY.toLowerCase() && v.tokenY.toLowerCase() === tokenX.toLowerCase())
  );
}
`;
  
  const tsPath = path.join(exportDir, "deployments.ts");
  fs.writeFileSync(tsPath, tsContent);
  console.log(`📁 TypeScript addresses exported to: ${tsPath}`);
  
  // Environment variable format (for current network only)
  const currentNetwork = process.env.HARDHAT_NETWORK || "localhost";
  if (allAddresses[currentNetwork]) {
    const deployment = allAddresses[currentNetwork];
    let envContent = `# Deployment addresses for ${currentNetwork}\n`;
    envContent += `# Generated at: ${new Date().toISOString()}\n\n`;
    envContent += `# Registry\n`;
    envContent += `VITE_REGISTRY_ADDRESS=${deployment.registry}\n`;
    
    envContent += `\n# Shared Infrastructure\n`;
    envContent += `VITE_QUEUE_HANDLER_BEACON=${deployment.sharedInfrastructure.queueHandlerBeacon}\n`;
    envContent += `VITE_FEE_MANAGER_BEACON=${deployment.sharedInfrastructure.feeManagerBeacon}\n`;
    envContent += `VITE_METRO_TOKEN_ADDRESS=${deployment.sharedInfrastructure.metroToken}\n`;
    envContent += `VITE_LB_ROUTER_ADDRESS=${deployment.sharedInfrastructure.lbRouter}\n`;
    if (deployment.sharedInfrastructure.lbFactory) {
      envContent += `VITE_LB_FACTORY_ADDRESS=${deployment.sharedInfrastructure.lbFactory}\n`;
    }
    
    envContent += `\n# Deployed Tokens\n`;
    for (const [symbol, address] of Object.entries(deployment.deployedTokens)) {
      envContent += `VITE_TOKEN_${symbol.toUpperCase()}_ADDRESS=${address}\n`;
    }
    
    envContent += `\n# Vaults\n`;
    deployment.vaults.forEach((vault) => {
      const vaultKey = vault.id.toUpperCase().replace(/-/g, '_');
      envContent += `\n# ${vault.name} (${vault.id})\n`;
      envContent += `VITE_VAULT_${vaultKey}_ADDRESS=${vault.vault}\n`;
      envContent += `VITE_VAULT_${vaultKey}_QUEUE_HANDLER=${vault.queueHandler}\n`;
      envContent += `VITE_VAULT_${vaultKey}_FEE_MANAGER=${vault.feeManager}\n`;
      envContent += `VITE_VAULT_${vaultKey}_REWARD_CLAIMER=${vault.rewardClaimer}\n`;
      envContent += `VITE_VAULT_${vaultKey}_TOKEN_X=${vault.tokenX}\n`;
      envContent += `VITE_VAULT_${vaultKey}_TOKEN_Y=${vault.tokenY}\n`;
      envContent += `VITE_VAULT_${vaultKey}_LB_PAIR=${vault.lbPair}\n`;
    });
    
    const envPath = path.join(exportDir, `.env.${currentNetwork}`);
    fs.writeFileSync(envPath, envContent);
    console.log(`📁 Environment variables exported to: ${envPath}`);
  }
  
  console.log("\n✅ Address export complete!");
  console.log("\n📝 Summary:");
  for (const [network, deployment] of Object.entries(allAddresses)) {
    console.log(`  - ${network}: ${deployment.vaults.length} vault(s), ${Object.keys(deployment.deployedTokens).length} token(s)`);
  }
}

async function main() {
  try {
    await exportAddresses();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Export failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}