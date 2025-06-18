import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useLocation } from "wouter";

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

  const handlePositionClick = (vaultName: string) => {
    // Navigate to vaults page - the vault card will auto-expand when clicked
    setLocation("/");
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
              <div className="text-white font-bold text-4xl">$2,200.00</div>

              <div className="inline-flex items-center bg-arca-primary text-black px-2 py-1 rounded text-xs font-medium mt-2">
                <span>+$350.00</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-arca-secondary">Total Deposited:</span>
                <span className="text-white font-medium text-lg">
                  $1,850.00
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-arca-secondary">Total Earnings:</span>
                <span className="arca-primary font-medium text-lg">
                  +$350.00
                </span>
              </div>

              {/* Additional Stats under Total Earnings */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-arca-border">
                <div>
                  <div className="text-arca-secondary text-sm mb-1">
                    Provided Liquidity
                  </div>
                  <div className="text-white font-bold text-xl">$0.00</div>
                </div>
                <div>
                  <div className="text-arca-secondary text-sm mb-1">
                    Total Unclaimed Rewards
                  </div>
                  <div className="text-white font-bold text-xl">$0.00</div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Position Card 1 */}
          <div
            className="bg-arca-bg rounded-lg border border-arca-border p-4 cursor-pointer position-card-glow transition-all duration-300 hover:scale-[1.02]"
            onClick={() => handlePositionClick("ANON-USDC")}
          >
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">A</span>
              </div>
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center -ml-2">
                <span className="text-white text-xs font-bold">U</span>
              </div>
              <div>
                <div className="text-white font-medium">ANON-USDC</div>
                <div className="text-arca-secondary text-xs">DLMM</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-arca-secondary text-sm">Deposited:</span>
                <span className="text-white text-sm">$850.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-arca-secondary text-sm">Earnings:</span>
                <span className="arca-primary text-sm">+$156.30</span>
              </div>
              <div className="flex justify-between">
                <span className="text-arca-secondary text-sm">APR:</span>
                <span className="arca-primary text-sm font-medium">73.18%</span>
              </div>
            </div>
          </div>

          {/* Position Card 2 */}
          <div
            className="bg-arca-bg rounded-lg border border-arca-border p-4 cursor-pointer position-card-glow transition-all duration-300 hover:scale-[1.02]"
            onClick={() => handlePositionClick("S-ETH")}
          >
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center -ml-2">
                <span className="text-white text-xs font-bold">E</span>
              </div>
              <div>
                <div className="text-white font-medium">S-ETH</div>
                <div className="text-arca-secondary text-xs">Uniswap</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-arca-secondary text-sm">Deposited:</span>
                <span className="text-white text-sm">$650.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-arca-secondary text-sm">Earnings:</span>
                <span className="arca-primary text-sm">+$89.45</span>
              </div>
              <div className="flex justify-between">
                <span className="text-arca-secondary text-sm">APR:</span>
                <span className="arca-primary text-sm font-medium">42.5%</span>
              </div>
            </div>
          </div>

          {/* Position Card 3 */}
          <div
            className="bg-arca-bg rounded-lg border border-arca-border p-4 cursor-pointer position-card-glow transition-all duration-300 hover:scale-[1.02]"
            onClick={() => handlePositionClick("WBTC-USDC")}
          >
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">W</span>
              </div>
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center -ml-2">
                <span className="text-white text-xs font-bold">U</span>
              </div>
              <div>
                <div className="text-white font-medium">WBTC-USDC</div>
                <div className="text-arca-secondary text-xs">SushiSwap</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-arca-secondary text-sm">Deposited:</span>
                <span className="text-white text-sm">$350.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-arca-secondary text-sm">Earnings:</span>
                <span className="arca-primary text-sm">+$104.25</span>
              </div>
              <div className="flex justify-between">
                <span className="text-arca-secondary text-sm">APR:</span>
                <span className="arca-primary text-sm font-medium">89.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
