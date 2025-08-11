import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useLocation } from "wouter";
import { useUserPositions } from "../hooks/use-user-positions";
import TokenPairIcons from "../components/token-pair-icons";
import PositionRangeIndicator from "../components/position-range-indicator";

const chartData = [
  { name: "Jan", deposits: 1000, earnings: 50 },
  { name: "Feb", deposits: 1200, earnings: 120 },
  { name: "Mar", deposits: 1100, earnings: 180 },
  { name: "Apr", deposits: 1400, earnings: 220 },
  { name: "May", deposits: 1600, earnings: 280 },
  { name: "Jun", deposits: 1800, earnings: 340 },
  { name: "Jul", deposits: 1850, earnings: 350 },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const {
    activePositions,
    totalDeposited,
    totalEarnings,
    totalBalance,
    isLoading,
  } = useUserPositions();

  const handlePositionClick = (vaultName: string) => {
    // Navigate to vaults page - the vault card will auto-expand when clicked
    setLocation("/");
  };

  const formatCurrency = (amount: number) => {
    // Show more precision for very small amounts
    if (amount > 0 && amount < 0.01) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 4,
        maximumFractionDigits: 6,
      }).format(amount);
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

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

      {/* Total Balance Overview */}
      <div className="bg-arca-surface rounded-xl border border-arca-border p-6 sm:p-8 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side - Balance Info */}
          <div>
            <div className="mb-6">
              <div className="text-arca-secondary text-sm mb-1">
                Total Balance
              </div>
              <div className="text-white font-bold text-4xl">
                {isLoading ? "Loading..." : formatCurrency(totalBalance)}
              </div>

              {totalEarnings > 0 && (
                <div className="inline-flex items-center bg-arca-primary text-black px-2 py-1 rounded text-xs font-medium mt-2">
                  <span>+{formatCurrency(totalEarnings)}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-arca-secondary">Total Deposited:</span>
                <span className="text-white font-medium text-lg">
                  {isLoading ? "Loading..." : formatCurrency(totalDeposited)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-arca-secondary">Total Earnings:</span>
                <span className="arca-primary font-medium text-lg">
                  {isLoading
                    ? "Loading..."
                    : `+${formatCurrency(totalEarnings)}`}
                </span>
              </div>

              {/* Additional Stats under Total Earnings */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-arca-border">
                <div>
                  <div className="text-arca-secondary text-sm mb-1">
                    Provided Liquidity
                  </div>
                  <div className="text-white font-bold text-xl">
                    {isLoading ? "Loading..." : formatCurrency(totalDeposited)}
                  </div>
                </div>
                <div>
                  <div className="text-arca-secondary text-sm mb-1">
                    Total Unclaimed Rewards
                  </div>
                  <div className="text-white font-bold text-xl">
                    {formatCurrency(0)}
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

      {/* Metro Position Range Card */}
      <div className="bg-arca-surface rounded-xl border border-arca-border p-6 sm:p-8 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Metro Position Status
        </h2>
        <div className="bg-arca-bg rounded-lg border border-arca-border p-4">
          <div className="flex items-center space-x-3 mb-4">
            <TokenPairIcons tokens={["S", "USDC"]} />
            <div>
              <div className="text-white font-medium">S/USDC Metropolis</div>
              <div className="text-arca-secondary text-sm">
                Concentrated Liquidity Position
              </div>
            </div>
          </div>
          <PositionRangeIndicator vaultName="S/USDC" />
        </div>
      </div>

      {/* Active Positions */}
      <div className="bg-arca-surface rounded-xl border border-arca-border p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white mb-6">
          Active Positions
        </h2>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-arca-secondary">Loading positions...</div>
          </div>
        ) : activePositions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePositions.map((position, index) => (
              <div
                key={`${position.vaultName}-${index}`}
                className="bg-arca-bg rounded-lg border border-arca-border p-4 cursor-pointer position-card-glow transition-all duration-300 hover:scale-[1.02]"
                onClick={() => handlePositionClick(position.vaultName)}
              >
                <div className="flex items-center space-x-2 mb-3">
                  <TokenPairIcons tokens={position.tokens} />
                  <div>
                    <div className="text-white font-medium">
                      {position.vaultName}
                    </div>
                    <div className="text-arca-secondary text-xs">
                      {position.platform}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {/* Show position range for Metro vaults */}
                  {position.platform === "Metropolis" &&
                    position.vaultName.includes("S/USDC") &&
                    !position.vaultName.includes("CL") && (
                      <div className="mb-2">
                        <PositionRangeIndicator
                          vaultName={position.vaultName}
                        />
                      </div>
                    )}
                  <div className="flex justify-between">
                    <span className="text-arca-secondary text-sm">
                      Deposited:
                    </span>
                    <span className="text-white text-sm">
                      {formatCurrency(position.deposited)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-arca-secondary text-sm">
                      Current Value:
                    </span>
                    <span className="text-white text-sm">
                      {formatCurrency(position.currentValue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-arca-secondary text-sm">
                      Earnings:
                    </span>
                    <span
                      className={`text-sm ${position.earnings >= 0 ? "arca-primary" : "text-red-400"}`}
                    >
                      {position.earnings >= 0 ? "+" : ""}
                      {formatCurrency(position.earnings)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-arca-secondary text-sm">APR:</span>
                    <span className="arca-primary text-sm font-medium">
                      {position.apr}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-arca-secondary">No active positions found</div>
            <div className="text-arca-secondary text-sm">
              Start by depositing into a vault to see your positions here
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
