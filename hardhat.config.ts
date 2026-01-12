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

const SEI_MAINNET_CHAIN_ID = 1329;
const SEI_TESTNET_CHAIN_ID = 1328;

dotenv.config();

// Override the compilation subtask to include multiple source directories
subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, { config }, runSuper) => {
  // Get the default source paths (from the 'contracts' directory)
  const paths: string[] = await runSuper();

  // Add Metropolis contracts directory
  const metropolisGlob = path.join(config.paths.root, "contracts-metropolis", "src", "**", "*.sol");
  const metropolisPaths = glob.sync(metropolisGlob);

  // Add dragonswap contracts directory (only our files)
  const dragonswapStrategyPath = path.join(config.paths.root, "contracts-dragonswap", "src", "*.sol");
  const dragonswapInterfacesGlob = path.join(config.paths.root, "contracts-dragonswap", "src", "interfaces", "*.sol");
  const dragonswapPaths = [...glob.sync(dragonswapStrategyPath), ...glob.sync(dragonswapInterfacesGlob)];

  // Add test mock contracts
  const testMocksGlob = path.join(config.paths.root, "test", "mocks", "*.sol");
  const testMocksPaths = glob.sync(testMocksGlob);
  
  // Combine all paths
  return [...paths, ...metropolisPaths, ...dragonswapPaths, ...testMocksPaths];
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
            runs: 200,
          },
        }
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 800,
          }, 
          metadata: {
            // do not include the metadata hash, since this is machine dependent
            // and we want all generated code to be deterministic
            // https://docs.soliditylang.org/en/v0.7.6/metadata.html
            bytecodeHash: 'none',
          },
        }
      },
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
      allowUnlimitedContractSize: false,
      // Use default hardhat accounts for localhost
      accounts: "remote",
    },
    "sei-mainnet": {
      allowUnlimitedContractSize: false,
      url: process.env.SEI_MAINNET_RPC_URL ? process.env.SEI_MAINNET_RPC_URL : "https://evm-rpc.sei-apis.com",
      chainId: SEI_MAINNET_CHAIN_ID,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000,
    },
    "sei-testnet": {
      allowUnlimitedContractSize: false,
      loggingEnabled: true,
      url: process.env.SEI_TESTNET_RPC_URL 
        ? process.env.SEI_TESTNET_RPC_URL
        : "https://evm-rpc-testnet.sei-apis.com",
      chainId: SEI_TESTNET_CHAIN_ID,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000,
    },
  },
  etherscan: {
    // V2 API requires single apiKey (not network-specific)
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "sei-mainnet",
        chainId: SEI_MAINNET_CHAIN_ID,
        urls: {
          apiURL: "https://seiscan.app/api",
          browserURL: "https://seiscan.app",
        },
      },
      {
        network: "sei-testnet",
        chainId: SEI_TESTNET_CHAIN_ID,
        urls: {
          apiURL: "https://seitrace.com/atlantic-2/api",
          browserURL: "https://seitrace.com",
        },
      },
    ],
  },
};

export default config;
