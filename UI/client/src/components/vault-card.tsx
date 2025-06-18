import type { Vault } from "../types/vault";
import TokenPairIcons from "./token-pair-icons";
import { useState } from "react";

interface VaultCardProps {
  vault: Vault;
  onClick?: () => void;
}

export default function VaultCard({ vault, onClick }: VaultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
    if (onClick) onClick();
  };

  return (
    <>
      {/* Desktop Layout */}
      <div
        className={`hidden sm:block mx-4 mb-4 ${isExpanded ? "vault-card-glow" : ""}`}
      >
        <div
          className={`grid grid-cols-5 gap-6 px-6 py-6 bg-arca-surface border border-arca-border transition-all duration-300 cursor-pointer ${
            isExpanded ? "rounded-t-xl" : "rounded-xl vault-card-glow"
          }`}
          onClick={handleCardClick}
        >
          {/* Pool */}
          <div className="flex items-center space-x-3">
            <TokenPairIcons tokens={vault.tokens} />
            <div>
              <div className="text-white font-semibold">{vault.name}</div>
              <div className="text-arca-secondary text-sm">
                {vault.platform}
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div className="flex items-center">
            <span className="text-white font-medium">{vault.earnings}</span>
          </div>

          {/* Pool TVL */}
          <div className="flex items-center">
            <span className="text-white font-medium">
              {formatCurrency(vault.poolTvl)}
            </span>
          </div>

          {/* Farm TVL */}
          <div className="flex items-center">
            <span className="text-white font-medium">
              {formatCurrency(vault.farmTvl)}
            </span>
          </div>

          {/* Rewards */}
          <div className="flex items-center">
            <div>
              <div className="arca-primary font-bold text-lg">{vault.apr}%</div>
              <div className="text-arca-secondary text-sm">
                ({vault.aprDaily}% daily)
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="bg-arca-surface border border-arca-border border-t-0 rounded-b-xl px-6 py-6 -mt-1">
            <div className="grid grid-cols-2 gap-8">
              {/* Left Side - Earnings */}
              <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-arca-secondary text-sm">
                    Metro Earned
                  </div>
                  <div className="text-arca-secondary text-sm">arca Earned</div>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <div className="text-white font-medium">0.00</div>
                  <div className="text-white font-medium">0.00</div>
                </div>
                <button className="w-full bg-arca-primary text-black py-2 rounded-lg font-medium hover:bg-green-400 transition-colors">
                  HARVEST
                </button>
              </div>

              {/* Right Side - Deposit/Withdraw */}
              <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex">
                    <button
                      className={`px-4 py-1 rounded-l-lg font-medium text-sm transition-colors ${
                        activeTab === "deposit"
                          ? "bg-blue-600 text-white"
                          : "bg-arca-border text-white hover:bg-blue-600"
                      }`}
                      onClick={() => setActiveTab("deposit")}
                    >
                      Deposit
                    </button>
                    <button
                      className={`px-4 py-1 rounded-r-lg font-medium text-sm transition-colors ${
                        activeTab === "withdraw"
                          ? "bg-blue-600 text-white"
                          : "bg-arca-border text-white hover:bg-blue-600"
                      }`}
                      onClick={() => setActiveTab("withdraw")}
                    >
                      Withdraw
                    </button>
                  </div>

                  <button className="bg-arca-primary text-black px-4 py-1 rounded-lg font-medium text-sm hover:bg-green-400 transition-colors">
                    Provide Liquidity
                  </button>
                </div>

                {/* Token Input Fields */}
                <div className="space-y-4">
                  {vault.tokens.map((token, index) => (
                    <div key={token} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-arca-secondary text-sm">
                          {token} to{" "}
                          {activeTab === "deposit" ? "Add" : "Remove"}
                        </span>
                        <span className="text-arca-secondary text-sm">
                          Balance: 0.00000
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {token.charAt(0)}
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder="0.0"
                          className="flex-1 bg-transparent text-white text-lg font-medium border-none outline-none"
                        />
                        <div className="text-right">
                          <button className="text-blue-400 text-xs hover:text-blue-300 transition-colors block">
                            50%
                          </button>
                          <button className="text-blue-400 text-xs hover:text-blue-300 transition-colors block">
                            MAX
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Layout */}
      <div
        className={`sm:hidden mx-4 mb-4 ${isExpanded ? "vault-card-glow" : ""}`}
      >
        <div
          className={`px-4 py-4 bg-arca-surface border border-arca-border transition-all duration-300 cursor-pointer ${
            isExpanded ? "rounded-t-xl" : "rounded-xl vault-card-glow"
          }`}
          onClick={handleCardClick}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <TokenPairIcons tokens={vault.tokens} />
              <div>
                <div className="text-white font-semibold">{vault.name}</div>
                <div className="text-arca-secondary text-sm">
                  {vault.platform}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="arca-primary font-bold text-lg">{vault.apr}%</div>
              <div className="text-arca-secondary text-xs">
                ({vault.aprDaily}% daily)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-arca-secondary text-xs">POOL TVL</div>
              <div className="text-white font-medium">
                {formatCurrency(vault.poolTvl)}
              </div>
            </div>
            <div>
              <div className="text-arca-secondary text-xs">FARM TVL</div>
              <div className="text-white font-medium">
                {formatCurrency(vault.farmTvl)}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Expanded Details */}
        {isExpanded && (
          <div className="bg-arca-surface border border-arca-border border-t-0 rounded-b-xl px-4 py-4 -mt-1">
            <div className="space-y-4">
              {/* Earnings Section */}
              <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-arca-secondary text-xs">
                    Metro Earned
                  </div>
                  <div className="text-arca-secondary text-xs">arca Earned</div>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-white font-medium text-sm">0.00</div>
                  <div className="text-white font-medium text-sm">0.00</div>
                </div>
                <button className="w-full bg-arca-primary text-black py-2 rounded-lg font-medium hover:bg-green-400 transition-colors text-sm">
                  HARVEST
                </button>
              </div>

              {/* Mobile Deposit/Withdraw */}
              <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex">
                    <button
                      className={`px-3 py-1 rounded-l-lg font-medium text-xs transition-colors ${
                        activeTab === "deposit"
                          ? "bg-blue-600 text-white"
                          : "bg-arca-border text-white hover:bg-blue-600"
                      }`}
                      onClick={() => setActiveTab("deposit")}
                    >
                      Deposit
                    </button>
                    <button
                      className={`px-3 py-1 rounded-r-lg font-medium text-xs transition-colors ${
                        activeTab === "withdraw"
                          ? "bg-blue-600 text-white"
                          : "bg-arca-border text-white hover:bg-blue-600"
                      }`}
                      onClick={() => setActiveTab("withdraw")}
                    >
                      Withdraw
                    </button>
                  </div>

                  <button className="bg-arca-primary text-black px-3 py-1 rounded-lg font-medium text-xs hover:bg-green-400 transition-colors">
                    Provide Liquidity
                  </button>
                </div>

                {/* Token Input Fields */}
                <div className="space-y-3">
                  {vault.tokens.map((token, index) => (
                    <div key={token} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-arca-secondary text-xs">
                          {token} to{" "}
                          {activeTab === "deposit" ? "Add" : "Remove"}
                        </span>
                        <span className="text-arca-secondary text-xs">
                          Balance: 0.00000
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {token.charAt(0)}
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder="0.0"
                          className="flex-1 bg-transparent text-white text-sm font-medium border-none outline-none"
                        />
                        <div className="text-right">
                          <button className="text-blue-400 text-xs hover:text-blue-300 transition-colors block">
                            50%
                          </button>
                          <button className="text-blue-400 text-xs hover:text-blue-300 transition-colors block">
                            MAX
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
