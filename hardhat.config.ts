import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import "hardhat-interface-generator";
import "@nomicfoundation/hardhat-foundry";
import * as dotenv from "dotenv";
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";
import { subtask } from "hardhat/config";
import * as glob from "glob";
import * as path from "path";

dotenv.config();

// Override the compilation subtask to include multiple source directories
subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, { config }, runSuper) => {
  // Get the default source paths (from the 'contracts' directory)
  const paths: string[] = await runSuper();
  
  // Add Metropolis contracts directory
  const metropolisGlob = path.join(config.paths.root, "contracts-metropolis", "src", "**", "*.sol");
  const metropolisPaths = glob.sync(metropolisGlob);
  
  // Add Shadow contracts directory (only our files)
  const shadowStrategyPath = path.join(config.paths.root, "contracts-shadow", "src", "*.sol");
  const shadowInterfacesGlob = path.join(config.paths.root, "contracts-shadow", "src", "interfaces", "*.sol");
  const shadowPaths = [...glob.sync(shadowStrategyPath), ...glob.sync(shadowInterfacesGlob)];
  
  // Add test mock contracts
  const testMocksGlob = path.join(config.paths.root, "test", "mocks", "*.sol");
  const testMocksPaths = glob.sync(testMocksGlob);
  
  // Combine all paths
  return [...paths, ...metropolisPaths, ...shadowPaths, ...testMocksPaths];
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            details: {
              yulDetails: {
                optimizerSteps: "u",
              },
            },
          },
        }
      },
      {
        version: "0.8.26",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      // Use default hardhat accounts for localhost
      accounts: "remote",
    },
    "sonic-mainnet": {
      url: process.env.SONIC_MAINNET_RPC_URL || "https://rpc.soniclabs.com",
      chainId: 146,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000,
    },
    "sonic-fork": {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      forking: {
        url: process.env.SONIC_MAINNET_RPC_URL || "https://rpc.soniclabs.com",
        // Use a specific recent block instead of latest to avoid hardfork issues
        blockNumber: 36000000,
      },
      accounts: "remote",
      timeout: 120000,
      // Override hardfork to handle Sonic's custom chain
      hardfork: "cancun",
    },
    "sonic-mainnet-alchemy": {
      url: process.env.ALCHEMY_API_KEY 
        ? `https://sonic-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "https://rpc.soniclabs.com",
      chainId: 146,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000,
    },
    "sonic-testnet": {
      url: process.env.SONIC_TESTNET_RPC_URL 
        ? process.env.SONIC_TESTNET_RPC_URL
        : "https://rpc.blaze.soniclabs.com",
      chainId: 57054,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000,
    },
  },
  etherscan: {
    // Sonic requires network-specific API keys
    apiKey: {
      "sonic-mainnet": process.env.SONIC_SCAN_API_KEY || "placeholder",
      "sonic-testnet": process.env.SONIC_TESTNET_SCAN_API_KEY || "placeholder",
    },
    customChains: [
      {
        network: "sonic-mainnet",
        chainId: 146,
        urls: {
          apiURL: "https://api.sonicscan.org/api",
          browserURL: "https://sonicscan.org",
        },
      },
      {
        network: "sonic-testnet",
        chainId: 57054,
        urls: {
          apiURL: "https://api-testnet.sonicscan.org/api",
          browserURL: "https://testnet.sonicscan.org",
        },
      },
    ],
  },
};

export default config;
