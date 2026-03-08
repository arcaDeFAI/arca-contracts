import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { BackgroundPattern } from '@/components/BackgroundPattern'


// Optimized font loading - prevents FOIT (Flash of Invisible Text)
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
})

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
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <BackgroundPattern />
        <Providers>
          
            {children}
          
        </Providers>
      </body>
    </html>
  )
}
