// Storage interface for Web3 DeFi application
// User authentication handled by wallet connection
// This storage layer can be extended for caching on-chain data or UI preferences

export interface IStorage {
  // Future: Add methods for caching vault data, user preferences, etc.
  // Example: getUserPreferences(walletAddress: string): Promise<UserPreferences | undefined>;
}

export class MemStorage implements IStorage {
  constructor() {
    // Ready for future Web3-specific storage needs
  }
}

export const storage = new MemStorage();
