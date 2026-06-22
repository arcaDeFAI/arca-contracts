import Script from 'next/script'
import type { Metadata } from 'next'
import './landing.css'

export const metadata: Metadata = {
  title: 'Arca DeFi - Vault Management',
  description: 'Autonomous liquidity strategy management for concentrated-liquidity and DLMM vaults on Sonic.',
}

export default function LandingPage() {
  const featureCards = [
    {
      step: '01',
      title: 'Monitor the pool',
      description: 'arca continuously reads pool and market conditions through its autonomous strategy layer.',
    },
    {
      step: '02',
      title: 'Deploy liquidity',
      description: 'Deposited assets are positioned in strategy-defined ranges or bins for the selected market.',
    },
    {
      step: '03',
      title: 'Rebalance targets',
      description: 'Proprietary strategy logic adjusts target positioning when changing conditions call for a new range.',
    },
    {
      step: '04',
      title: 'Adapt capital',
      description: 'Reserve capital can be reallocated across the deposited pair to support active liquidity management.',
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
            Autonomous liquidity strategy management.<br />
            Dynamic ranges and in-pair capital allocation on Sonic.
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

      <main>
      <section className="model-section" aria-labelledby="model-title">
        <div className="model-shell">
          <div className="model-copy">
            <p className="section-label">The product model</p>
            <h2 id="model-title">Liquidity management that stays active after deposit.</h2>
            <p className="model-intro">
              arca manages concentrated-liquidity positions through autonomous strategy logic. It monitors pools,
              determines target ranges, and reallocates capital within each deposited pair as conditions evolve.
            </p>
            <p className="sonic-note"><span aria-hidden="true" />Built on Sonic&apos;s high-speed infrastructure.</p>
          </div>

          <div className="model-diagram" aria-label="arca product model: monitor, position, adapt, and manage capital">
            <div className="model-orbit" aria-hidden="true">
              <span className="orbit-line orbit-line-one" />
              <span className="orbit-line orbit-line-two" />
              <div className="orbit-moons">
                <span className="orbit-moon orbit-moon-sonic">
                  <img src="/landing/sonic.png" alt="" />
                </span>
                <span className="orbit-moon orbit-moon-shadow">
                  <img src="/landing/shadow.png" alt="" />
                </span>
                <span className="orbit-moon orbit-moon-metro">
                  <img src="/landing/metro.png" alt="" />
                </span>
              </div>
              <div className="model-core">
                <img src="/landing/arca.png" alt="" />
              </div>
            </div>
            <ol className="model-actions">
              <li><span>01</span><strong>Monitor</strong><small>Pool and market conditions</small></li>
              <li><span>02</span><strong>Position</strong><small>Strategy-defined ranges or bins</small></li>
              <li><span>03</span><strong>Adapt</strong><small>Targets as conditions evolve</small></li>
              <li><span>04</span><strong>Manage</strong><small>Reserve capital within the pair</small></li>
            </ol>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-inner">
          <div className="section-kicker">Vault workflow</div>
          <h2 className="features-title">From deposit to an actively managed position</h2>
          <p className="features-summary">Choose a supported vault and deposit the pair. arca handles positioning and ongoing strategy execution while the app keeps the vault visible.</p>
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
          <div className="workflow-exit">
            <span>Monitor in the app</span>
            <span aria-hidden="true">→</span>
            <span>Withdraw through the supported vault flow</span>
          </div>
        </div>
      </section>

      <section className="strategy-section" aria-labelledby="strategy-title">
        <div className="strategy-shell">
          <div className="strategy-heading">
            <p className="section-label">Adaptive strategy management</p>
            <h2 id="strategy-title">A rebalance changes where capital is working.</h2>
            <p>arca monitors autonomously. When proprietary strategy conditions are met, it updates the target position, redeploys liquidity, and continues evaluating the market.</p>
          </div>

          <div className="range-story" aria-label="Illustrative range rebalance sequence">
            <div className="range-axis" aria-hidden="true"><span>Lower price</span><span>Market movement</span><span>Higher price</span></div>
            <div className="range-stage range-stage-current">
              <div className="range-stage-copy"><span>01</span><strong>Active target</strong><small>Liquidity begins inside a strategy-defined range.</small></div>
              <div className="range-track" aria-hidden="true"><i className="range-zone zone-left" /><b className="market-marker marker-left" /></div>
            </div>
            <div className="range-stage range-stage-condition">
              <div className="range-stage-copy"><span>02</span><strong>Condition detected</strong><small>The strategy evaluates changing pool and market conditions.</small></div>
              <div className="range-track" aria-hidden="true"><i className="range-zone zone-left" /><b className="market-marker marker-edge" /><em>Evaluate</em></div>
            </div>
            <div className="range-stage range-stage-redeployed">
              <div className="range-stage-copy"><span>03</span><strong>Target redeployed</strong><small>Liquidity and reserve capital adapt within the deposited pair.</small></div>
              <div className="range-track" aria-hidden="true"><i className="range-zone zone-right" /><b className="market-marker marker-right" /></div>
            </div>
          </div>

          <div className="strategy-boundary">
            <div>
              <span className="boundary-title">The strategy can</span>
              <p>Monitor · adapt · rebalance · reallocate</p>
            </div>
            <div>
              <span className="boundary-title">It cannot</span>
              <p>Remove market risk · guarantee returns · eliminate impermanent loss</p>
            </div>
          </div>
        </div>
      </section>

      <section className="markets-section" aria-labelledby="markets-title">
        <div className="markets-shell">
          <div className="markets-heading">
            <p className="section-label">Two liquidity structures</p>
            <h2 id="markets-title">Different mechanics. The same need for active management.</h2>
          </div>

          <div className="market-comparison">
            <article className="market-mode">
              <div className="market-mode-copy">
                <span className="mode-index">CL</span>
                <h3>Concentrated liquidity</h3>
                <p>Liquidity is focused inside a selected price range. When price moves beyond it, capital becomes less productive and positioning needs attention.</p>
              </div>
              <div className="distribution-visual cl-visual" aria-label="Illustration of liquidity concentrated within a selected price range">
                <div className="distribution-bars" aria-hidden="true">
                  {[2, 3, 5, 8, 12, 18, 25, 31, 34, 31, 25, 18, 12, 8, 5, 3, 2].map((height, index) => <i key={index} style={{ '--bar-height': `${height * 2}px` } as React.CSSProperties} />)}
                </div>
                <div className="distribution-range"><span>Active range</span></div>
              </div>
            </article>

            <article className="market-mode">
              <div className="market-mode-copy">
                <span className="mode-index">DLMM</span>
                <h3>Bin-based liquidity</h3>
                <p>Liquidity is distributed across discrete price bins. Bin positioning and reserve allocation still need to respond as market conditions change.</p>
              </div>
              <div className="distribution-visual dlmm-visual" aria-label="Illustration of liquidity distributed across discrete price bins">
                <div className="distribution-bars" aria-hidden="true">
                  {[3, 5, 9, 15, 23, 31, 34, 28, 21, 15, 10, 7, 4, 2].map((height, index) => <i key={index} style={{ '--bar-height': `${height * 2}px` } as React.CSSProperties} />)}
                </div>
                <div className="bin-marker"><span>Active bins</span></div>
              </div>
            </article>
          </div>

          <div className="shared-role" aria-label="arca's shared role across concentrated liquidity and DLMM">
            <strong>arca&apos;s role across both</strong>
            <span>Monitor</span><i aria-hidden="true" />
            <span>Position</span><i aria-hidden="true" />
            <span>Adjust</span><i aria-hidden="true" />
            <span>Manage reserve capital</span>
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
                <div className="faq-answer"><div className="faq-answer-inner">arca is an AI-assisted liquidity management protocol on Sonic. Its autonomous strategy layer monitors supported pools, manages target ranges or bins, and reallocates capital within each deposited pair.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>Who is arca for?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">arca is built for LPs who want onchain yield exposure without constant manual range management. It fits both active DeFi users and users who prefer a more passive workflow.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>Which markets does arca support?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">arca supports selected concentrated-liquidity and DLMM pools on Sonic. Available vaults and pairs are shown in the app.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>How does the AI rebalancing work?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">arca combines predefined algorithms with adaptive strategy logic. It monitors pool and market conditions, determines target positioning, and adjusts ranges or bins autonomously without exposing proprietary execution conditions.</div></div>
              </div>
              <div className="faq-item">
                <button className="faq-question" type="button" aria-expanded="false"><span>Do I need to manage my position manually?</span><span className="faq-symbol">+</span></button>
                <div className="faq-answer"><div className="faq-answer-inner">The strategy layer operates autonomously, including ongoing monitoring and target management. Users can review their vault position and use the supported withdrawal flow in the app.</div></div>
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
                <div className="faq-answer"><div className="faq-answer-inner">Explore the vault interface and follow official arca channels for current product and strategy information.</div></div>
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
              <span>All rights reserved, © 2026</span>
            </div>
          </div>
        </div>
      </section>

      <Script src="/landing/script.js?v=ios-text-hotfix-1" strategy="afterInteractive" />
      </main>
    </>
  )
}
