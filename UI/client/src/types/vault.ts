export interface Vault {
  id: number;
  name: string;
  platform: string;
  chain: string;
  earnings: number;
  poolTvl: number;
  farmTvl: number;
  apr: number;
  aprDaily: number;
  tokens: string[];
}

export interface VaultFilters {
  platform: string;
  chain: string;
  sortBy: string;
  search: string;
}
