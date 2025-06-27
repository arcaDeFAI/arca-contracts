import { http, createConfig } from "wagmi";
import { mainnet, polygon, arbitrum } from "wagmi/chains";
import { injected, metaMask, safe, walletConnect } from "wagmi/connectors";

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

// Define local fork for testing
const sonicFork = {
  id: 31337,
  name: "Sonic Fork",
  network: "sonic-fork",
  nativeCurrency: {
    decimals: 18,
    name: "Sonic",
    symbol: "S",
  },
  rpcUrls: {
    public: { http: ["http://127.0.0.1:8545"] },
    default: { http: ["http://127.0.0.1:8545"] },
  },
  blockExplorers: {
    default: { name: "Local Fork", url: "http://localhost:8545" },
  },
  testnet: true,
} as const;

const projectId =
  import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID ||
  "79b51eb4327450f59778f2454e0d5ab1";

export const config = createConfig({
  chains: [mainnet, polygon, arbitrum, sonic, sonicFork],
  connectors: [injected(), metaMask(), safe(), walletConnect({ projectId })],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [sonic.id]: http(),
    [sonicFork.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
