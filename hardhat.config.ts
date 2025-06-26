import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import "hardhat-interface-generator";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
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
    "sonic-testnet": {
      url: process.env.SONIC_TESTNET_RPC_URL || "https://rpc.blaze.soniclabs.com",
      chainId: 57054,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      timeout: 120000, // 2 minutes timeout for Alchemy
    },
    "sonic-testnet-alchemy": {
      url: process.env.ALCHEMY_API_KEY 
        ? `https://sonic-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "https://rpc.blaze.soniclabs.com",
      chainId: 57054,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      timeout: 120000,
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
  },
  etherscan: {
    apiKey: {
      "sonic-testnet": process.env.SONIC_SCAN_API_KEY || "placeholder",
      "sonic-mainnet": process.env.SONIC_SCAN_API_KEY || "placeholder",
    },
    customChains: [
      {
        network: "sonic-testnet",
        chainId: 57054,
        urls: {
          apiURL: "https://api-testnet.sonicscan.org/api",
          browserURL: "https://testnet.sonicscan.org",
        },
      },
      {
        network: "sonic-mainnet",
        chainId: 146,
        urls: {
          apiURL: "https://api.sonicscan.org/api",
          browserURL: "https://sonicscan.org",
        },
      },
    ],
  },
};

export default config;
