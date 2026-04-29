import Script from 'next/script'
import type { Metadata } from 'next'
import './landing.css'

export const metadata: Metadata = {
  title: 'Arca DeFi - Vault Management',
  description: 'AI-powered rebalancing strategies. Optimized ranges, controlled risk, smarter yield.',
}

export default function LandingPage() {
  const featureCards = [
    {
      step: '01',
      title: 'Observe Market State',
      description: 'arca reads volatility, pool depth, price movement and range efficiency before moving liquidity.',
    },
    {
      step: '02',
      title: 'Allocate Liquidity',
      description: 'Capital is placed across active and reserve bands so positions can adapt without constant manual tuning.',
    },
    {
      step: '03',
      title: 'Rebalance Ranges',
      description: 'Strategies adjust concentrated liquidity and DLMM ranges as market structure changes.',
    },
    {
      step: '04',
      title: 'Compound Passively',
      description: 'Users stay positioned while arca handles execution, rewards, and operational friction.',
    },
  ] as const

  return (
    <>
      <section className="hero">
        <video className="bg-video" autoPlay muted loop playsInline>
          <source src="/landing/background.mp4" type="video/mp4" />
        </video>

        <div className="overlay"></div>

        <header className="header">
          <div className="brand">
            <img src="/landing/arca.png" alt="arca logo" className="logo" />
            <span className="brand-text">arca Finance</span>
          </div>
          <a href="/vaults" className="cta-btn small">arca App</a>
        </header>

        <div className="hero-content">
          <div className="hero-title-wrap">
            <div className="word-viewport">
              <div className="word-track" id="wordTrack">
                <div className="word font1">AUTOMATE</div>
                <div className="word font2">AUTOMATE</div>
                <div className="word font3">AUTOMATE</div>
                <div className="word font4">AUTOMATE</div>
                <div className="word font5">AUTOMATE</div>
                <div className="word font6">AUTOMATE</div>
                <div className="word font7">AUTOMATE</div>
                <div className="word font8">AUTOMATE</div>
                <div className="word font9">AUTOMATE</div>
              </div>
            </div>
            <div className="hero-title-bottom">EVERYTHING</div>
          </div>

          <p className="hero-subtitle">
            AI-powered rebalancing strategies.<br />
            Optimized ranges, controlled risk, smarter yield.
          </p>

          <a href="/vaults" className="cta-btn">Go to dApp</a>

          <div className="price-ticker-wrap">
            <div className="price-ticker">
              <div className="price-track" id="priceTrack">
                <div className="price-item" data-symbol="SHADOW">
                  <span className="coin-logo"><img src="/landing/shadow.png" alt="SHADOW logo" className="coin-logo-img" /></span>
                  <span className="coin-name">SHADOW</span>
                  <span className="coin-price">$0.00</span>
                </div>
                <div className="price-item" data-symbol="METRO">
                  <span className="coin-logo"><img src="/landing/metro.png" alt="METRO logo" className="coin-logo-img" /></span>
                  <span className="coin-name">METRO</span>
                  <span className="coin-price">$0.00</span>
                </div>
                <div className="price-item" data-symbol="BTC">
                  <span className="coin-logo"><img src="/landing/btc.png" alt="BTC logo" className="coin-logo-img" /></span>
                  <span className="coin-name">BTC</span>
                  <span className="coin-price">$0.00</span>
                </div>
                <div className="price-item" data-symbol="ETH">
                  <span className="coin-logo"><img src="/landing/eth.png" alt="ETH logo" className="coin-logo-img" /></span>
                  <span className="coin-name">ETH</span>
                  <span className="coin-price">$0.00</span>
                </div>
                <div className="price-item" data-symbol="SOL">
                  <span className="coin-logo"><img src="/landing/sol.png" alt="SOL logo" className="coin-logo-img" /></span>
                  <span className="coin-name">SOL</span>
                  <span className="coin-price">$0.00</span>
                </div>
                <div className="price-item" data-symbol="USDC">
                  <span className="coin-logo"><img src="/landing/usdc.png" alt="USDC logo" className="coin-logo-img" /></span>
                  <span className="coin-name">USDC</span>
                  <span className="coin-price">$0.00</span>
                </div>
                <div className="price-item" data-symbol="S">
                  <span className="coin-logo"><img src="/landing/sonic.png" alt="S logo" className="coin-logo-img" /></span>
                  <span className="coin-name">S</span>
                  <span className="coin-price">$0.00</span>
                </div>
                <div className="price-item" data-symbol="ARCA">
                  <span className="coin-logo"><img src="/landing/arca.png" alt="ARCA logo" className="coin-logo-img" /></span>
                  <span className="coin-name">ARCA</span>
                  <span className="coin-price soon">SOON</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="scroll-hint">
          <span>Scroll down</span>
          <span className="mouse"></span>
          <span>explore more</span>
        </div>
      </section>

      <section className="features-section">
        <div className="features-inner">
          <div className="section-kicker">Strategy engine</div>
          <h2 className="features-title">From market signal to managed position</h2>
          <div className="features-grid">
            {featureCards.map((card, index) => (
              <div key={card.title} className="feature-card reveal-card" style={{ transitionDelay: `${index * 0.08}s` }}>
                <div className="feature-step-badge" aria-hidden="true">
                  <span>{card.step}</span>
                </div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="faq-section">
        <div className="faq-shell">
          <div className="faq-grid">
            <div className="faq-left">
              <div className="faq-pill"><span aria-hidden="true" /> FAQ</div>
              <h2 className="faq-title">Answers</h2>
              <p className="faq-subtitle">A quick read on how arca manages liquidity, what it supports, and where the risk boundaries are.</p>
              <div className="faq-image-wrap">
                <img src="/landing/faq-image.png" alt="FAQ visual" className="faq-image" />
              </div>
            </div>

            <div className="faq-right">
              <div className="faq-item active">
                <button className="faq-question" type="button" aria-expanded="true"><span>What is arca Finance?</span><span className="faq-symbol">x</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">arca is an AI-powered liquidity management protocol. It automates LP strategies for concentrated liquidity and DLMM pools, handling rebalancing, risk management, and execution so users don&apos;t need to actively manage positions.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>Who is arca for?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">arca is built for LPs who want onchain yield exposure without constant manual range management. It fits both active DeFi users and users who prefer a more passive workflow.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>Which DEXs does arca support?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">arca currently supports Shadow (concentrated liquidity) and Metropolis (DLMM) pools on Sonic. Additional integrations depend on supported pools and deployment scope.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>How does the AI rebalancing work?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">arca monitors pool conditions, volatility, and range efficiency to adapt liquidity positioning. The goal is to reduce manual intervention while improving capital efficiency.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>Do I need to manage my position manually?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">No. The product is designed to reduce the need for constant manual repositioning by automating the strategy layer.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>Is arca safe?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">As with any DeFi product, users should assess smart contract, market, and liquidity risks. arca aims to reduce operational friction, but risk can never be fully removed.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>Do I need a large amount of capital to use arca?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">Not necessarily. Capital requirements depend more on supported pools, gas costs, and strategy fit than on a fixed minimum size.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>Where can I learn more?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">You can explore the app, read the docs, and follow official arca channels for product updates, strategy explanations, and launch details.</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-section">
        <div className="contact-shell">
          <video className="contact-bg-video" autoPlay muted loop playsInline>
            <source src="/landing/backgroundcontact.mp4" type="video/mp4" />
          </video>
          <div className="contact-overlay"></div>
          <div className="contact-content">
            <h2 className="contact-title">Curious about what we can deliver together?<br />Let&apos;s connect:</h2>
            <div className="contact-socials">
              <a href="https://discord.com/invite/acnhr7QMga" className="social-link" aria-label="Discord" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" className="social-icon" fill="currentColor"><path d="M20.317 4.369A19.791 19.791 0 0 0 15.885 3c-.191.328-.403.77-.552 1.116a18.27 18.27 0 0 0-5.643 0A12.64 12.64 0 0 0 9.138 3a19.736 19.736 0 0 0-4.438 1.372C1.893 8.58 1.133 12.683 1.513 16.729A19.92 19.92 0 0 0 6.84 19.5c.43-.586.814-1.209 1.145-1.865-.629-.238-1.23-.533-1.794-.876.151-.111.299-.227.442-.347 3.46 1.627 7.219 1.627 10.638 0 .145.12.293.236.442.347a11.77 11.77 0 0 1-1.797.877c.331.655.715 1.278 1.145 1.864a19.884 19.884 0 0 0 5.33-2.771c.446-4.69-.762-8.756-3.074-12.36ZM8.02 14.248c-1.037 0-1.889-.95-1.889-2.115 0-1.165.834-2.115 1.889-2.115 1.064 0 1.907.959 1.889 2.115 0 1.165-.834 2.115-1.889 2.115Zm7.001 0c-1.037 0-1.889-.95-1.889-2.115 0-1.165.834-2.115 1.889-2.115 1.064 0 1.907.959 1.889 2.115 0 1.165-.825 2.115-1.889 2.115Z"/></svg>
              </a>
              <a href="https://x.com/arcaFinance" className="social-link" aria-label="X" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" className="social-icon" fill="currentColor"><path d="M18.244 2H21l-6.02 6.88L22 22h-5.49l-4.3-5.94L7.01 22H4.25l6.44-7.36L2 2h5.63l3.89 5.39L18.244 2Zm-.97 18h1.53L6.8 3.89H5.16L17.274 20Z"/></svg>
              </a>
              <a href="https://t.me/arcaFinance" className="social-link" aria-label="Telegram" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" className="social-icon" fill="currentColor"><path d="M9.78 18.65c-.39 0-.32-.15-.46-.52l-1.17-3.86L17.2 8.9c.43-.26.82-.12.49.18l-7.34 6.63-.29 4.02c.42 0 .6-.19.84-.41l2.02-1.96 4.2 3.1c.78.43 1.33.21 1.52-.72l2.75-12.96c.28-1.14-.44-1.66-1.18-1.33L3.17 12.04c-1.1.44-1.08 1.06-.2 1.33l4.37 1.36 10.11-6.37c.48-.29.92-.13.56.19"/></svg>
              </a>
            </div>
            <div className="contact-footer-row">
              <span>arca Finance</span>
              <span>All rights reserved, (c) 2026</span>
            </div>
          </div>
        </div>
      </section>

      <Script src="/landing/script.js" strategy="afterInteractive" />
    </>
  )
}
