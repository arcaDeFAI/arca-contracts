import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import VaultCard from "../components/vault-card";
import {
  platforms,
  chains,
  sortOptions,
  realVaults as mockRealVaults,
  mockVaults,
} from "../data/mock-vaults";
import type { VaultFilters } from "../types/vault";
import { useRealVaults } from "../hooks/use-real-vaults";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Vaults() {
  // 🔍 DEBUG: Verify this is the component being rendered
  console.log("🔍 [Vaults] ======== VAULTS PAGE COMPONENT RENDERED ========");
  console.log("🔍 [Vaults] Component location: src/pages/vaults.tsx");
  console.log("🔍 [Vaults] Timestamp:", new Date().toISOString());

  // 🔍 DEBUG: Check browser storage for cached data
  console.log("🔍 [Vaults] Browser Storage Check:");
  console.log("🔍 [Vaults] localStorage keys:", Object.keys(localStorage));
  console.log("🔍 [Vaults] sessionStorage keys:", Object.keys(sessionStorage));

  // Look for any vault-related storage
  Object.keys(localStorage).forEach((key) => {
    if (
      key.toLowerCase().includes("vault") ||
      key.toLowerCase().includes("arca")
    ) {
      console.log(
        `🔍 [Vaults] localStorage.${key}:`,
        localStorage.getItem(key),
      );
    }
  });

  // 🔍 DEBUG: Log call stack
  console.log("🔍 [Vaults] Call stack:", new Error().stack);

  const [filters, setFilters] = useState<VaultFilters>({
    platform: "All Platforms",
    chain: "Sonic",
    sortBy: "APR ↓",
    search: "",
  });

  const { vaults: realVaults, isLoading, error } = useRealVaults();

  // 🔍 DEBUG: Check mock vault imports
  console.log("🔍 [Vaults Page] MOCK DATA CHECK:");
  console.log("🔍 [Vaults Page] mockRealVaults:", mockRealVaults);
  console.log("🔍 [Vaults Page] mockVaults:", mockVaults);
  console.log("🔍 [Vaults Page] platforms:", platforms);
  console.log("🔍 [Vaults Page] chains:", chains);

  // 🔍 DEBUG: Log vault data received in component
  console.log("🔍 [Vaults Page] DEBUG START");
  console.log("🔍 [Vaults Page] realVaults received:", realVaults);
  console.log("🔍 [Vaults Page] realVaults.length:", realVaults.length);
  console.log("🔍 [Vaults Page] isLoading:", isLoading);
  console.log("🔍 [Vaults Page] error:", error);

  if (realVaults.length > 0) {
    realVaults.forEach((vault, index) => {
      console.log(`🔍 [Vaults Page] Vault ${index}:`, {
        id: vault.id,
        name: vault.name,
        tokens: vault.tokens,
        platform: vault.platform,
        chain: vault.chain,
        totalTvl: vault.totalTvl,
        apr: vault.apr,
      });
    });
  }

  const filteredAndSortedVaults = useMemo(() => {
    const filtered = realVaults.filter((vault) => {
      // Platform filter
      if (
        filters.platform !== "All Platforms" &&
        vault.platform !== filters.platform
      ) {
        return false;
      }

      // Chain filter
      if (filters.chain !== "All Chains" && vault.chain !== filters.chain) {
        return false;
      }

      // Search filter
      if (
        filters.search &&
        !vault.name.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "APR ↓":
          return b.apr - a.apr;
        case "APR ↑":
          return a.apr - b.apr;
        case "TVL ↓":
          return b.totalTvl - a.totalTvl;
        case "TVL ↑":
          return a.totalTvl - b.totalTvl;
        default:
          return 0;
      }
    });

    return filtered;
  }, [filters, realVaults]);

  const handleVaultClick = (vault: (typeof realVaults)[0]) => {
    // Future: Navigate to vault details or open deposit modal
    // eslint-disable-next-line no-console
    console.log("Vault selected:", vault);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8 flex items-center space-x-3 sm:space-x-4">
        <div className="w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center text-[#469c46]">
          <svg
            viewBox="0 0 24 24"
            className="w-8 sm:w-10 h-8 sm:h-10 text-arca-primary"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M12 2C13.1 2 14 2.9 14 4V6H20C21.1 6 22 6.9 22 8V20C22 21.1 21.1 22 20 22H4C2.9 22 2 21.1 2 20V8C2 6.9 2.9 6 4 6H10V4C10 2.9 10.9 2 12 2ZM12 4V6H12V4ZM6 10V12H8V10H6ZM6 14V16H8V14H6ZM10 10V12H12V10H10ZM10 14V16H12V14H10ZM14 10V12H16V10H14ZM14 14V16H16V14H14ZM18 10V12H20V10H18ZM18 14V16H20V14H18Z" />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-white">Vaults</h1>
      </div>
      {/* Filter Controls */}
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 items-start justify-between">
        <div className="flex flex-col gap-4 w-full">
          {/* Mobile Search - Top on mobile */}
          <div className="relative w-full sm:hidden">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-arca-secondary h-4 w-4" />
            <Input
              type="text"
              placeholder="Search vaults..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="w-full bg-arca-surface border-arca-border rounded-lg pl-10 text-white focus:border-arca-primary"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
            {/* Platform Filter */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-arca-secondary font-medium text-xs sm:text-sm whitespace-nowrap">
                PLATFORM:
              </span>
              <Select
                value={filters.platform}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, platform: value }))
                }
              >
                <SelectTrigger className="w-full sm:w-[160px] lg:w-[180px] bg-arca-surface border-arca-border text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-arca-surface border-arca-border">
                  {platforms.map((platform) => (
                    <SelectItem
                      key={platform}
                      value={platform}
                      className="text-white hover:bg-arca-border text-sm"
                    >
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chain Filter */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-arca-secondary font-medium text-xs sm:text-sm whitespace-nowrap">
                CHAIN:
              </span>
              <Select
                value={filters.chain}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, chain: value }))
                }
              >
                <SelectTrigger className="w-full sm:w-[140px] lg:w-[160px] bg-arca-surface border-arca-border text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-arca-surface border-arca-border">
                  {chains.map((chain) => (
                    <SelectItem
                      key={chain}
                      value={chain}
                      className="text-white hover:bg-arca-border text-sm"
                    >
                      {chain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Filter */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-arca-secondary font-medium text-xs sm:text-sm whitespace-nowrap">
                SORT BY:
              </span>
              <Select
                value={filters.sortBy}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, sortBy: value }))
                }
              >
                <SelectTrigger className="w-full sm:w-[120px] lg:w-[140px] bg-arca-surface border-arca-border text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-arca-surface border-arca-border">
                  {sortOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className="text-white hover:bg-arca-border text-sm"
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Desktop Search */}
        <div className="relative w-full sm:w-80 hidden sm:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-arca-secondary h-4 w-4" />
          <Input
            type="text"
            placeholder="Search vaults..."
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            className="w-full bg-arca-surface border-arca-border rounded-lg pl-10 text-white focus:border-arca-primary"
          />
        </div>
      </div>
      {/* Vaults Table */}
      <div className="overflow-hidden">
        {/* Desktop Table Header */}
        <div className="hidden sm:grid grid-cols-5 gap-6 px-10 py-4 mb-4">
          <div className="text-arca-secondary font-medium text-sm">POOL</div>
          <div className="text-arca-secondary font-medium text-sm">
            USER BALANCE
          </div>
          <div className="text-arca-secondary font-medium text-sm">
            TOTAL TVL
          </div>
          <div className="text-arca-secondary font-medium text-sm">
            QUEUE STATUS
          </div>
          <div className="text-arca-secondary font-medium text-sm">REWARDS</div>
        </div>

        {/* Vault Rows */}
        {isLoading ? (
          <div className="px-6 py-12 text-center bg-arca-surface rounded-xl border border-arca-border mx-4">
            <p className="text-arca-secondary">Loading vaults...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center bg-arca-surface rounded-xl border border-arca-border mx-4">
            <p className="text-red-500">Error loading vaults: {error}</p>
          </div>
        ) : filteredAndSortedVaults.length > 0 ? (
          filteredAndSortedVaults.map((vault) => {
            console.log(
              "🔍 [Vaults Page] Rendering VaultCard for vault:",
              vault.name,
            );
            return (
              <VaultCard
                key={vault.id}
                vault={vault}
                onClick={() => handleVaultClick(vault)}
              />
            );
          })
        ) : (
          <div className="px-6 py-12 text-center bg-arca-surface rounded-xl border border-arca-border mx-4">
            <p className="text-arca-secondary">
              No vaults found matching your criteria.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
