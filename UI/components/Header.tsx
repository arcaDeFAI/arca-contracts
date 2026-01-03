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
    <header className="relative border-b border-white/[0.03] bg-black/40 backdrop-blur-xl sticky top-0 z-50">
      <div className="relative z-10 container mx-auto px-3 sm:px-6 lg:px-8" style={{ maxWidth: '100%' }}>
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6 sm:gap-10">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleMobileMenu}
                className="md:hidden flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <ArcaLogo size={32} className="text-arca-green" />
                <div className="text-base font-extrabold tracking-tight text-arca-green leading-none whitespace-nowrap">
                  Arca Finance
                </div>
                <svg className="w-5 h-5 text-arca-green ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <div className="hidden md:flex items-center gap-2 -mt-0.5">
                <ArcaLogo size={40} className="text-arca-green" />
                <div className="text-2xl font-extrabold tracking-tighter text-arca-green leading-none">Arca</div>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/vaults"
                className={`text-base tracking-wide transition-all ${pathname === '/vaults' || pathname === '/vaults/'
                  ? 'text-arca-green font-semibold'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Vaults
              </Link>
              <Link
                href="/dashboard"
                className={`text-base tracking-wide transition-all ${pathname.startsWith('/dashboard')
                  ? 'text-arca-green font-semibold'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Dashboard
              </Link>
              <Link
                href="/staking"
                className={`text-base tracking-wide transition-all ${pathname.startsWith('/staking')
                  ? 'text-arca-green font-semibold'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Staking
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            {/* Sonic Price */}
            {!isLoading && prices && (
              <div className="hidden md:flex items-center gap-2 py-1.5 px-3 bg-arca-green/10 border border-arca-green/30 rounded-xl">
                <span className="text-sm font-semibold text-white/70 uppercase tracking-[2px]">$S:</span>
                <span className="text-sm font-bold text-arca-green tabular-nums">${prices.sonic.toFixed(4)}</span>
              </div>
            )}
            {/* Sonic Price - Mobile */}
            {!isLoading && prices && (
              <div className="flex md:hidden items-baseline gap-1.5 bg-arca-green/10 border border-arca-green/30 px-2.5 py-1.5 rounded-lg">
                <span className="text-xs text-white/70 uppercase leading-none">$S:</span>
                <span className="text-sm font-bold text-arca-green tabular-nums leading-none">${prices.sonic.toFixed(4)}</span>
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
                            className="bg-white/[0.03] hover:bg-white/[0.08] text-white border border-white/[0.05] font-medium py-2 px-5 rounded-xl transition-all text-base"
                          >
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
                        <div className="flex items-center gap-2 sm:gap-3">
                          {/* Chain button - hidden on mobile */}
                          <button
                            onClick={openChainModal}
                            className="hidden sm:flex bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white transition-all py-2 px-4 rounded-xl items-center gap-2"
                            type="button"
                          >
                            {chain.hasIcon && chain.iconUrl ? (
                              <img
                                alt={chain.name ?? 'Chain icon'}
                                src={chain.iconUrl}
                                className="w-5 h-5 rounded-full"
                              />
                            ) : (
                              <img
                                src="/SonicLogoRound.png"
                                alt="Sonic"
                                className="w-5 h-5 rounded-full"
                              />
                            )}
                            <span className="text-sm font-semibold tracking-wide uppercase">{chain.name}</span>
                          </button>

                          <button
                            onClick={openAccountModal}
                            type="button"
                            className="bg-arca-green hover:bg-arca-green/90 text-black font-bold py-1.5 px-2.5 sm:py-2 sm:px-5 rounded-lg sm:rounded-xl transition-all flex items-center gap-2 text-sm sm:text-base"
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            <span className="hidden sm:inline">
                              {account.displayName}
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
            <div className="px-4 py-6 space-y-6">
              <Link
                href="/vaults"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-xl tracking-tight transition-all ${pathname === '/vaults' || pathname === '/vaults/'
                  ? 'text-arca-green font-bold'
                  : 'text-white'
                  }`}
              >
                Vaults
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-xl tracking-tight transition-all ${pathname.startsWith('/dashboard')
                  ? 'text-arca-green font-bold'
                  : 'text-white'
                  }`}
              >
                Dashboard
              </Link>
              <Link
                href="/staking"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-xl tracking-tight transition-all ${pathname.startsWith('/staking')
                  ? 'text-arca-green font-bold'
                  : 'text-white'
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
