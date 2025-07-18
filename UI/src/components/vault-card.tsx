import type { RealVault } from "../types/vault";
import TokenPairIcons from "./token-pair-icons";
import { useState, useEffect, useMemo } from "react";
import { useVault } from "../hooks/use-vault";
import { ErrorDisplay } from "./web3-error-boundary";
import { TransactionModal } from "./transaction-modal";
import {
  TransactionProgress,
  type TransactionStatus,
} from "./transaction-progress";
import { useVaultTransactionHistory } from "../hooks/use-vault-transaction-history";
import { useAccount } from "wagmi";
import { DemoDataWrapper, InlineWarning } from "./demo-warnings";
import { CoinGeckoAttributionMinimal } from "./coingecko-attribution";
import { formatTokenDisplay } from "../lib/utils";

interface VaultCardProps {
  vault: RealVault;
  onClick?: () => void;
}

export default function VaultCard({ vault, onClick }: VaultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  // Token-agnostic deposit amounts (index-based)
  const [depositAmountX, setDepositAmountX] = useState(""); // First token
  const [depositAmountY, setDepositAmountY] = useState(""); // Second token
  const [withdrawSharesX, setWithdrawSharesX] = useState("");
  const [withdrawSharesY, setWithdrawSharesY] = useState("");

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{
    type: "deposit" | "withdraw" | "approve";
    tokenIndex: number; // 0 for tokenX, 1 for tokenY
    tokenSymbol: string; // Dynamic token symbol
    amount: string;
  } | null>(null);
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>("idle");
  const [currentTxHash, setCurrentTxHash] = useState<string>("");

  // Use multi-vault hook with vault address
  const {
    vaultConfig,
    tokenXSymbol,
    tokenYSymbol,
    userBalanceX,
    userBalanceY,
    userSharesX,
    userSharesY,
    depositTokenX,
    depositTokenY,
    withdrawShares,
    approveTokenX,
    approveTokenY,
    hasAllowance,
    validateBalance,
    validateConnection,
    isWritePending,
    isConfirming,
    lastOperation,
    hash,
    error, // TDD: Get error from useVault hook
    setError, // TDD: Get setError from useVault hook
    clearError, // TDD: Get clearError from useVault hook
    pendingDeposits, // Get actual queue data from useVault
    pendingWithdraws, // Get actual queue data from useVault
  } = useVault(vault.contractAddress);

  // Share validation - ensure user has enough shares to withdraw
  const validateShares = (sharesX: string, sharesY: string) => {
    // Check if at least one share amount is provided
    if (!sharesX && !sharesY) return false;

    // Parse share amounts
    const shareXAmount = parseFloat(sharesX || "0");
    const shareYAmount = parseFloat(sharesY || "0");

    // Check if both are zero
    if (shareXAmount === 0 && shareYAmount === 0) return false;

    // Validate against user's available shares
    const availableSharesX = parseFloat(userSharesX || "0");
    const availableSharesY = parseFloat(userSharesY || "0");

    // Check if user has enough shares
    if (shareXAmount > availableSharesX) return false;
    if (shareYAmount > availableSharesY) return false;

    return true;
  };

  const { address: userAddress, chainId } = useAccount();

  // Memoize the transaction history context to prevent re-renders
  const transactionHistoryContext = useMemo(
    () => ({
      vaultAddress: vault.contractAddress,
      tokenXSymbol: vault.tokens[0], // Dynamic: "wS", "METRO", "BTC", etc.
      tokenYSymbol: vault.tokens[1], // Dynamic: "USDC.e", "ETH", "USDT", etc.
      chainId: chainId || 31337,
      userAddress: userAddress || "0x0000000000000000000000000000000000000000",
    }),
    [vault.contractAddress, vault.tokens, chainId, userAddress],
  );

  // Vault-scoped transaction history with proper token context
  const { addTransaction, updateTransactionStatus } =
    useVaultTransactionHistory(transactionHistoryContext);

  // Memoize pendingTransaction to prevent infinite loops
  const memoizedPendingTransaction = useMemo(
    () => pendingTransaction,
    [
      pendingTransaction?.type,
      pendingTransaction?.tokenIndex,
      pendingTransaction?.tokenSymbol,
      pendingTransaction?.amount,
    ],
  );

  // Track transaction status changes
  useEffect(() => {
    if (hash && !currentTxHash) {
      setCurrentTxHash(hash);
      setTransactionStatus("pending");
      setShowProgressModal(true);

      // Add transaction to history
      if (memoizedPendingTransaction) {
        addTransaction(
          hash,
          memoizedPendingTransaction.type,
          memoizedPendingTransaction.tokenSymbol, // Now uses actual token symbol (no type casting needed!)
          memoizedPendingTransaction.amount,
        );
      }
    }
  }, [hash, currentTxHash, addTransaction, memoizedPendingTransaction]);

  useEffect(() => {
    if (currentTxHash) {
      if (isWritePending) {
        setTransactionStatus("pending");
      } else if (isConfirming) {
        setTransactionStatus("confirming");
        updateTransactionStatus(currentTxHash, "confirming");
      } else if (hash && !isWritePending && !isConfirming) {
        // Transaction completed
        const status = error ? "failed" : "success";
        setTransactionStatus(status);
        updateTransactionStatus(
          currentTxHash,
          status,
          error ? { error } : undefined,
        );
      }
    }
  }, [
    isWritePending,
    isConfirming,
    hash,
    error,
    currentTxHash,
    updateTransactionStatus,
  ]);

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) {
      return "$--";
    }
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

  // Helper function to get the correct balance label and value
  const getBalanceDisplay = (
    tokenIndex: number,
    mode: "deposit" | "withdraw",
  ) => {
    if (mode === "deposit") {
      const balance =
        tokenIndex === 0 ? vault.userBalanceX : vault.userBalanceY;
      return {
        label: "Balance",
        value: formatTokenDisplay(balance, 2),
      };
    } else {
      const shares = tokenIndex === 0 ? vault.userSharesX : vault.userSharesY;
      return {
        label: "Shares",
        value: shares,
      };
    }
  };

  // Helper function to get the correct amount for 50% or MAX buttons
  const getAmountForButton = (
    tokenIndex: number,
    mode: "deposit" | "withdraw",
    percentage: number,
  ) => {
    if (mode === "deposit") {
      const balance =
        tokenIndex === 0 ? vault.userBalanceX : vault.userBalanceY;
      return percentage === 100
        ? balance
        : ((parseFloat(balance) * percentage) / 100).toString();
    } else {
      const shares = tokenIndex === 0 ? vault.userSharesX : vault.userSharesY;
      return percentage === 100
        ? shares
        : ((parseFloat(shares) * percentage) / 100).toString();
    }
  };

  // Token-agnostic deposit handler using tokenIndex
  const handleDeposit = async (tokenIndex: number) => {
    const amount = tokenIndex === 0 ? depositAmountX : depositAmountY;
    const tokenSymbol = tokenIndex === 0 ? tokenXSymbol : tokenYSymbol;
    console.log("[handleDeposit] Called with:", {
      tokenIndex,
      amount,
      tokenSymbol,
    });

    if (!amount) {
      console.log("[handleDeposit] No amount, returning");
      return;
    }

    // Validate connection
    if (!validateConnection()) {
      console.log("[handleDeposit] Connection validation failed");
      setError("Please connect your wallet to continue");
      return;
    }

    // Check if approval is needed
    console.log("[handleDeposit] Checking allowance...");
    const hasEnoughAllowance = hasAllowance(tokenIndex, amount);
    console.log("[handleDeposit] Has allowance:", hasEnoughAllowance);

    if (!hasEnoughAllowance) {
      // For approval, we don't need to validate balance
      // Show approval confirmation
      console.log("[handleDeposit] Setting up approval transaction");
      setPendingTransaction({
        type: "approve",
        tokenIndex,
        tokenSymbol,
        amount,
      });
      setShowConfirmModal(true);
      return;
    }

    // Only validate balance for actual deposits (not approvals)
    if (!validateBalance(tokenIndex, amount)) {
      console.log("[handleDeposit] Balance validation failed");
      console.error(
        `Insufficient ${tokenSymbol} balance. You need ${amount} ${tokenSymbol} to deposit.`,
      );
      return;
    }

    // Show deposit confirmation (better UX with confirmation modal)
    setPendingTransaction({ type: "deposit", tokenIndex, tokenSymbol, amount });
    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (!pendingTransaction) return;

    setShowConfirmModal(false);

    try {
      const { type, tokenIndex, amount } = pendingTransaction;

      if (type === "approve") {
        if (tokenIndex === 0) {
          await approveTokenX(amount);
        } else {
          await approveTokenY(amount);
        }
      } else if (type === "deposit") {
        if (tokenIndex === 0) {
          await depositTokenX(amount);
          setDepositAmountX(""); // Clear input on success
        } else {
          await depositTokenY(amount);
          setDepositAmountY(""); // Clear input on success
        }
      } else if (type === "withdraw") {
        await withdrawShares(withdrawSharesX || "0", withdrawSharesY || "0");
        setWithdrawSharesX("");
        setWithdrawSharesY("");
      }
    } catch (err) {
      // Error is already handled by the hook
      // eslint-disable-next-line no-console
      console.error("Transaction failed:", err);
      setTransactionStatus("failed");
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawSharesX && !withdrawSharesY) return;

    // Validate connection and shares
    if (!validateConnection()) return;
    if (!validateShares(withdrawSharesX, withdrawSharesY)) return;

    // Show withdraw confirmation
    const totalShares = (
      parseFloat(withdrawSharesX || "0") + parseFloat(withdrawSharesY || "0")
    ).toString();
    setPendingTransaction({
      type: "withdraw",
      tokenIndex: 0,
      tokenSymbol: tokenXSymbol,
      amount: totalShares,
    });
    setShowConfirmModal(true);
  };

  const handleCloseModals = () => {
    setShowConfirmModal(false);
    setShowProgressModal(false);
    setPendingTransaction(null);
    setCurrentTxHash("");
    setTransactionStatus("idle");
  };

  const handleRetryTransaction = () => {
    if (pendingTransaction) {
      setShowProgressModal(false);
      setShowConfirmModal(true);
      setTransactionStatus("idle");
      setCurrentTxHash("");
    }
  };

  // Check if token needs approval
  const needsApproval = (tokenIndex: number) => {
    const amount = tokenIndex === 0 ? depositAmountX : depositAmountY;
    if (!amount || parseFloat(amount) === 0) return false;
    return !hasAllowance(tokenIndex, amount);
  };

  // Token-agnostic button text function
  const getButtonText = (tokenIndex: number) => {
    if (isWritePending && lastOperation === "deposit") return "Pending...";
    if (isConfirming && lastOperation === "deposit") return "Confirming...";

    const amount = tokenIndex === 0 ? depositAmountX : depositAmountY;
    const tokenSymbol = tokenIndex === 0 ? tokenXSymbol : tokenYSymbol;

    if (!amount) return `Enter ${tokenSymbol} Amount`;

    // Always show "Deposit" as the main action
    return `Deposit ${tokenSymbol}`;
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

          {/* User Balance */}
          <div className="flex items-center">
            {vault.metricsLoading ? (
              <div className="h-5 w-20 bg-arca-border rounded animate-pulse"></div>
            ) : vault.metricsError ? (
              <span className="text-arca-secondary text-sm">
                Price unavailable
              </span>
            ) : (
              <span className="text-white font-medium">
                {formatCurrency(vault.userBalance)}
              </span>
            )}
          </div>

          {/* Total TVL */}
          <div className="flex flex-col">
            {vault.metricsLoading ? (
              <div className="h-5 w-24 bg-arca-border rounded animate-pulse"></div>
            ) : vault.metricsError ? (
              <span className="text-arca-secondary text-sm">
                Price unavailable
              </span>
            ) : (
              <>
                <DemoDataWrapper type="portfolio" className="inline-block">
                  <span className="text-white font-medium">
                    {formatCurrency(vault.totalTvl)}
                  </span>
                </DemoDataWrapper>
                <CoinGeckoAttributionMinimal className="mt-1" />
              </>
            )}
          </div>

          {/* Queue Status */}
          <div className="flex items-center">
            <span className="text-white font-medium">
              {pendingDeposits || "0"}D / {pendingWithdraws || "0"}W
            </span>
          </div>

          {/* Rewards */}
          <div className="flex items-center">
            <div>
              {vault.metricsLoading ? (
                <div>
                  <div className="h-6 w-16 bg-arca-border rounded animate-pulse mb-1"></div>
                  <div className="h-4 w-20 bg-arca-border rounded animate-pulse"></div>
                </div>
              ) : vault.metricsError ? (
                <div>
                  <div className="text-arca-secondary text-sm">
                    Price unavailable
                  </div>
                  <div className="text-arca-secondary text-xs">
                    (APR requires price data)
                  </div>
                </div>
              ) : vault.apr !== undefined ? (
                <>
                  <DemoDataWrapper type="apr" className="inline-block">
                    <div className="arca-primary font-bold text-lg">
                      {vault.apr.toFixed(2)}%
                    </div>
                  </DemoDataWrapper>
                  <div className="text-arca-secondary text-sm">
                    <DemoDataWrapper type="apr" className="inline-block">
                      ({vault.aprDaily?.toFixed(3) || "--"}% daily)
                    </DemoDataWrapper>
                  </div>
                  <InlineWarning type="apr" compact />
                </>
              ) : (
                <div className="text-arca-secondary">--</div>
              )}
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="bg-arca-surface border border-arca-border border-t-0 rounded-b-xl px-6 py-6 -mt-1">
            {/* Error Display - Only show when expanded */}
            {error && (
              <ErrorDisplay
                error={error}
                onDismiss={clearError}
                className="mb-4"
              />
            )}

            <div className="grid grid-cols-2 gap-8">
              {/* Left Side - Earnings */}
              <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-arca-secondary text-sm">
                    {tokenXSymbol} Shares
                  </div>
                  <div className="text-arca-secondary text-sm">
                    {tokenYSymbol} Shares
                  </div>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <div className="text-white font-medium">
                    {vault.userSharesX}
                  </div>
                  <div className="text-white font-medium">
                    {vault.userSharesY}
                  </div>
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
                  {vault.tokens.map((token, tokenIndex) => (
                    <div key={token} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-arca-secondary text-sm">
                          {token} to{" "}
                          {activeTab === "deposit" ? "Add" : "Remove"}
                        </span>
                        <span className="text-arca-secondary text-sm">
                          {getBalanceDisplay(tokenIndex, activeTab).label}:{" "}
                          {getBalanceDisplay(tokenIndex, activeTab).value}
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
                          value={
                            activeTab === "deposit"
                              ? tokenIndex === 0
                                ? depositAmountX
                                : depositAmountY
                              : tokenIndex === 0
                                ? withdrawSharesX
                                : withdrawSharesY
                          }
                          onChange={(e) => {
                            if (activeTab === "deposit") {
                              if (tokenIndex === 0) {
                                setDepositAmountX(e.target.value);
                              } else {
                                setDepositAmountY(e.target.value);
                              }
                            } else {
                              if (tokenIndex === 0) {
                                setWithdrawSharesX(e.target.value);
                              } else {
                                setWithdrawSharesY(e.target.value);
                              }
                            }
                          }}
                          className="flex-1 bg-transparent text-white text-lg font-medium border-none outline-none"
                        />
                        <div className="text-right">
                          <button
                            onClick={() => {
                              const amount = getAmountForButton(
                                tokenIndex,
                                activeTab,
                                50,
                              );
                              if (activeTab === "deposit") {
                                if (tokenIndex === 0) {
                                  setDepositAmountX(amount);
                                } else {
                                  setDepositAmountY(amount);
                                }
                              } else {
                                if (tokenIndex === 0) {
                                  setWithdrawSharesX(amount);
                                } else {
                                  setWithdrawSharesY(amount);
                                }
                              }
                            }}
                            className="text-blue-400 text-xs hover:text-blue-300 transition-colors block"
                          >
                            50%
                          </button>
                          <button
                            onClick={() => {
                              const amount = getAmountForButton(
                                tokenIndex,
                                activeTab,
                                100,
                              );
                              if (activeTab === "deposit") {
                                if (tokenIndex === 0) {
                                  setDepositAmountX(amount);
                                } else {
                                  setDepositAmountY(amount);
                                }
                              } else {
                                if (tokenIndex === 0) {
                                  setWithdrawSharesX(amount);
                                } else {
                                  setWithdrawSharesY(amount);
                                }
                              }
                            }}
                            className="text-blue-400 text-xs hover:text-blue-300 transition-colors block"
                          >
                            MAX
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Action Buttons */}
                  <div className="mt-4 space-y-2">
                    {activeTab === "deposit" && (
                      <>
                        {/* Token X Deposit */}
                        {depositAmountX && needsApproval(0) && (
                          <div className="text-xs text-yellow-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {tokenXSymbol} requires approval first
                          </div>
                        )}
                        <button
                          onClick={() => handleDeposit(0)}
                          disabled={!depositAmountX || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {getButtonText(0)}
                        </button>

                        {/* Token Y Deposit */}
                        {depositAmountY && needsApproval(1) && (
                          <div className="text-xs text-yellow-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {tokenYSymbol} requires approval first
                          </div>
                        )}
                        <button
                          onClick={() => handleDeposit(1)}
                          disabled={!depositAmountY || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {getButtonText(1)}
                        </button>
                      </>
                    )}

                    {activeTab === "withdraw" && (
                      <button
                        onClick={handleWithdraw}
                        disabled={
                          !validateShares(withdrawSharesX, withdrawSharesY) ||
                          isWritePending
                        }
                        className="w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isWritePending && lastOperation === "withdraw"
                          ? "Pending..."
                          : isConfirming && lastOperation === "withdraw"
                            ? "Confirming..."
                            : "Withdraw Shares"}
                      </button>
                    )}
                  </div>
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
              {vault.metricsLoading ? (
                <div>
                  <div className="h-5 w-12 bg-arca-border rounded animate-pulse mb-1 ml-auto"></div>
                  <div className="h-3 w-16 bg-arca-border rounded animate-pulse ml-auto"></div>
                </div>
              ) : vault.apr !== undefined ? (
                <>
                  <div className="arca-primary font-bold text-lg">
                    {vault.apr.toFixed(2)}%
                  </div>
                  <div className="text-arca-secondary text-xs">
                    ({vault.aprDaily?.toFixed(3) || "--"}% daily)
                  </div>
                </>
              ) : (
                <div className="text-arca-secondary">--</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-arca-secondary text-xs">TOTAL TVL</div>
              {vault.metricsLoading ? (
                <div className="h-5 w-20 bg-arca-border rounded animate-pulse mt-1"></div>
              ) : (
                <>
                  <div className="text-white font-medium">
                    {formatCurrency(vault.totalTvl)}
                  </div>
                  <CoinGeckoAttributionMinimal className="mt-1" />
                </>
              )}
            </div>
            <div>
              <div className="text-arca-secondary text-xs">QUEUE STATUS</div>
              <div className="text-white font-medium">
                {pendingDeposits || "0"}D / {pendingWithdraws || "0"}W
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Expanded Details */}
        {isExpanded && (
          <div className="bg-arca-surface border border-arca-border border-t-0 rounded-b-xl px-4 py-4 -mt-1">
            {/* Error Display */}
            {error && (
              <ErrorDisplay
                error={error}
                onDismiss={clearError}
                className="mb-4"
              />
            )}

            <div className="space-y-4">
              {/* Earnings Section */}
              <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-arca-secondary text-xs">
                    {tokenXSymbol} Shares
                  </div>
                  <div className="text-arca-secondary text-xs">
                    {tokenYSymbol} Shares
                  </div>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-white font-medium text-sm">
                    {vault.userSharesX}
                  </div>
                  <div className="text-white font-medium text-sm">
                    {vault.userSharesY}
                  </div>
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
                  {vault.tokens.map((token, tokenIndex) => (
                    <div key={token} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-arca-secondary text-xs">
                          {token} to{" "}
                          {activeTab === "deposit" ? "Add" : "Remove"}
                        </span>
                        <span className="text-arca-secondary text-xs">
                          {getBalanceDisplay(tokenIndex, activeTab).label}:{" "}
                          {getBalanceDisplay(tokenIndex, activeTab).value}
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
                          value={
                            activeTab === "deposit"
                              ? tokenIndex === 0
                                ? depositAmountX
                                : depositAmountY
                              : tokenIndex === 0
                                ? withdrawSharesX
                                : withdrawSharesY
                          }
                          onChange={(e) => {
                            if (activeTab === "deposit") {
                              if (tokenIndex === 0) {
                                setDepositAmountX(e.target.value);
                              } else {
                                setDepositAmountY(e.target.value);
                              }
                            } else {
                              if (tokenIndex === 0) {
                                setWithdrawSharesX(e.target.value);
                              } else {
                                setWithdrawSharesY(e.target.value);
                              }
                            }
                          }}
                          className="flex-1 bg-transparent text-white text-sm font-medium border-none outline-none"
                        />
                        <div className="text-right">
                          <button
                            onClick={() => {
                              const amount = getAmountForButton(
                                tokenIndex,
                                activeTab,
                                50,
                              );
                              if (activeTab === "deposit") {
                                if (tokenIndex === 0) {
                                  setDepositAmountX(amount);
                                } else {
                                  setDepositAmountY(amount);
                                }
                              } else {
                                if (tokenIndex === 0) {
                                  setWithdrawSharesX(amount);
                                } else {
                                  setWithdrawSharesY(amount);
                                }
                              }
                            }}
                            className="text-blue-400 text-xs hover:text-blue-300 transition-colors block"
                          >
                            50%
                          </button>
                          <button
                            onClick={() => {
                              const amount = getAmountForButton(
                                tokenIndex,
                                activeTab,
                                100,
                              );
                              if (activeTab === "deposit") {
                                if (tokenIndex === 0) {
                                  setDepositAmountX(amount);
                                } else {
                                  setDepositAmountY(amount);
                                }
                              } else {
                                if (tokenIndex === 0) {
                                  setWithdrawSharesX(amount);
                                } else {
                                  setWithdrawSharesY(amount);
                                }
                              }
                            }}
                            className="text-blue-400 text-xs hover:text-blue-300 transition-colors block"
                          >
                            MAX
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Mobile Action Buttons */}
                  <div className="mt-3 space-y-2">
                    {activeTab === "deposit" && (
                      <>
                        {/* Token X Deposit */}
                        {depositAmountX && needsApproval(0) && (
                          <div className="text-xs text-yellow-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {tokenXSymbol} requires approval first
                          </div>
                        )}
                        <button
                          onClick={() => handleDeposit(0)}
                          disabled={!depositAmountX || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {getButtonText(0)}
                        </button>

                        {/* Token Y Deposit */}
                        {depositAmountY && needsApproval(1) && (
                          <div className="text-xs text-yellow-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {tokenYSymbol} requires approval first
                          </div>
                        )}
                        <button
                          onClick={() => handleDeposit(1)}
                          disabled={!depositAmountY || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {getButtonText(1)}
                        </button>
                      </>
                    )}

                    {activeTab === "withdraw" && (
                      <button
                        onClick={handleWithdraw}
                        disabled={
                          !validateShares(withdrawSharesX, withdrawSharesY) ||
                          isWritePending
                        }
                        className="w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {isWritePending && lastOperation === "withdraw"
                          ? "Pending..."
                          : isConfirming && lastOperation === "withdraw"
                            ? "Confirming..."
                            : "Withdraw Shares"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modals */}
      {pendingTransaction && (
        <>
          <TransactionModal
            isOpen={showConfirmModal}
            onClose={handleCloseModals}
            onConfirm={handleConfirmTransaction}
            type={pendingTransaction.type}
            token={pendingTransaction.tokenSymbol}
            amount={pendingTransaction.amount}
            isLoading={false}
            userBalance={
              pendingTransaction.tokenIndex === 0
                ? vault.userBalanceX
                : vault.userBalanceY
            }
            vaultShare={
              pendingTransaction.tokenIndex === 0
                ? vault.pricePerShareX
                : vault.pricePerShareY
            }
          />

          <TransactionProgress
            isOpen={showProgressModal}
            onClose={handleCloseModals}
            status={transactionStatus}
            txHash={currentTxHash}
            type={pendingTransaction.type}
            token={pendingTransaction.tokenSymbol}
            amount={pendingTransaction.amount}
            error={error || undefined}
            onRetry={handleRetryTransaction}
          />
        </>
      )}
    </>
  );
}
