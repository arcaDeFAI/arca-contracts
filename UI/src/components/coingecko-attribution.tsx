/**
 * CoinGecko Attribution Component
 *
 * Provides proper attribution for CoinGecko API usage as required by their free plan.
 * Includes logo, text attribution, and proper linking.
 */

interface CoinGeckoAttributionProps {
  className?: string;
  variant?: "minimal" | "full";
  size?: "small" | "medium";
}

export function CoinGeckoAttribution({
  className = "",
  variant = "minimal",
  size = "small",
}: CoinGeckoAttributionProps) {
  const textSizeClass = size === "small" ? "text-xs" : "text-sm";
  const logoSizeClass = size === "small" ? "h-3" : "h-4";

  return (
    <div
      className={`flex items-center gap-1 text-arca-secondary ${textSizeClass} ${className}`}
    >
      {variant === "full" && <span>Price data by</span>}
      <a
        href="https://www.coingecko.com?utm_source=arca&utm_medium=referral"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:text-arca-primary transition-colors"
      >
        {/* CoinGecko Logo SVG */}
        <svg
          className={`${logoSizeClass} w-auto`}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="16" cy="16" r="16" fill="#8DC647" />
          <path
            d="M23.5 12.5C23.5 8.91015 20.5899 6 17 6C13.4101 6 10.5 8.91015 10.5 12.5C10.5 16.0899 13.4101 19 17 19C20.5899 19 23.5 16.0899 23.5 12.5Z"
            fill="white"
          />
          <circle cx="15" cy="11" r="1.5" fill="#8DC647" />
          <circle cx="19" cy="11" r="1.5" fill="#8DC647" />
          <path
            d="M14 15C14 15.5523 14.4477 16 15 16H19C19.5523 16 20 15.5523 20 15V14H14V15Z"
            fill="#8DC647"
          />
          <path
            d="M11 22C11 24.2091 12.7909 26 15 26H19C21.2091 26 23 24.2091 23 22V20H11V22Z"
            fill="#8DC647"
          />
        </svg>
        <span className="hover:underline">
          {variant === "full" ? "CoinGecko" : "CoinGecko"}
        </span>
      </a>
    </div>
  );
}

/**
 * Minimal attribution for tight spaces
 */
export function CoinGeckoAttributionMinimal({
  className = "",
}: {
  className?: string;
}) {
  return (
    <CoinGeckoAttribution
      variant="minimal"
      size="small"
      className={className}
    />
  );
}

/**
 * Full attribution with "Price data by" prefix
 */
export function CoinGeckoAttributionFull({
  className = "",
}: {
  className?: string;
}) {
  return (
    <CoinGeckoAttribution variant="full" size="medium" className={className} />
  );
}
