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

// Configure QueryClient - Optimized for reliable data fetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3, // Retry failed queries 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnMount: true, // Always refetch when component mounts
      refetchOnReconnect: true, // Refetch when network reconnects
      staleTime: 20000, // Data is fresh for 20 seconds
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      refetchInterval: 30000, // Auto-refetch every 30 seconds for live data
      networkMode: 'online', // Only fetch when online
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
