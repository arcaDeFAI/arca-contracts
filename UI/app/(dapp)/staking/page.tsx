'use client';

import { Header } from '@/components/Header';
import { SocialLinks } from '@/components/SocialLinks';

export default function Staking() {
  return (
    <div className="min-h-screen bg-arca-dark relative">
      {/* Subtle ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-arca-green/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Header />

        <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-arca-green/[0.08] border border-arca-green/[0.12] flex items-center justify-center mx-auto mb-6">
                <svg className="w-7 h-7 text-arca-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-arca-text tracking-tight mb-3">
                Coming Soon
              </h1>
              <p className="text-arca-text-secondary text-sm mb-6 max-w-sm mx-auto leading-relaxed">
                Staking functionality is under active development. Stay tuned for updates.
              </p>
              <div className="w-12 h-[2px] bg-arca-green/40 mx-auto rounded-full"></div>
            </div>
          </div>

          <SocialLinks />
        </main>
      </div>
    </div>
  );
}
