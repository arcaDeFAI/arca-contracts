/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE: string;
  readonly VITE_USE_REAL_PRICES: string;
  readonly VITE_COINGECKO_API_KEY: string;
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
  readonly VITE_NETWORK_OVERRIDE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
