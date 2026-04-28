'use client';

import { useState } from 'react';

interface SocialLink {
  name: string;
  url: string;
  logo: string;
}

type LegalModalType = 'terms' | null;

const SOCIAL_LINKS: SocialLink[] = [
  {
    name: 'X (Twitter)',
    url: 'https://x.com/arcafinance?s=21&t=zt39e5oJGM80gKgg0NRGzA',
    logo: '/x-logo.png',
  },
  {
    name: 'Telegram',
    url: 'https://t.me/arcaFinance',
    logo: '/telegram-logo.png',
  },
  {
    name: 'Discord',
    url: 'https://discord.gg/acnhr7QMga',
    logo: '/discord-logo.png',
  },
  {
    name: 'GitHub',
    url: 'https://github.com/arcaDeFAI/arca-contracts',
    logo: '/github-logo.png',
  },
  {
    name: 'Docs',
    url: 'https://arcafinance.gitbook.io/arcafinance-docs',
    logo: '/gitbook-logo.png',
  },
];

const LEGAL_COPY: Record<Exclude<LegalModalType, null>, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms and Conditions',
    body: [
      'ARCA FINANCE – TERMS OF USE',
      '1. Scope',
      'These Terms of Use (“Terms”) govern access to and use of the arca Finance user interface (“Interface”), which provides users with a web-based gateway to interact with decentralized smart contract systems (“Protocol”).',
      'The Interface is a non-custodial, read/write interface that enables users to interact with liquidity vaults and related infrastructure deployed on blockchain networks.',
      'arca Finance does not custody assets, execute transactions, or operate underlying smart contracts.',
      '2. Nature of the Service',
      'The Interface provides access to vault strategies and related analytics, enables users to prepare and submit transactions via their own wallet, and displays data related to positions, performance, and protocol activity.',
      'The Interface itself does not hold, transfer, or manage user funds, does not execute transactions, and does not control blockchain interactions.',
      'All actions are executed directly by the user through their wallet and the underlying smart contracts.',
      '3. Non-Custodial Disclaimer',
      'arca Finance has no access to user wallets, private keys, or funds, cannot recover assets in case of loss, error, or misuse, and does not act as a custodian, broker, or intermediary.',
      'Users are fully responsible for securing their wallet access, verifying all transactions before execution, and managing their own assets.',
      '4. Protocol Independence',
      'The Interface provides access to decentralized smart contracts that operate autonomously on-chain.',
      'These smart contracts are not controlled by arca Finance after deployment, may interact with third-party protocols (e.g. DEX liquidity pools), and operate based on predefined logic and market conditions.',
      'arca Finance does not guarantee performance of strategies, continuity of third-party integrations, or profitability or risk mitigation outcomes.',
      '5. Vault & Strategy Disclaimer',
      'arca Finance provides AI-assisted liquidity management strategies. These include automated rebalancing, capital allocation between active ranges and reserved funds, and market-informed adjustments.',
      'However, strategies are not risk-free, users may experience losses, including impermanent loss, and AI outputs are probabilistic, not deterministic.',
      'All usage is at the user’s own risk.',
      '6. No Financial Advice',
      'arca Finance does not provide investment advice, financial recommendations, or tax or legal guidance.',
      'All information presented through the Interface is informational only. Users are solely responsible for their decisions.',
      '7. User Responsibilities',
      'By using the Interface, users agree to use the service in compliance with applicable laws, not attempt to exploit, manipulate, or disrupt the system, and not interfere with smart contract execution or UI integrity.',
      'Users remain fully responsible for all actions performed through their wallet.',
      '8. Risks',
      'By interacting with the Interface and Protocol, users acknowledge risks including but not limited to smart contract vulnerabilities, market volatility and impermanent loss, oracle or data inaccuracies, third-party protocol risks, and network congestion or failures.',
      'Transactions on blockchain networks are irreversible.',
      '9. Availability',
      'arca Finance may update or modify the Interface at any time, limit or suspend access temporarily, or discontinue features without notice.',
      'No guarantee is given regarding uptime or availability.',
      '10. Limitation of Liability',
      'To the maximum extent permitted by law, arca Finance shall not be liable for loss of funds, smart contract failures, user errors, third-party protocol issues, or market-related losses.',
      'Use of the Interface is entirely at the user’s own risk.',
      '11. Termination',
      'Users may stop using the Interface at any time by disconnecting their wallet.',
      'arca Finance may restrict or discontinue access if necessary for security reasons, technical upgrades, or legal considerations.',
      '12. General',
      'These Terms may be updated periodically. Continued use of the Interface constitutes acceptance of the updated Terms.',
    ],
  },
};

