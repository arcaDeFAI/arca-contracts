import React, { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, hardhat } from 'wagmi/chains'
import { mock } from 'wagmi/connectors'
import { type Config } from 'wagmi'

// Create a mock wagmi config for testing
export const mockConfig = createConfig({
  chains: [mainnet, hardhat],
  transports: {
    [mainnet.id]: http(),
    [hardhat.id]: http(),
  },
  connectors: [
    mock({
      accounts: [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Default test account
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Second test account
      ],
    }),
  ],
})

// Create a new query client for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

interface TestProvidersProps {
  children: React.ReactNode
  wagmiConfig?: Config
}

export function TestProviders({ 
  children, 
  wagmiConfig = mockConfig 
}: TestProvidersProps) {
  const testQueryClient = createTestQueryClient()

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={testQueryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

// Utility function to render with providers
export function renderWithProviders(ui: ReactElement) {
  return {
    ...render(ui, {
      wrapper: ({ children }) => <TestProviders>{children}</TestProviders>,
    }),
  }
}

// Re-export everything
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'