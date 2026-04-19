'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePrices } from '@/contexts/PriceContext';

export function Header() {
  const pathname = usePathname();
  const { prices, isLoading } = usePrices();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

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

  const navItems = [
    { href: '/vaults', label: 'Vaults', isActive: pathname === '/vaults' || pathname === '/vaults/' },
    { href: '/dashboard', label: 'Dashboard', isActive: pathname.startsWith('/dashboard') },
    { href: '/staking', label: 'Staking', isActive: pathname.startsWith('/staking') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Frosted glass bar */}
      <div className="bg-arca-dark/70 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-8">
              {/* Mobile: Logo + toggle */}
              <button
                onClick={toggleMobileMenu}
                className="md:hidden flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <img src="/landing/arca.png" alt="arca logo" className="w-7 h-7 rounded-lg" />
                <span className="text-arca-text font-semibold text-sm tracking-tight">arca Finance</span>
                <svg
                  className="w-4 h-4 text-arca-text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              {/* Desktop: Logo */}
              <Link href="/" className="hidden md:flex items-center gap-2 hover:opacity-90 transition-opacity">
                <img src="/landing/arca.png" alt="arca logo" className="w-8 h-8 rounded-lg" />
                <span className="text-arca-text font-semibold text-base tracking-tight">arca Finance</span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map(({ href, label, isActive }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                      ? 'text-arca-green bg-arca-green/[0.08]'
                      : 'text-arca-text-secondary hover:text-arca-text hover:bg-white/[0.04]'
                      }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right: Price + Wallet */}
            <div className="flex items-center gap-3">
              {/* Sonic Price Chip */}
              {!isLoading && prices && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <span className="text-xs text-arca-text-secondary">S</span>
                  <span className="text-sm font-semibold text-arca-text">${prices.sonic.toFixed(4)}</span>
                </div>
              )}

              {/* Wallet Button */}
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
                              className="flex items-center gap-2 bg-arca-green text-arca-dark font-semibold py-2 px-4 rounded-xl text-sm hover:bg-arca-green/90 hover:shadow-glow-green transition-all duration-200 active:scale-[0.97]"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17 7H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H7V9h10v8zm-1-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                                <path d="M20 5H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1z" />
                              </svg>
                              <span className="hidden sm:inline">Connect Wallet</span>
                              <span className="sm:hidden">Connect</span>
                            </button>
                          );
                        }

                        if (connected && chain.unsupported) {
                          return (
                            <button
                              onClick={openChainModal}
                              type="button"
                              className="bg-red-500/20 text-red-400 border border-red-500/30 font-medium py-2 px-4 rounded-xl text-sm hover:bg-red-500/30 transition-all"
                            >
                              Wrong network
                            </button>
                          );
                        }

                        return (
                          <div className="flex items-center gap-2">
                            {/* Chain button */}
                            <button
                              onClick={openChainModal}
                              className="hidden sm:flex items-center gap-1.5 py-2 px-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-arca-text text-sm font-medium hover:bg-white/[0.08] transition-all"
                              type="button"
                            >
                              {connected && chain.hasIcon && chain.iconUrl ? (
                                <div
                                  style={{
                                    background: chain.iconBackground,
                                    width: 18,
                                    height: 18,
                                    borderRadius: 999,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <img
                                    alt={chain.name ?? 'Chain icon'}
                                    src={chain.iconUrl}
                                    style={{ width: 18, height: 18 }}
                                  />
                                </div>
                              ) : (
                                <img
                                  src="/SonicLogoRound.png"
                                  alt="Sonic"
                                  className="w-[18px] h-[18px] rounded-full"
                                />
                              )}
                              <span className="hidden lg:inline">{connected ? chain.name : 'Sonic'}</span>
                            </button>

                            {/* Account button */}
                            <button
                              onClick={openAccountModal}
                              type="button"
                              className="relative flex items-center gap-2 rounded-xl bg-arca-green px-3 py-2 text-xs font-semibold text-arca-dark transition-all duration-200 active:scale-[0.97] sm:px-4 sm:text-sm hover:bg-arca-green/90"
                            >
                              <span
                                className="pointer-events-none absolute inset-0 rounded-xl opacity-0 shadow-[0_0_18px_rgba(235,241,248,0.18)]"
                                style={{ animation: 'arcaGlowReveal 720ms ease-out forwards' }}
                              />
                              <span
                                className="pointer-events-none absolute -bottom-1 left-1/2 h-4 w-[74%] -translate-x-1/2 rounded-full bg-[#eef3fb]/0 opacity-0 blur-md shadow-[0_0_22px_rgba(238,243,251,0.2)]"
                                style={{ animation: 'arcaGlowReveal 820ms ease-out forwards' }}
                              />
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="relative z-[1]">
                                <path d="M17 7H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H7V9h10v8zm-1-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                              </svg>
                              <span className="relative z-[1] truncate max-w-[100px] sm:max-w-none">
                                {account?.displayName ?? ''}
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

          {/* Mobile Menu — dropdown under header */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-white/[0.06] animate-fade-in">
              <div className="px-2 py-3 space-y-1">
                {navItems.map(({ href, label, isActive }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`relative block px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                      ? 'text-arca-green bg-arca-green/[0.08]'
                      : 'text-arca-text-secondary hover:text-arca-text hover:bg-white/[0.04]'
                      }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
