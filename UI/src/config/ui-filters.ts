// UI filter and sorting configuration for vault interface

export const PLATFORM_OPTIONS = ["All Platforms", "DLMM"] as const;
export const SORT_OPTIONS = ["APR ↓", "APR ↑", "TVL ↓", "TVL ↑"] as const;

// Type exports for type safety
export type PlatformOption = (typeof PLATFORM_OPTIONS)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];
