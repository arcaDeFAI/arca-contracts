/**
 * Demo Mode Configuration
 *
 * Controls the display of fake data warnings throughout the application.
 * In production, set REACT_APP_DEMO_MODE=false to hide warnings when real data is used.
 */

export interface DemoModeConfig {
  enabled: boolean;
  showWarnings: boolean;
  useFakeData: boolean;
}

export type PriceOracleOverride = "mock" | "coingecko" | "auto";

/**
 * Get demo mode configuration from environment variables
 */
export function getDemoModeConfig(): DemoModeConfig {
  // Use import.meta.env for Vite instead of process.env
  const isDemo = import.meta.env.VITE_DEMO_MODE !== "false";

  // Price oracle override takes precedence over VITE_USE_REAL_PRICES
  const priceOverride = import.meta.env
    .VITE_PRICE_ORACLE_OVERRIDE as PriceOracleOverride;
  const useRealPrices = import.meta.env.VITE_USE_REAL_PRICES === "true";

  // Determine price source based on override or fallback to useRealPrices
  let useFakeData: boolean;
  if (priceOverride === "mock") {
    useFakeData = true;
  } else if (priceOverride === "coingecko") {
    useFakeData = false;
  } else {
    // Default/auto behavior - use existing logic
    useFakeData = !useRealPrices;
  }

  return {
    enabled: isDemo,
    showWarnings: isDemo,
    useFakeData,
  };
}

/**
 * Default demo mode configuration
 */
export const DEMO_MODE = getDemoModeConfig();

/**
 * Demo mode messages
 */
export const DEMO_MESSAGES = {
  DASHBOARD_BANNER:
    "⚠️ DEMO DATA - Token prices, APR, and portfolio values are not real",
  FAKE_APR_WARNING: "TEST APR - NOT GUARANTEED",
  FAKE_PRICE_WARNING: "DEMO PRICES",
  FAKE_PORTFOLIO_WARNING: "DEMO USD VALUES",
  MODAL_TITLE: "Demo Mode Active",
  MODAL_DESCRIPTION:
    "This application is currently showing demo/test data. All financial information including APR, token prices, and portfolio values are not real and should not be used for investment decisions.",
} as const;

/**
 * Check if demo warnings should be shown for a specific feature
 */
export const shouldShowDemoWarning = (
  feature: keyof typeof DEMO_MESSAGES,
): boolean => {
  return DEMO_MODE.enabled && DEMO_MODE.showWarnings;
};
