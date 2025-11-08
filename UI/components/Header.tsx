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
      <div className="container mx-auto px-3 sm:px-6 lg:px-8" style={{maxWidth: '100%'}}>
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <ArcaLogo size={32} className="sm:w-10 sm:h-10" />
              <div className="text-2xl sm:text-3xl font-bold text-arca-green">ARCA</div>
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
          <div className="flex items-center gap-2 sm:gap-4">
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
                            className="bg-arca-green text-black font-semibold py-2 px-3 sm:px-4 rounded-lg hover:bg-arca-green/90 transition-colors flex items-center gap-2 text-sm sm:text-base"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17 7H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H7V9h10v8zm-1-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                              <path d="M20 5H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1z"/>
                            </svg>
                            <span className="hidden sm:inline">Connect Wallet</span>
                            <span className="sm:hidden">Connect</span>
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
                        <div className="flex items-center gap-1 sm:gap-2">
                          {/* Chain button - hidden on mobile */}
                          <button
                            onClick={openChainModal}
                            className="hidden sm:flex bg-arca-light-gray text-white font-semibold py-2 px-3 rounded-lg hover:bg-gray-600 transition-colors items-center gap-2"
                            type="button"
                          >
                            {/* Show chain icon from RainbowKit or fallback to Sonic logo */}
                            {chain.hasIcon && chain.iconUrl ? (
                              <div
                                style={{
                                  background: chain.iconBackground,
                                  width: 20,
                                  height: 20,
                                  borderRadius: 999,
                                  overflow: 'hidden',
                                }}
                              >
                                <img
                                  alt={chain.name ?? 'Chain icon'}
                                  src={chain.iconUrl}
                                  style={{ width: 20, height: 20 }}
                                />
                              </div>
                            ) : (
                              <img
                                src="/SonicLogoRound.png"
                                alt="Sonic"
                                className="w-5 h-5 rounded-full"
                              />
                            )}
                            {chain.name}
                          </button>

                          <button
                            onClick={openAccountModal}
                            type="button"
                            className="bg-arca-green text-black font-semibold py-2 px-2 sm:px-4 rounded-lg hover:bg-arca-green/90 transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-base"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="sm:w-4 sm:h-4">
                              <path d="M17 7H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H7V9h10v8zm-1-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                              <path d="M20 5H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1z"/>
                            </svg>
                            <span className="truncate max-w-[120px] sm:max-w-none">
                              {account.displayName}
                              {account.displayBalance && (
                                <span className="hidden lg:inline"> ({account.displayBalance})</span>
                              )}
                            </span>
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
