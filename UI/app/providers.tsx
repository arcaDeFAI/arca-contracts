'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PriceProvider } from '@/contexts/PriceContext';

// Define the Sonic blockchain network
const sonic = {
  id: 146,
  name: 'Sonic',
  nativeCurrency: { decimals: 18, name: 'S', symbol: 'S' },
  rpcUrls: { default: { http: ['https://rpc.soniclabs.com'] } },
  blockExplorers: { default: { name: 'Sonic Explorer', url: 'https://sonicscan.org' } },
  // Lets viem/wagmi fold many contract reads into one eth_call (verified deployed on Sonic)
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated: 60 } },
  iconUrl: '/SonicLogoRound.png',
  iconBackground: '#0066FF',
  testnet: false,
} as const;

// Configure Wagmi with RainbowKit
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '';

const config = getDefaultConfig({
  appName: 'arca Finance',
  projectId: projectId || 'arca-defi', // Fallback project ID
  chains: [sonic], // Only Sonic chain supported
  ssr: false,
  // The public RPC rate-limits bursts: the dashboard alone makes 60+ reads per load. Multicall
  // folds individual reads into a few eth_calls, and JSON-RPC batching sends those together.
  batch: { multicall: { wait: 16 } },
  transports: {
    [sonic.id]: http('https://rpc.soniclabs.com', { batch: { batchSize: 20, wait: 16 } }),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000), // fail fast instead of hanging ~15s
      refetchOnWindowFocus: false, // a tab switch shouldn't re-run every query at once
      refetchOnReconnect: true,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchInterval: 60_000, // live balances/rewards; heavy subgraph queries set their own longer staleTime
      networkMode: 'online',
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