export function SocialLinks() {
  const [openModal, setOpenModal] = useState<LegalModalType>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const modalContent = openModal ? LEGAL_COPY[openModal] : null;

  return (
    <>
      <div className="py-4">
        <div className="grid grid-cols-1 items-end gap-6 xl:grid-cols-[1fr_auto_1fr]">
          <div className="hidden xl:block" />

          <div className="flex flex-col items-center">
            <div className="mx-auto mb-3 flex w-fit items-center justify-center gap-2 rounded-full border border-white/[0.05] bg-white/[0.02] px-3 py-2 backdrop-blur-md">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent transition-transform duration-200 hover:scale-[1.08]"
                  aria-label={social.name}
                >
                  <span className="pointer-events-none absolute bottom-[5px] left-1/2 h-3 w-5 -translate-x-1/2 rounded-full bg-arca-green/0 blur-md opacity-0 transition-all duration-200 group-hover:bg-arca-green/40 group-hover:opacity-100" />
                  <img
                    src={social.logo}
                    alt={social.name}
                    className="relative z-[1] h-4.5 w-4.5 object-contain opacity-72 transition-all duration-200 group-hover:scale-110 group-hover:opacity-100"
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 transform whitespace-nowrap rounded-lg border border-white/[0.08] bg-arca-gray px-2.5 py-1 text-[10px] text-arca-text opacity-0 transition-opacity group-hover:opacity-100 shadow-elevated">
                    {social.name}
                  </div>
                </a>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpenModal('terms')}
              className="mb-1 text-[11px] text-arca-text-tertiary transition-colors duration-200 hover:text-arca-text"
            >
              Terms and Conditions
            </button>
            <p className="text-center text-[11px] text-arca-text-tertiary">
              arca Finance © {new Date().getFullYear()}
            </p>
          </div>

          <div className="hidden flex-col items-center text-center xl:ml-auto xl:flex xl:w-[300px] xl:items-end xl:justify-start xl:self-start xl:text-right">
            <img
              src="/arca-text-logo.png"
              alt="arca text logo"
              className="-mt-2 mb-3 h-auto w-[116px] object-contain opacity-92 xl:w-[128px]"
            />
            <p className="max-w-[300px] self-end text-[11px] font-medium uppercase tracking-[0.16em] text-arca-text-secondary xl:text-right">
              AI-powered Rebalancing Strategies
            </p>
          </div>
        </div>
      </div>

      {modalContent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
          onClick={() => setOpenModal(null)}
        >
          <div
            className="relative w-full max-w-[760px] rounded-[28px] border border-white/[0.12] bg-[linear-gradient(135deg,rgba(22,28,36,0.9),rgba(15,20,28,0.82)_50%,rgba(10,14,20,0.92))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl transition-transform duration-150 ease-out sm:p-8"
            onClick={(e) => e.stopPropagation()}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = (e.clientX - rect.left) / rect.width;
              const py = (e.clientY - rect.top) / rect.height;
              setTilt({
                x: (0.5 - py) * 8,
                y: (px - 0.5) * 10,
              });
            }}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            style={{
              transform: `perspective(1400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(0,255,136,0.08),transparent_35%)]" />

            <div className="relative">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex rounded-full border border-arca-green/[0.14] bg-arca-green/[0.06] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-arca-green">
                    arca Legal
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-arca-text">
                    {modalContent.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-arca-text-secondary transition-all duration-200 hover:border-white/[0.14] hover:text-arca-text"
                  aria-label="Close modal"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-2 text-sm leading-7 text-arca-text-secondary">
                {modalContent.body.map((paragraph, index) => {
                  const isPrimaryHeading = paragraph === 'ARCA FINANCE – TERMS OF USE';
                  const isSectionHeading = /^\d+\.\s/.test(paragraph);

                  if (isPrimaryHeading) {
                    return (
                      <p
                        key={`${openModal}-${index}`}
                        className="text-base font-semibold tracking-[0.02em] text-arca-text"
                      >
                        {paragraph}
                      </p>
                    );
                  }

                  if (isSectionHeading) {
                    return (
                      <p
                        key={`${openModal}-${index}`}
                        className="pt-2 text-sm font-semibold text-arca-text"
                      >
                        {paragraph}
                      </p>
                    );
                  }

                  return <p key={`${openModal}-${index}`}>{paragraph}</p>;
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
