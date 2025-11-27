'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArcaLogo } from '@/components/ArcaLogo'

export default function Home() {
  const [understandsRisks, setUnderstandsRisks] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: 'url(/backgroundarca.png)' }}
      />
      {/* Gradient Overlay */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
      
      {/* Navigation */}
      <nav className="relative z-10 px-6 py-6 md:px-12 lg:px-16">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <ArcaLogo size={40} className="w-10 h-10" />
            <div className="text-3xl font-bold text-arca-green">ARCA</div>
          </div>

          {/* Mobile Menu Button - Removed since no navigation items */}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-20 flex flex-col items-center justify-center px-6 py-20 md:py-32 lg:py-40 min-h-[600px]">
        <div className="text-center max-w-4xl mx-auto relative z-30">
          {/* Main Title */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-arca-green bg-clip-text text-transparent">
            DeFi, Reinvented
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">
            AI-powered LP rebalancing strategies.
          </p>

          {/* CTA Button */}
          <div className="flex flex-col justify-center items-center gap-6 relative z-50">
            <Link
              href={understandsRisks ? "/vaults" : "#"}
              className={`px-8 py-4 font-semibold rounded-lg transition-all transform ${
                understandsRisks 
                  ? "bg-arca-green text-black hover:bg-arca-green/90 hover:scale-105 shadow-lg cursor-pointer" 
                  : "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50"
              }`}
              onClick={(e) => {
                if (!understandsRisks) {
                  e.preventDefault()
                }
              }}
            >
              Launch App
            </Link>
            
            {/* Arca Disclaimer */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-orange-900/20 border border-orange-600/50 rounded-lg p-6 text-left">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <span className="text-orange-400 text-sm font-semibold">ALPHA VERSION</span>
                </div>
                
                {/* Disclaimer Content */}
                <div className="space-y-3 text-xs leading-relaxed">
                  <p className="text-gray-300">
                    <span className="text-orange-400 font-semibold">⚠️ Disclaimer:</span>
                    The Arca DeFi platform is currently in alpha phase. This software is provided "as is" without any warranties. By using this platform, you acknowledge and agree that you are using it at your own risk.
                  </p>
                  
                  <p className="text-gray-300">
                    <span className="text-orange-400 font-semibold">Financial Risks:</span>
                    Cryptocurrency investments are subject to high market volatility and may result in partial or complete loss of funds. Past performance does not guarantee future results. Never invest more than you can afford to lose.
                  </p>
                  
                  <p className="text-gray-300">
                    <span className="text-orange-400 font-semibold">Smart Contract Risk:</span>
                    While our smart contracts are based on audited protocols from Metropolis and undergo security testing, all smart contracts carry inherent risks of bugs, exploits, or vulnerabilities that could result in loss of funds.
                  </p>
                  
                  <p className="text-gray-300">
                    <span className="text-orange-400 font-semibold">Technical Risk:</span>
                    The platform may experience downtime, bugs, or technical issues. We are not responsible for any losses incurred due to technical failures or platform unavailability.
                  </p>
                  
                  <p className="text-gray-300">
                    <span className="text-orange-400 font-semibold">Regulatory Risk:</span>
                    Cryptocurrency regulations vary by jurisdiction and are subject to change. Users are responsible for ensuring compliance with their local laws and regulations.
                  </p>
                  
                  <p className="text-gray-300">
                    <span className="text-orange-400 font-semibold">No Financial Advice:</span>
                    Nothing on this platform constitutes financial advice, investment recommendations, or solicitation to buy or sell any financial instruments. All content is for informational purposes only.
                  </p>
                  
                  <p className="text-gray-300">
                    <span className="text-orange-400 font-semibold">Do Your Own Research:</span>
                    You are solely responsible for conducting your own research and due diligence before making any investment decisions. Consult with qualified financial advisors if needed.
                  </p>
                </div>

                {/* Checkbox and Agreement */}
                <div className="mt-6 pt-4 border-t border-orange-600/30">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={understandsRisks}
                      onChange={(e) => setUnderstandsRisks(e.target.checked)}
                      className="mt-1 w-4 h-4 text-arca-green bg-arca-dark border-orange-600 rounded focus:ring-arca-green focus:ring-2"
                    />
                    <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                      I have read, understood, and accept all risks associated with using the Arca DeFi platform. I acknowledge that I am using this service at my own risk and that cryptocurrency investments may result in complete loss of funds.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 border border-arca-green/30 rounded-lg transform rotate-45 z-10"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 border border-arca-green/30 rounded-full z-10"></div>
        <div className="absolute top-40 right-20 w-16 h-16 border border-arca-green/30 rounded-lg transform rotate-12 z-10"></div>
      </main>
    </div>
  )
}
