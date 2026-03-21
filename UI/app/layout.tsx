import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'
import { BackgroundPattern } from '@/components/BackgroundPattern'

export const metadata: Metadata = {
  title: 'Arca DeFi - Vault Management',
  description: 'Deposit and earn yield on your crypto assets across our strategic vaults',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/arca-logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/arca-logo.png', sizes: '16x16', type: 'image/png' }
    ],
    shortcut: '/favicon.ico',
    apple: '/arca-logo.png',
  },
  openGraph: {
    title: 'Arca DeFi - Vault Management',
    description: 'Deposit and earn yield on your crypto assets across our strategic vaults',
    images: ['/arca-logo.png'],
    siteName: 'Arca DeFi',
  },
  twitter: {
    card: 'summary',
    title: 'Arca DeFi - Vault Management',
    description: 'Deposit and earn yield on your crypto assets across our strategic vaults',
    images: ['/arca-logo.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <BackgroundPattern />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
