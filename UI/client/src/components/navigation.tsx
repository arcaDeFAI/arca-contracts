import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, useLocation } from "wouter";

export default function Navigation() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <nav className="bg-arca-bg border-b border-arca-border px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center space-x-2 cursor-pointer">
            <div className="w-8 h-8 bg-arca-primary rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-semibold text-white">arca</span>
          </div>
        </Link>

        {/* Navigation Tabs - Centered */}
        <div className="hidden sm:flex items-center space-x-6">
          <Link href="/">
            <button
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                isActive("/") || isActive("/vaults")
                  ? "bg-arca-primary text-black nav-button-glow"
                  : "text-arca-secondary hover:text-white"
              }`}
            >
              Vaults
            </button>
          </Link>
          <Link href="/staking">
            <button
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                isActive("/staking")
                  ? "bg-arca-primary text-black nav-button-glow"
                  : "text-arca-secondary hover:text-white"
              }`}
            >
              Staking
            </button>
          </Link>
          <Link href="/dashboard">
            <button
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                isActive("/dashboard")
                  ? "bg-arca-primary text-black nav-button-glow"
                  : "text-arca-secondary hover:text-white"
              }`}
            >
              Dashboard
            </button>
          </Link>
        </div>

        {/* Mobile Navigation */}
        <div className="sm:hidden flex items-center space-x-1">
          <Link href="/">
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                isActive("/") || isActive("/vaults")
                  ? "bg-arca-primary text-black nav-button-glow"
                  : "text-arca-secondary hover:text-white"
              }`}
            >
              Vaults
            </button>
          </Link>
          <Link href="/staking">
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                isActive("/staking")
                  ? "bg-arca-primary text-black nav-button-glow"
                  : "text-arca-secondary hover:text-white"
              }`}
            >
              Staking
            </button>
          </Link>
          <Link href="/dashboard">
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                isActive("/dashboard")
                  ? "bg-arca-primary text-black nav-button-glow"
                  : "text-arca-secondary hover:text-white"
              }`}
            >
              Dashboard
            </button>
          </Link>
        </div>

        {/* Wallet Connection */}
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            authenticationStatus,
            mounted,
          }) => {
            const ready = mounted && authenticationStatus !== "loading";
            const connected =
              ready &&
              account &&
              chain &&
              (!authenticationStatus ||
                authenticationStatus === "authenticated");

            return (
              <div
                {...(!ready && {
                  "aria-hidden": true,
                  style: {
                    opacity: 0,
                    pointerEvents: "none",
                    userSelect: "none",
                  },
                })}
              >
                {(() => {
                  if (!connected) {
                    return (
                      <button
                        onClick={openConnectModal}
                        className="bg-arca-primary text-black px-2 sm:px-6 py-1 sm:py-2 rounded-full font-medium hover:bg-green-400 transition-colors text-xs sm:text-base"
                      >
                        <span className="hidden sm:inline">Connect Wallet</span>
                        <span className="sm:hidden">Connect</span>
                      </button>
                    );
                  }

                  if (chain.unsupported) {
                    return (
                      <button
                        onClick={openChainModal}
                        className="bg-red-500 text-white px-2 sm:px-6 py-1 sm:py-2 rounded-full font-medium hover:bg-red-600 transition-colors text-xs sm:text-base"
                      >
                        <span className="hidden sm:inline">Wrong network</span>
                        <span className="sm:hidden">Wrong</span>
                      </button>
                    );
                  }

                  return (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={openChainModal}
                        className="hidden sm:flex bg-arca-surface border border-arca-border text-white px-4 py-2 rounded-lg font-medium hover:bg-arca-border transition-colors items-center"
                      >
                        {chain.hasIcon && (
                          <div className="w-6 h-6 mr-2 inline-block">
                            {chain.iconUrl && (
                              <img
                                alt={chain.name ?? "Chain icon"}
                                src={chain.iconUrl}
                                className="w-6 h-6"
                              />
                            )}
                          </div>
                        )}
                        {chain.name}
                      </button>

                      <button
                        onClick={openAccountModal}
                        className="bg-arca-primary text-black px-2 sm:px-6 py-1 sm:py-2 rounded-full font-medium hover:bg-green-400 transition-colors text-xs sm:text-base"
                      >
                        <span className="hidden sm:inline">
                          {account.displayName}
                          {account.displayBalance
                            ? ` (${account.displayBalance})`
                            : ""}
                        </span>
                        <span className="sm:hidden">
                          {account.displayName?.slice(0, 4)}...
                        </span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </nav>
  );
}
