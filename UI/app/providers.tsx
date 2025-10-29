'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PriceProvider } from '@/contexts/PriceContext';

// Define the Sonic blockchain network
const sonic = {
  id: 146,
  name: 'Sonic',
  nativeCurrency: { decimals: 18, name: 'S', symbol: 'S' },
  rpcUrls: { default: { http: ['https://rpc.soniclabs.com'] } },
  blockExplorers: { default: { name: 'Sonic Explorer', url: 'https://sonicscan.org' } },
  iconUrl: '/SonicLogoRound.png',
  iconBackground: '#0066FF',
  testnet: false,
} as const;

// Configure Wagmi with RainbowKit
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '';

const config = getDefaultConfig({
  appName: 'Arca DeFi',
  projectId: projectId || 'arca-defi', // Fallback project ID
  chains: [sonic], // Only Sonic chain supported
  ssr: false,
});

// Configure QueryClient with better error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={sonic}>
          <PriceProvider>
            {children}
          </PriceProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
