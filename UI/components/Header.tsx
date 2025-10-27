'use client';

import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ArcaLogo } from './ArcaLogo';
import { usePrices } from '@/contexts/PriceContext';
import { formatUSD } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();
  const { prices, isLoading } = usePrices();
  
  return (
    <header className="bg-arca-dark border-b border-arca-light-gray">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8" style={{maxWidth: '100%'}}>
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <ArcaLogo size={40} />
              <div className="text-3xl font-bold text-arca-green">ARCA</div>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <a 
                href="/" 
                className={`text-lg italic transition-colors ${
                  pathname === '/' 
                    ? 'text-arca-green font-bold border border-arca-green rounded-full px-4 py-1' 
                    : 'text-white hover:text-arca-green'
                }`}
              >
                Vaults
              </a>
              <a 
                href="/dashboard" 
                className={`text-lg italic transition-colors ${
                  pathname.startsWith('/dashboard') 
                    ? 'text-arca-green font-bold border border-arca-green rounded-full px-4 py-1' 
                    : 'text-white hover:text-arca-green'
                }`}
              >
                Dashboard
              </a>
              <a 
                href="/staking" 
                className={`text-lg italic transition-colors ${
                  pathname.startsWith('/staking') 
                    ? 'text-arca-green font-bold border border-arca-green rounded-full px-4 py-1' 
                    : 'text-white hover:text-arca-green'
                }`}
              >
                Staking
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {/* Sonic Price */}
            {!isLoading && prices && (
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-arca-green/10 rounded-lg border border-arca-green/20">
                <span className="text-base text-gray-300">S :</span>
                <span className="text-xl font-bold text-arca-green">${prices.sonic.toFixed(4)}</span>
              </div>
            )}
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                const ready = mounted;
                const connected = ready && account && chain;

                return (
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      'style': {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            type="button"
                            className="bg-arca-green text-black font-semibold py-2 px-4 rounded-lg hover:bg-arca-green/90 transition-colors flex items-center gap-2"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17 7H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H7V9h10v8zm-1-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                              <path d="M20 5H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1z"/>
                            </svg>
                            Connect Wallet
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={openChainModal}
                            type="button"
                            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Wrong network
                          </button>
                        );
                      }

                      return (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={openChainModal}
                            className="bg-arca-light-gray text-white font-semibold py-2 px-3 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                            type="button"
                          >
                            {chain.hasIcon && (
                              <div
                                style={{
                                  background: chain.iconBackground,
                                  width: 16,
                                  height: 16,
                                  borderRadius: 999,
                                  overflow: 'hidden',
                                }}
                              >
                                {chain.iconUrl && (
                                  <img
                                    alt={chain.name ?? 'Chain icon'}
                                    src={chain.iconUrl}
                                    style={{ width: 16, height: 16 }}
                                  />
                                )}
                              </div>
                            )}
                            {chain.name}
                          </button>

                          <button
                            onClick={openAccountModal}
                            type="button"
                            className="bg-arca-green text-black font-semibold py-2 px-4 rounded-lg hover:bg-arca-green/90 transition-colors flex items-center gap-2"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17 7H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H7V9h10v8zm-1-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                              <path d="M20 5H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1z"/>
                            </svg>
                            {account.displayName}
                            {account.displayBalance
                              ? ` (${account.displayBalance})`
                              : ''}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </div>
    </header>
  );
}
