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

const projectId: string =
  import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "your-project-id";

// Configure chains and providers
export const rainbowkitConfig1: Config = getDefaultConfig({
  appName: "Arca",
  projectId: projectId, // Get this from WalletConnect Cloud
  chains: [mainnet, polygon, arbitrum, sonic, sonicTestnet],
  ssr: false, // Set to true if using Next.js SSR
});
