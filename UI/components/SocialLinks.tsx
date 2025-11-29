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
    <div className="mt-12 mb-8">
      {/* Social Links */}
      <div className="flex justify-center items-center gap-6 mb-6">
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
              className="w-8 h-8 rounded-lg object-cover bg-black transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,163,0.5)]"
            />
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-black border border-arca-green rounded-lg text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {social.name}
            </div>
          </a>
        ))}
      </div>

    </div>
  );
}
