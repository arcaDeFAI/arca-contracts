'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ArcaLogo } from './ArcaLogo';
import { usePrices } from '@/contexts/PriceContext';

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

  // Check if a path is active
  const isActive = (path: string) => {
    if (path === '/vaults') {
      return pathname === '/vaults' || pathname === '/vaults/';
    }
    return pathname.startsWith(path);
  };

  // Navigation link component for consistent styling
  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        className={`
          relative text-base font-medium tracking-wide
          transition-all duration-200 ease-out
          px-5 py-2 rounded-full
          ${active
            ? 'text-black bg-arca-green shadow-[0_0_12px_rgba(0,255,136,0.4)]'
            : 'text-gray-300 hover:text-white hover:bg-white/5'
          }
        `}
      >
        {children}
      </Link>
    );
  };

  // Mobile navigation link
  const MobileNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`
          block text-base font-medium tracking-wide
          transition-all duration-200 ease-out
          px-5 py-2.5 rounded-full
          ${active
            ? 'text-black bg-arca-green shadow-[0_0_12px_rgba(0,255,136,0.4)]'
            : 'text-gray-300 hover:text-white hover:bg-white/5'
          }
        `}
      >
        {children}
      </Link>
    );
  };

  return (
    <header className="relative border-b border-arca-border/50 backdrop-blur-xl sticky top-0 z-50 bg-black/80">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: '100%' }}>
        <div className="flex items-center justify-between h-16">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-6 sm:gap-10">
            {/* Mobile: Logo + Hamburger */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden flex items-center gap-3 hover:opacity-80 transition-opacity"
              aria-label="Toggle menu"
            >
              <ArcaLogo width={120} height={40} />
              <svg
                className={`w-5 h-5 text-arca-green transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Desktop: Logo */}
            <div className="hidden md:block">
              <ArcaLogo width={140} height={48} />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <NavLink href="/vaults">Vaults</NavLink>
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/staking">Staking</NavLink>
            </nav>
          </div>

          {/* Right Side: Price & Connect */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Sonic Price - Desktop */}
            {!isLoading && prices && (
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-arca-green/10 rounded-xl border border-arca-green/20">
                <span className="text-sm text-gray-400">S</span>
                <span className="text-base font-semibold text-arca-green">${prices.sonic.toFixed(4)}</span>
              </div>
            )}

            {/* Sonic Price - Mobile */}
            {!isLoading && prices && (
              <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-arca-green/10 rounded-lg border border-arca-green/20">
                <span className="text-xs text-gray-400">S</span>
                <span className="text-sm font-semibold text-arca-green">${prices.sonic.toFixed(4)}</span>
              </div>
            )}

            {/* Connect Button */}
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
                            className="
                              bg-arca-green text-black font-semibold
                              py-2 px-4 sm:px-5 rounded-xl
                              hover:bg-arca-green/90 hover:shadow-[0_0_16px_rgba(0,255,136,0.3)]
                              active:scale-[0.98]
                              transition-all duration-150 ease-out
                              flex items-center gap-2 text-sm sm:text-base
                            "
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-80">
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
                            className="
                              bg-red-500 text-white font-semibold
                              py-2 px-4 rounded-xl
                              hover:bg-red-600
                              transition-colors duration-150
                            "
                          >
                            Wrong network
                          </button>
                        );
                      }

                      return (
                        <div className="flex items-center gap-2">
                          {/* Chain button - hidden on mobile */}
                          <button
                            onClick={openChainModal}
                            className="
                              hidden sm:flex items-center gap-2
                              bg-white/5 text-white font-medium
                              py-2 px-3 rounded-xl
                              border border-white/10
                              hover:bg-white/10 hover:border-white/20
                              transition-all duration-150
                            "
                            type="button"
                          >
                            {chain.hasIcon && chain.iconUrl ? (
                              <div
                                className="rounded-full overflow-hidden"
                                style={{
                                  background: chain.iconBackground,
                                  width: 20,
                                  height: 20,
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
                            <span className="text-sm">{chain.name}</span>
                          </button>

                          {/* Account button */}
                          <button
                            onClick={openAccountModal}
                            type="button"
                            className="
                              bg-arca-green text-black font-semibold
                              py-2 px-3 sm:px-4 rounded-xl
                              hover:bg-arca-green/90 hover:shadow-[0_0_16px_rgba(0,255,136,0.3)]
                              active:scale-[0.98]
                              transition-all duration-150 ease-out
                              flex items-center gap-2 text-sm
                            "
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-80">
                              <path d="M17 7H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H7V9h10v8zm-1-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                              <path d="M20 5H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1z" />
                            </svg>
                            <span className="truncate max-w-[100px] sm:max-w-[140px]">
                              {account.displayName}
                            </span>
                            {account.displayBalance && (
                              <span className="hidden lg:inline text-black/70 text-xs">
                                ({account.displayBalance})
                              </span>
                            )}
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
        <div
          className={`
            md:hidden overflow-hidden
            transition-all duration-200 ease-out
            ${isMobileMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          <div className="border-t border-arca-border/50 bg-black/95 backdrop-blur-xl">
            <nav className="px-4 py-4 space-y-2">
              <MobileNavLink href="/vaults">Vaults</MobileNavLink>
              <MobileNavLink href="/dashboard">Dashboard</MobileNavLink>
              <MobileNavLink href="/staking">Staking</MobileNavLink>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
