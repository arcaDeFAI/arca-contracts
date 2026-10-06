'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Header } from '@/components/Header';
import { SocialLinks } from '@/components/SocialLinks';

/** Wallet state only exists in the browser — render pages after mount to avoid hydration mismatches. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function PageShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  return (
    <div className="flex min-h-screen flex-col bg-arca-dark">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{mounted ? children : null}</main>
      <footer className="mx-auto w-full max-w-6xl border-t border-white/[0.04] px-4 py-8 sm:px-6">
        <SocialLinks />
      </footer>
    </div>
  );
}
