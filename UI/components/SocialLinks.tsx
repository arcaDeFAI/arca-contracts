'use client';

interface SocialLink {
  name: string;
  url: string;
  logo: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    name: 'X (Twitter)',
    url: 'https://x.com/arcafinance?s=21&t=zt39e5oJGM80gKgg0NRGzA',
    logo: '/XLogoGreen.jpg',
  },
  {
    name: 'Telegram',
    url: 'https://t.me/arcaFinance',
    logo: '/TGLogoGreen.jpg',
  },
  {
    name: 'Discord',
    url: 'https://discord.gg/acnhr7QMga',
    logo: '/DiscordLogoGreen.jpg',
  },
  {
    name: 'GitHub',
    url: 'https://github.com/arcaDeFAI/arca-contracts',
    logo: '/GithubLogoGreen.jpg',
  },
  {
    name: 'Docs',
    url: 'https://arcafinance.gitbook.io/arcafinance-docs',
    logo: '/DocsLogoGreen.jpg',
  },
];

export function SocialLinks() {
  return (
    <div className="py-8">
      <div className="flex justify-center items-center gap-4 mb-4">
        {SOCIAL_LINKS.map((social) => (
          <a
            key={social.name}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative"
            aria-label={social.name}
          >
            <img
              src={social.logo}
              alt={social.name}
              className="w-7 h-7 rounded-lg object-cover bg-arca-dark transition-all duration-300 hover:scale-110 hover:shadow-glow-green opacity-60 hover:opacity-100"
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2.5 py-1 bg-arca-gray border border-white/[0.08] rounded-lg text-arca-text text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-elevated">
              {social.name}
            </div>
          </a>
        ))}
      </div>
      <p className="text-center text-arca-text-tertiary text-[11px]">
        arca Finance © {new Date().getFullYear()}
      </p>
    </div>
  );
}
