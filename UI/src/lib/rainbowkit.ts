import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, arbitrum } from "wagmi/chains";
import { defineChain } from "viem";
import type { Config } from "wagmi";

// Define Sonic chains
const sonic = defineChain({
  id: 146,
  name: "Sonic",
  nativeCurrency: {
    decimals: 18,
    name: "Sonic",
    symbol: "S",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.soniclabs.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Sonic Explorer",
      url: "https://explorer.soniclabs.com",
    },
  },
  iconUrl:
    "https://res.cloudinary.com/dpnvhlvim/image/upload/sonic_logo_Black_xjdjoi.png",
  testnet: false,
});

const sonicTestnet = defineChain({
  id: 57054,
  name: "Sonic Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Sonic",
    symbol: "S",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.blaze.soniclabs.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Sonic Testnet Explorer",
      url: "https://testnet.sonicscan.org",
    },
  },
  iconUrl:
    "https://res.cloudinary.com/dpnvhlvim/image/upload/sonic_logo_Black_xjdjoi.png",
  testnet: true,
  faucets: ["https://testnet.soniclabs.com/account"],
});

// Define development chains (from wagmi.ts)
const localhost = defineChain({
  id: 31337,
  name: "Localhost",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
  blockExplorers: {
    default: {
      name: "Local",
      url: "http://localhost:8545",
    },
  },
  testnet: true,
});

const sonicFork = defineChain({
  id: 31338,
  name: "Sonic Fork",
  nativeCurrency: {
    decimals: 18,
    name: "Sonic",
    symbol: "S",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8546"],
    },
  },
  blockExplorers: {
    default: {
      name: "Local Fork",
      url: "http://localhost:8546",
    },
  },
  testnet: true,
});

const projectId: string =
  import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "your-project-id";

// Configure chains and providers
export const rainbowkitConfig1: Config = getDefaultConfig({
  appName: "Arca",
  projectId: projectId,
  chains: [
    mainnet,
    polygon,
    arbitrum,
    sonic,
    sonicTestnet,
    localhost,
    sonicFork,
  ],
  ssr: false,
});
