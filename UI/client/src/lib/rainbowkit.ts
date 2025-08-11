import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, arbitrum } from "wagmi/chains";
import { http } from "wagmi";

// Define Sonic chain
const sonic = {
  id: 146,
  name: "Sonic",
  network: "sonic",
  nativeCurrency: {
    decimals: 18,
    name: "Sonic",
    symbol: "S",
  },
  rpcUrls: {
    public: { http: ["https://rpc.soniclabs.com"] },
    default: { http: ["https://rpc.soniclabs.com"] },
  },
  blockExplorers: {
    default: { name: "Sonicscan", url: "https://sonicscan.org" },
  },
  testnet: false,
} as const;

// Define Sonic Blaze Testnet chain
const sonicTestnet = {
  id: 57054,
  name: "Sonic Blaze Testnet",
  network: "sonic-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Sonic",
    symbol: "S",
  },
  rpcUrls: {
    public: { http: ["https://rpc.blaze.soniclabs.com"] },
    default: { http: ["https://rpc.blaze.soniclabs.com"] },
  },
  blockExplorers: {
    default: {
      name: "Sonic Testnet Explorer",
      url: "https://testnet.sonicscan.org",
    },
  },
  testnet: true,
} as const;

const projectId =
  import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "your-project-id";

export const rainbowkitConfig = getDefaultConfig({
  appName: "Arca",
  projectId,
  chains: [mainnet, polygon, arbitrum, sonic] as const,
  ssr: false,
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [sonic.id]: http(),
  },
});
