/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";

async function exportAddresses() {
  console.log("\n📤 Exporting deployment addresses for frontend integration...\n");
  
  const networks = ["localhost", "sonic-testnet", "sonic-fork", "sonic-mainnet"];
  const allAddresses: Record<string, {
    vault: string;
    registry: string;
    feeManager: string;
    queueHandler: string;
    rewardClaimer: string;
    deploymentTime: string;
    config: {
      name: string;
      symbol: string;
      tokenX: string;
      tokenY: string;
    };
  }> = {};
  
  for (const network of networks) {
    const deploymentPath = path.join(__dirname, "../deployments", network, "latest.json");
    
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      
      if (!deployment.contracts) {
        console.log(`❌ Missing contracts in ${network} deployment`);
        continue;
      }
      
      if (!deployment.config) {
        console.log(`❌ Missing config in ${network} deployment`);
        continue;
      }
      
      allAddresses[network] = {
        vault: deployment.contracts.vault,
        registry: deployment.contracts.registry,
        feeManager: deployment.contracts.feeManager,
        queueHandler: deployment.contracts.queueHandler,
        rewardClaimer: deployment.contracts.rewardClaimer,
        deploymentTime: deployment.timestamp,
        config: {
          name: deployment.config.name,
          symbol: deployment.config.symbol,
          tokenX: deployment.config.tokenX,
          tokenY: deployment.config.tokenY
        }
      };
      
      console.log(`✅ Found deployment for ${network}`);
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
  
  // TypeScript format
  const tsContent = `// Auto-generated deployment addresses
// Generated at: ${new Date().toISOString()}

export const deployments = ${JSON.stringify(allAddresses, null, 2)} as const;

export type DeploymentNetwork = keyof typeof deployments;
`;
  
  const tsPath = path.join(exportDir, "deployments.ts");
  fs.writeFileSync(tsPath, tsContent);
  console.log(`📁 TypeScript addresses exported to: ${tsPath}`);
  
  // Environment variable format (for current network only)
  const currentNetwork = process.env.HARDHAT_NETWORK || "localhost";
  if (allAddresses[currentNetwork]) {
    const envContent = `# Deployment addresses for ${currentNetwork}
VITE_VAULT_ADDRESS=${allAddresses[currentNetwork].vault}
VITE_REGISTRY_ADDRESS=${allAddresses[currentNetwork].registry}
VITE_FEE_MANAGER_ADDRESS=${allAddresses[currentNetwork].feeManager}
VITE_QUEUE_HANDLER_ADDRESS=${allAddresses[currentNetwork].queueHandler}
VITE_REWARD_CLAIMER_ADDRESS=${allAddresses[currentNetwork].rewardClaimer}
VITE_TOKEN_X_ADDRESS=${allAddresses[currentNetwork].config.tokenX}
VITE_TOKEN_Y_ADDRESS=${allAddresses[currentNetwork].config.tokenY}
`;
    
    const envPath = path.join(exportDir, `.env.${currentNetwork}`);
    fs.writeFileSync(envPath, envContent);
    console.log(`📁 Environment variables exported to: ${envPath}`);
  }
  
  console.log("\n✅ Address export complete!");
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