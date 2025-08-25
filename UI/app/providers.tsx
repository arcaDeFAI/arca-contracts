'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Define the Sonic blockchain network
const sonic = {
  id: 146,
  name: 'Sonic',
  nativeCurrency: { decimals: 18, name: 'S', symbol: 'S' },
  rpcUrls: { default: { http: ['https://rpc.soniclabs.com'] } },
  blockExplorers: { default: { name: 'Sonic Explorer', url: 'https://sonicscan.org' } },
  testnet: false,
} as const;

// Configure Wagmi with RainbowKit
const config = getDefaultConfig({
  appName: 'Arca DeFi',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'demo-project-id',
  chains: [sonic], // Only Sonic chain supported
  ssr: false,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={sonic}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
