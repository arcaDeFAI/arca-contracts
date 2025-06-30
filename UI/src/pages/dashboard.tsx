import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useLocation } from "wouter";
import { useAccount } from "wagmi";
import { useDashboardData } from "../hooks/use-dashboard-data";
import { formatCurrency } from "../lib/utils";
import {
  DemoBanner,
  DemoModeModal,
  DemoDataWrapper,
  InlineWarning,
} from "../components/demo-warnings";
import { CoinGeckoAttributionFull } from "../components/coingecko-attribution";

// Generate some sample historical data for now
// TODO: Replace with real transaction history data
const generateChartData = (
  totalBalance: number,
  totalDeposited: number,
  totalEarnings: number,
) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const depositsGrowth = totalDeposited / months.length;
  const earningsGrowth = totalEarnings / months.length;

  return months.map((month, index) => ({
    name: month,
    deposits: Math.floor(depositsGrowth * (index + 1)),
    earnings: Math.floor(earningsGrowth * (index + 1)),
  }));
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { address: userAddress, isConnected } = useAccount();

  // Use the dashboard data hook for all calculations
  const {
    totalPortfolioValue,
    totalDeposited,
    totalEarnings,
    totalROI,
    vaultPositions,
    isLoading,
    error,
  } = useDashboardData();

  const handlePositionClick = (vaultAddress: string) => {
    // Navigate to vaults page with specific vault
    setLocation(`/?vault=${vaultAddress}`);
  };

  // If user is not connected, show connection prompt
  if (!isConnected) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">
            Dashboard
          </h1>
          <p className="text-arca-secondary text-sm sm:text-base">
            View your vault positions and earnings
          </p>
        </div>

        <div className="bg-arca-surface rounded-xl border border-arca-border p-8 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-semibold text-white mb-4">
              Connect Your Wallet
            </h3>
            <p className="text-arca-secondary mb-6">
              Connect your wallet to view your vault positions and track your
              earnings.
            </p>
            <button
              onClick={() => setLocation("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </main>
    );
  }

  const chartData = generateChartData(
    totalPortfolioValue,
    totalDeposited,
    totalEarnings,
  );
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Demo Mode Modal */}
      <DemoModeModal />

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">
          Dashboard
        </h1>
        <p className="text-arca-secondary text-sm sm:text-base">
          View your vault positions and earnings
        </p>
      </div>

      {/* Demo Data Warning Banner */}
      <DemoBanner />

      {/* Total Balance Overview */}
      <div className="bg-arca-surface rounded-xl border border-arca-border p-6 sm:p-8 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side - Balance Info */}
          <div>
            <div className="mb-6">
              <div className="text-arca-secondary text-sm mb-1">
                Total Balance
              </div>
              <DemoDataWrapper type="portfolio" className="inline-block">
                <div className="text-white font-bold text-4xl">
                  {isLoading
                    ? "Loading..."
                    : formatCurrency(totalPortfolioValue)}
                </div>
              </DemoDataWrapper>
              <InlineWarning type="portfolio" compact />

              {totalEarnings > 0 && (
                <div className="inline-flex items-center bg-arca-primary text-black px-2 py-1 rounded text-xs font-medium mt-2">
                  <span>+{formatCurrency(totalEarnings)}</span>
                </div>
              )}

              <div className="mt-3">
                <CoinGeckoAttributionFull />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-arca-secondary">Total Deposited:</span>
                <DemoDataWrapper type="portfolio" className="inline-block">
                  <span className="text-white font-medium text-lg">
                    {isLoading ? "..." : formatCurrency(totalDeposited)}
                  </span>
                </DemoDataWrapper>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-arca-secondary">Total Earnings:</span>
                <DemoDataWrapper type="portfolio" className="inline-block">
                  <span
                    className={`font-medium text-lg ${totalEarnings >= 0 ? "text-arca-primary" : "text-red-500"}`}
                  >
                    {totalEarnings >= 0 ? "+" : ""}
                    {isLoading ? "..." : formatCurrency(totalEarnings)}
                  </span>
                </DemoDataWrapper>
              </div>

              {/* Additional Stats under Total Earnings */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-arca-border">
                <div>
                  <div className="text-arca-secondary text-sm mb-1">
                    Active Vaults
                  </div>
                  <div className="text-white font-bold text-xl">
                    {isLoading ? "..." : vaultPositions.length}
                  </div>
                </div>
                <div>
                  <div className="text-arca-secondary text-sm mb-1">
                    Total Unclaimed Rewards
                  </div>
                  <div className="text-white font-bold text-xl">
                    {isLoading ? "..." : "$0.00"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Chart */}
          <div>
            <div className="mb-4">
              <h3 className="text-white font-semibold mb-2">
                Total Balance (Deposits + Earnings)
              </h3>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                  <span className="text-arca-secondary">Deposits</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-arca-secondary">Earnings</span>
                </div>
              </div>
            </div>
            <div className="h-80 bg-arca-bg rounded-lg border border-arca-border p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#888", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#888", fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="deposits"
                    stroke="#ffffff"
                    strokeWidth={2}
                    dot={{ fill: "#ffffff", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#ffffff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#ef4444" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Active Positions */}
      <div className="bg-arca-surface rounded-xl border border-arca-border p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white mb-6">
          Active Positions
        </h2>

        {isLoading ? (
          // Loading state
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-arca-primary mx-auto mb-4"></div>
            <p className="text-arca-secondary">Loading your positions...</p>
          </div>
        ) : error ? (
          // Error state
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">
              Error loading positions: {error}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        ) : vaultPositions.length === 0 ? (
          // No positions state
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-arca-bg rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-arca-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No Active Positions
              </h3>
              <p className="text-arca-secondary mb-6">
                You haven't deposited into any vaults yet. Start earning yield
                by depositing into our automated liquidity pools.
              </p>
              <button
                onClick={() => setLocation("/")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                View Available Vaults
              </button>
            </div>
          </div>
        ) : (
          // Show actual positions
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vaultPositions.map((position) => {
              // Generate token initials for display
              const tokenXInitial = position.tokenX.symbol
                .charAt(0)
                .toUpperCase();
              const tokenYInitial = position.tokenY.symbol
                .charAt(0)
                .toUpperCase();

              // Color mapping for tokens
              const getTokenColor = (symbol: string) => {
                const colors: Record<string, string> = {
                  wS: "bg-purple-600",
                  USDC: "bg-green-600",
                  "USDC.e": "bg-green-600",
                  METRO: "bg-orange-600",
                  ETH: "bg-blue-600",
                  BTC: "bg-orange-500",
                };
                return colors[symbol] || "bg-gray-600";
              };

              // Calculate individual earnings (for now, we don't have per-vault earnings)
              const positionEarnings = 0; // TODO: Add per-vault earnings calculation

              return (
                <div
                  key={position.vaultAddress}
                  className="bg-arca-bg rounded-lg border border-arca-border p-4 cursor-pointer position-card-glow transition-all duration-300 hover:scale-[1.02]"
                  onClick={() => handlePositionClick(position.vaultAddress)}
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <div
                      className={`w-8 h-8 ${getTokenColor(position.tokenX.symbol)} rounded-full flex items-center justify-center`}
                    >
                      <span className="text-white text-xs font-bold">
                        {tokenXInitial}
                      </span>
                    </div>
                    <div
                      className={`w-8 h-8 ${getTokenColor(position.tokenY.symbol)} rounded-full flex items-center justify-center -ml-2`}
                    >
                      <span className="text-white text-xs font-bold">
                        {tokenYInitial}
                      </span>
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {position.vaultName}
                      </div>
                      <div className="text-arca-secondary text-xs">DLMM</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-arca-secondary text-sm">
                        Position Value:
                      </span>
                      <DemoDataWrapper
                        type="portfolio"
                        className="inline-block"
                      >
                        <span className="text-white text-sm">
                          {formatCurrency(position.value)}
                        </span>
                      </DemoDataWrapper>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-arca-secondary text-sm">
                        Earnings:
                      </span>
                      <DemoDataWrapper
                        type="portfolio"
                        className="inline-block"
                      >
                        <span className="arca-primary text-sm">
                          +{formatCurrency(positionEarnings)}
                        </span>
                      </DemoDataWrapper>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-arca-secondary text-sm">APY:</span>
                      <DemoDataWrapper type="apr" className="inline-block">
                        <span className="arca-primary text-sm font-medium">
                          {position.apy
                            ? `${position.apy.toFixed(1)}%`
                            : "0.0%"}
                        </span>
                      </DemoDataWrapper>
                    </div>

                    {/* Show share breakdown */}
                    <div className="pt-2 border-t border-arca-border/50">
                      <div className="flex justify-between text-xs">
                        <span className="text-arca-secondary">
                          {position.tokenX.symbol} Shares:
                        </span>
                        <span className="text-arca-secondary">
                          {parseFloat(position.tokenX.shares).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-arca-secondary">
                          {position.tokenY.symbol} Shares:
                        </span>
                        <span className="text-arca-secondary">
                          {parseFloat(position.tokenY.shares).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
