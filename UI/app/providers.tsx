'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  darkTheme,
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

const arcaRainbowTheme = darkTheme({
  accentColor: '#00e686',
  accentColorForeground: '#08110d',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'small',
});

arcaRainbowTheme.colors.modalBackground = 'rgba(16, 21, 28, 0.94)';
arcaRainbowTheme.colors.modalBorder = 'rgba(255, 255, 255, 0.08)';
arcaRainbowTheme.colors.modalText = '#edf2f7';
arcaRainbowTheme.colors.modalTextDim = '#93a0b2';
arcaRainbowTheme.colors.modalTextSecondary = '#b7c1ce';
arcaRainbowTheme.colors.generalBorder = 'rgba(255, 255, 255, 0.08)';
arcaRainbowTheme.colors.generalBorderDim = 'rgba(255, 255, 255, 0.04)';
arcaRainbowTheme.colors.menuItemBackground = 'rgba(255, 255, 255, 0.035)';
arcaRainbowTheme.colors.profileForeground = 'rgba(255, 255, 255, 0.035)';
arcaRainbowTheme.colors.actionButtonSecondaryBackground = 'rgba(255, 255, 255, 0.04)';
arcaRainbowTheme.colors.connectButtonBackground = '#0f161f';
arcaRainbowTheme.colors.connectButtonInnerBackground = '#151d28';
arcaRainbowTheme.colors.connectButtonText = '#edf2f7';
arcaRainbowTheme.colors.closeButtonBackground = 'rgba(255, 255, 255, 0.05)';
arcaRainbowTheme.colors.closeButton = '#9aa6b2';
arcaRainbowTheme.colors.selectedOptionBorder = 'rgba(0, 230, 134, 0.42)';
arcaRainbowTheme.colors.standby = '#f7b84b';
arcaRainbowTheme.shadows.dialog =
  '0 28px 90px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 36px rgba(0, 230, 134, 0.08)';
arcaRainbowTheme.shadows.selectedWallet =
  '0 0 0 1px rgba(0, 230, 134, 0.18), 0 14px 34px rgba(0, 230, 134, 0.08)';
arcaRainbowTheme.shadows.selectedOption =
  '0 0 0 1px rgba(0, 230, 134, 0.18), 0 8px 24px rgba(0, 230, 134, 0.06)';
arcaRainbowTheme.shadows.walletLogo = '0 6px 20px rgba(0, 0, 0, 0.28)';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={sonic} theme={arcaRainbowTheme}>
          <PriceProvider>
            {children}
          </PriceProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
