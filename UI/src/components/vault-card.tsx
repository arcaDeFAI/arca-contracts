import type { RealVault } from "../types/vault";
import TokenPairIcons from "./token-pair-icons";
import { useState, useEffect } from "react";
import { useVault } from "../hooks/use-vault";
import { ErrorDisplay } from "./web3-error-boundary";
import { TransactionModal } from "./transaction-modal";
import {
  TransactionProgress,
  type TransactionStatus,
} from "./transaction-progress";
import { useTransactionHistory } from "../hooks/use-transaction-history";
import { DemoDataWrapper, InlineWarning } from "./demo-warnings";
import { CoinGeckoAttributionMinimal } from "./coingecko-attribution";

interface VaultCardProps {
  vault: RealVault;
  onClick?: () => void;
}

export default function VaultCard({ vault, onClick }: VaultCardProps) {
  // 🔍 DEBUG: Log vault prop received
  console.log("🔍 [VaultCard] Rendering with vault:", {
    id: vault.id,
    name: vault.name, 
    tokens: vault.tokens,
    platform: vault.platform,
    chain: vault.chain,
    totalTvl: vault.totalTvl,
    userBalance: vault.userBalance,
    apr: vault.apr,
    contractAddress: vault.contractAddress
  });

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
    clearError, // TDD: Get clearError from useVault hook
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

  const { addTransaction, updateTransactionStatus } = useTransactionHistory();

  // Track transaction status changes
  useEffect(() => {
    if (hash && !currentTxHash) {
      setCurrentTxHash(hash);
      setTransactionStatus("pending");
      setShowProgressModal(true);

      // Add transaction to history
      if (pendingTransaction) {
        addTransaction(
          hash,
          pendingTransaction.type,
          pendingTransaction.tokenSymbol,
          pendingTransaction.amount,
        );
      }
    }
  }, [hash, currentTxHash, addTransaction, pendingTransaction]);

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

  // Token-agnostic deposit handler using tokenIndex
  const handleDeposit = async (tokenIndex: number) => {
    const amount = tokenIndex === 0 ? depositAmountX : depositAmountY;
    const tokenSymbol = tokenIndex === 0 ? tokenXSymbol : tokenYSymbol;
    if (!amount) return;

    // Validate connection and balance
    if (!validateConnection()) return;
    if (!validateBalance(tokenIndex, amount)) return;

    // Check if approval is needed
    if (!hasAllowance(tokenIndex, amount)) {
      // Show approval confirmation
      setPendingTransaction({
        type: "approve",
        tokenIndex,
        tokenSymbol,
        amount,
      });
      setShowConfirmModal(true);
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

  // Token-agnostic button text function
  const getButtonText = (tokenIndex: number) => {
    if (isWritePending && lastOperation === "deposit") return "Pending...";
    if (isConfirming && lastOperation === "deposit") return "Confirming...";

    const amount = tokenIndex === 0 ? depositAmountX : depositAmountY;
    const tokenSymbol = tokenIndex === 0 ? tokenXSymbol : tokenYSymbol;

    if (!amount) return `Enter ${tokenSymbol} Amount`;

    if (!hasAllowance(tokenIndex, amount)) {
      return `Approve ${tokenSymbol}`;
    }

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
            <span className="text-white font-medium">
              {formatCurrency(vault.userBalance)}
            </span>
          </div>

          {/* Total TVL */}
          <div className="flex flex-col">
            <DemoDataWrapper type="portfolio" className="inline-block">
              <span className="text-white font-medium">
                {formatCurrency(vault.totalTvl)}
              </span>
            </DemoDataWrapper>
            <CoinGeckoAttributionMinimal className="mt-1" />
          </div>

          {/* Queue Status */}
          <div className="flex items-center">
            <span className="text-white font-medium">
              {vault.pendingDeposits}D / {vault.pendingWithdraws}W
            </span>
          </div>

          {/* Rewards */}
          <div className="flex items-center">
            <div>
              <DemoDataWrapper type="apr" className="inline-block">
                <div className="arca-primary font-bold text-lg">
                  {vault.apr}%
                </div>
              </DemoDataWrapper>
              <div className="text-arca-secondary text-sm">
                <DemoDataWrapper type="apr" className="inline-block">
                  ({vault.aprDaily}% daily)
                </DemoDataWrapper>
              </div>
              <InlineWarning type="apr" compact />
            </div>
          </div>
        </div>

        {/* Error Display (Always Visible for Better UX) */}
        {error && (
          <div className="mx-4 mt-2">
            <ErrorDisplay error={error} onDismiss={clearError} className="" />
          </div>
        )}

        {/* Expanded Details */}
        {isExpanded && (
          <div className="bg-arca-surface border border-arca-border border-t-0 rounded-b-xl px-6 py-6 -mt-1">
            {/* Error Display */}
            <ErrorDisplay
              error={error}
              onDismiss={clearError}
              className="mb-4"
            />

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
                          Balance:{" "}
                          {tokenIndex === 0
                            ? vault.userBalanceX
                            : vault.userBalanceY}
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

                  {/* Action Buttons */}
                  <div className="mt-4 space-y-2">
                    {activeTab === "deposit" && (
                      <>
                        <button
                          onClick={() => handleDeposit(0)}
                          disabled={!depositAmountX || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {getButtonText(0)}
                        </button>
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
              <div className="arca-primary font-bold text-lg">{vault.apr}%</div>
              <div className="text-arca-secondary text-xs">
                ({vault.aprDaily}% daily)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-arca-secondary text-xs">TOTAL TVL</div>
              <div className="text-white font-medium">
                {formatCurrency(vault.totalTvl)}
              </div>
              <CoinGeckoAttributionMinimal className="mt-1" />
            </div>
            <div>
              <div className="text-arca-secondary text-xs">QUEUE STATUS</div>
              <div className="text-white font-medium">
                {vault.pendingDeposits}D / {vault.pendingWithdraws}W
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Expanded Details */}
        {isExpanded && (
          <div className="bg-arca-surface border border-arca-border border-t-0 rounded-b-xl px-4 py-4 -mt-1">
            {/* Error Display */}
            <ErrorDisplay
              error={error}
              onDismiss={clearError}
              className="mb-4"
            />

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
                          Balance:{" "}
                          {tokenIndex === 0
                            ? vault.userBalanceX
                            : vault.userBalanceY}
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

                  {/* Mobile Action Buttons */}
                  <div className="mt-3 space-y-2">
                    {activeTab === "deposit" && (
                      <>
                        <button
                          onClick={() => handleDeposit(0)}
                          disabled={!depositAmountX || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {getButtonText(0)}
                        </button>
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
