'use client';

import { Header } from '@/components/Header';
import { SocialLinks } from '@/components/SocialLinks';

export default function Staking() {
  return (
    <div className="min-h-screen bg-black relative">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-5"
        style={{ backgroundImage: 'url(/backgroundarca.jpg)' }}
      />
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
      <div className="relative z-10">
        <Header />

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{maxWidth: '100%'}}>
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-arca-green mb-4">
                Coming Soon
              </h1>
              <p className="text-xl text-gray-400 mb-8">
                Staking functionality is under development
              </p>
              <div className="w-16 h-1 bg-arca-green mx-auto"></div>
            </div>
          </div>

          {/* Social Links & Footer */}
          <SocialLinks />
        </main>
      </div>
    </div>
  );
}
