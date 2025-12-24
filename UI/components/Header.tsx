'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ArcaLogo } from './ArcaLogo';
import { usePrices } from '@/contexts/PriceContext';
import { formatUSD } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();
  const { prices, isLoading } = usePrices();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Close mobile menu when clicking outside or pressing escape
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMobileMenuOpen && !target.closest('header')) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isMobileMenuOpen && event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMobileMenuOpen]);

  return (
    <header className="relative border-b border-gray-800/50 backdrop-blur-md sticky top-0 z-50">
      <div className="relative z-10 container mx-auto px-3 sm:px-6 lg:px-8" style={{ maxWidth: '100%' }}>
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleMobileMenu}
                className="md:hidden flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <ArcaLogo width={120} height={40} />
                <svg
                  className="w-5 h-5 text-arca-green"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <div className="hidden md:flex items-center">
                <ArcaLogo width={140} height={48} />
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/vaults"
                className={`text-lg italic transition-colors ${pathname === '/vaults' || pathname === '/vaults/'
                    ? 'text-arca-green font-bold border border-arca-green rounded-full px-4 py-1'
                    : 'text-white hover:text-arca-green'
                  }`}
              >
                Vaults
              </Link>
              <Link
                href="/dashboard"
                className={`text-lg italic transition-colors ${pathname.startsWith('/dashboard')
                    ? 'text-arca-green font-bold border border-arca-green rounded-full px-4 py-1'
                    : 'text-white hover:text-arca-green'
                  }`}
              >
                Dashboard
              </Link>
              <Link
                href="/staking"
                className={`text-lg italic transition-colors ${pathname.startsWith('/staking')
                    ? 'text-arca-green font-bold border border-arca-green rounded-full px-4 py-1'
                    : 'text-white hover:text-arca-green'
                  }`}
              >
                Staking
              </Link>
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
            {/* Sonic Price - Mobile */}
            {!isLoading && prices && (
              <div className="md:hidden flex items-center gap-1 px-2 py-1 bg-arca-green/10 rounded-lg border border-arca-green/20">
                <span className="text-xs text-gray-300">S:</span>
                <span className="text-sm font-bold text-arca-green">${prices.sonic.toFixed(4)}</span>
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
                              <path d="M17 7H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H7V9h10v8zm-1-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                              <path d="M20 5H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1z" />
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
                              <path d="M17 7H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H7V9h10v8zm-1-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                              <path d="M20 5H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1z" />
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

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-arca-light-gray" style={{ background: 'rgba(0, 0, 0, 0.95)' }}>
            <div className="px-3 py-4 space-y-3">
              <Link
                href="/vaults"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-lg italic transition-colors ${pathname === '/vaults' || pathname === '/vaults/'
                    ? 'text-arca-green font-bold border border-arca-green rounded-full px-4 py-2'
                    : 'text-white hover:text-arca-green'
                  }`}
              >
                Vaults
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-lg italic transition-colors ${pathname.startsWith('/dashboard')
                    ? 'text-arca-green font-bold border border-arca-green rounded-full px-4 py-2'
                    : 'text-white hover:text-arca-green'
                  }`}
              >
                Dashboard
              </Link>
              <Link
                href="/staking"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-lg italic transition-colors ${pathname.startsWith('/staking')
                    ? 'text-arca-green font-bold border border-arca-green rounded-full px-4 py-2'
                    : 'text-white hover:text-arca-green'
                  }`}
              >
                Staking
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
