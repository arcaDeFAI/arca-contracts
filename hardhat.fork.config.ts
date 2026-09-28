import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import "hardhat-interface-generator";
// temp: forge absent
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
  const pj = (...parts: string[]) => parts.join("/").split("\\").join("/");
  
  // Add Metropolis contracts directory
  const metropolisGlob = pj(config.paths.root, "contracts-metropolis", "src", "**", "*.sol");
  const metropolisPaths = glob.sync(metropolisGlob);
  
  // Add Shadow contracts directory (only our files)
  const shadowStrategyPath = pj(config.paths.root, "contracts-shadow", "src", "*.sol");
  const shadowInterfacesGlob = pj(config.paths.root, "contracts-shadow", "src", "interfaces", "*.sol");
  const shadowPaths = [...glob.sync(shadowStrategyPath), ...glob.sync(shadowInterfacesGlob)];
  
  // Add test mock contracts
  const testMocksGlob = pj(config.paths.root, "test", "mocks", "*.sol");
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
      // Sonic enforces the EIP-7825 per-transaction gas cap of 2**24 since Brio.
      // Keep the local block limit under it so the fork rejects the same
      // transactions mainnet would, instead of letting ethers default to 60M.
      blockGasLimit: 16_000_000,
      // Fork configured here rather than via --fork: the CLI flag bypasses the
      // chains block below, and Sonic (146) is unknown to hardhat, so without an
      // explicit hardfork history every historical call fails.
      forking: {
        url: process.env.SONIC_MAINNET_RPC_URL || "https://rpc.soniclabs.com",
        // Pinned so hardhat caches remote state on disk. Without a pin every run
        // refetches cold state and the public RPC times out mid-migration.
        blockNumber: 80040000,
      },
      chains: {
        146: {
          hardforkHistory: {
            cancun: 0,
          },
        },
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 600000,
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
    // V2 API requires single apiKey (not network-specific)
    apiKey: process.env.SONIC_SCAN_API_KEY || "placeholder",
    customChains: [
      {
        network: "sonic-mainnet",
        chainId: 146,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sonicscan.org"
        }
      },
      {
        network: "sonic-testnet",
        chainId: 57054,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://testnet.sonicscan.org"
        },
      },
    ],
  },
};

export default config;
