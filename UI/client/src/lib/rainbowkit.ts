import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, arbitrum } from 'wagmi/chains';

// Define Sonic chain
const sonic = {
  id: 146,
  name: 'Sonic',
  network: 'sonic',
  nativeCurrency: {
    decimals: 18,
    name: 'Sonic',
    symbol: 'S',
  },
  rpcUrls: {
    public: { http: ['https://rpc.soniclabs.com'] },
    default: { http: ['https://rpc.soniclabs.com'] },
  },
  blockExplorers: {
    default: { name: 'Sonicscan', url: 'https://sonicscan.org' },
  },
  testnet: false,
} as const;

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'your-project-id';

export const rainbowkitConfig = getDefaultConfig({
  appName: 'Arca',
  projectId,
  chains: [mainnet, polygon, arbitrum, sonic],
  ssr: false,
});
