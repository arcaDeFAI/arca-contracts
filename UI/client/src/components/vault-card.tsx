import type { RealVault } from "../types/vault";
import TokenPairIcons from "./token-pair-icons";
import { useState, useEffect } from "react";
import { useVaultWithErrorHandling } from "../hooks/use-vault-with-error-handling";
import { ErrorDisplay } from "./web3-error-boundary";
import { TransactionModal } from "./transaction-modal";
import {
  TransactionProgress,
  type TransactionStatus,
} from "./transaction-progress";
import { useTransactionHistory } from "../hooks/use-transaction-history";

interface VaultCardProps {
  vault: RealVault;
  onClick?: () => void;
}

export default function VaultCard({ vault, onClick }: VaultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [depositAmountWS, setDepositAmountWS] = useState("");
  const [depositAmountUSDC, setDepositAmountUSDC] = useState("");
  const [withdrawSharesX, setWithdrawSharesX] = useState("");
  const [withdrawSharesY, setWithdrawSharesY] = useState("");

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{
    type: "deposit" | "withdraw" | "approve";
    token: "wS" | "USDC.e";
    amount: string;
  } | null>(null);
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>("idle");
  const [currentTxHash, setCurrentTxHash] = useState<string>("");

  const {
    depositWS,
    depositUSDC,
    withdrawShares,
    approveWS,
    approveUSDC,
    hasAllowance,
    isWritePending,
    isConfirming,
    lastOperation,
    error,
    clearError,
    validateConnection,
    validateBalance,
    validateShares,
    hash,
  } = useVaultWithErrorHandling();

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
          pendingTransaction.token,
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

  const handleDeposit = async (token: "wS" | "USDC.e") => {
    const amount = token === "wS" ? depositAmountWS : depositAmountUSDC;
    if (!amount) return;

    // Validate connection and balance
    if (!validateConnection()) return;

    const tokenType = token === "wS" ? "wS" : "usdce";
    if (!validateBalance(tokenType, amount)) return;

    // Check if approval is needed
    if (!hasAllowance(tokenType, amount)) {
      // Show approval confirmation
      setPendingTransaction({ type: "approve", token, amount });
      setShowConfirmModal(true);
      return;
    }

    // Show deposit confirmation
    setPendingTransaction({ type: "deposit", token, amount });
    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (!pendingTransaction) return;

    setShowConfirmModal(false);

    try {
      const { type, token, amount } = pendingTransaction;

      if (type === "approve") {
        if (token === "wS") {
          await approveWS(amount);
        } else {
          await approveUSDC(amount);
        }
      } else if (type === "deposit") {
        if (token === "wS") {
          await depositWS(amount);
          setDepositAmountWS(""); // Clear input on success
        } else {
          await depositUSDC(amount);
          setDepositAmountUSDC(""); // Clear input on success
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
      token: "wS",
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

  const getButtonText = (token: "wS" | "USDC.e") => {
    if (isWritePending && lastOperation === "deposit") return "Pending...";
    if (isConfirming && lastOperation === "deposit") return "Confirming...";

    const amount = token === "wS" ? depositAmountWS : depositAmountUSDC;
    if (!amount) return "Enter Amount";

    const tokenType = token === "wS" ? "wS" : "usdce";
    if (!hasAllowance(tokenType, amount)) {
      return `Approve ${token}`;
    }

    return `Deposit ${token}`;
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
          <div className="flex items-center">
            <span className="text-white font-medium">
              {formatCurrency(vault.totalTvl)}
            </span>
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
                  <div className="text-arca-secondary text-sm">wS Shares</div>
                  <div className="text-arca-secondary text-sm">
                    USDC.e Shares
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
                  {vault.tokens.map((token) => (
                    <div key={token} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-arca-secondary text-sm">
                          {token} to{" "}
                          {activeTab === "deposit" ? "Add" : "Remove"}
                        </span>
                        <span className="text-arca-secondary text-sm">
                          Balance:{" "}
                          {token === "wS"
                            ? vault.userBalanceWS
                            : vault.userBalanceUSDC}
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
                              ? token === "wS"
                                ? depositAmountWS
                                : depositAmountUSDC
                              : token === "wS"
                                ? withdrawSharesX
                                : withdrawSharesY
                          }
                          onChange={(e) => {
                            if (activeTab === "deposit") {
                              if (token === "wS") {
                                setDepositAmountWS(e.target.value);
                              } else {
                                setDepositAmountUSDC(e.target.value);
                              }
                            } else {
                              if (token === "wS") {
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
                          onClick={() => handleDeposit("wS")}
                          disabled={!depositAmountWS || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {getButtonText("wS")}
                        </button>
                        <button
                          onClick={() => handleDeposit("USDC.e")}
                          disabled={!depositAmountUSDC || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {getButtonText("USDC.e")}
                        </button>
                      </>
                    )}

                    {activeTab === "withdraw" && (
                      <button
                        onClick={handleWithdraw}
                        disabled={
                          (!withdrawSharesX && !withdrawSharesY) ||
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
                  <div className="text-arca-secondary text-xs">wS Shares</div>
                  <div className="text-arca-secondary text-xs">
                    USDC.e Shares
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
                  {vault.tokens.map((token) => (
                    <div key={token} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-arca-secondary text-xs">
                          {token} to{" "}
                          {activeTab === "deposit" ? "Add" : "Remove"}
                        </span>
                        <span className="text-arca-secondary text-xs">
                          Balance:{" "}
                          {token === "wS"
                            ? vault.userBalanceWS
                            : vault.userBalanceUSDC}
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
                              ? token === "wS"
                                ? depositAmountWS
                                : depositAmountUSDC
                              : token === "wS"
                                ? withdrawSharesX
                                : withdrawSharesY
                          }
                          onChange={(e) => {
                            if (activeTab === "deposit") {
                              if (token === "wS") {
                                setDepositAmountWS(e.target.value);
                              } else {
                                setDepositAmountUSDC(e.target.value);
                              }
                            } else {
                              if (token === "wS") {
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
                          onClick={() => handleDeposit("wS")}
                          disabled={!depositAmountWS || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {getButtonText("wS")}
                        </button>
                        <button
                          onClick={() => handleDeposit("USDC.e")}
                          disabled={!depositAmountUSDC || isWritePending}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {getButtonText("USDC.e")}
                        </button>
                      </>
                    )}

                    {activeTab === "withdraw" && (
                      <button
                        onClick={handleWithdraw}
                        disabled={
                          (!withdrawSharesX && !withdrawSharesY) ||
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
            token={pendingTransaction.token}
            amount={pendingTransaction.amount}
            isLoading={false}
            userBalance={
              pendingTransaction.token === "wS"
                ? vault.userBalanceWS
                : vault.userBalanceUSDC
            }
            vaultShare={
              pendingTransaction.token === "wS"
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
            token={pendingTransaction.token}
            amount={pendingTransaction.amount}
            error={error || undefined}
            onRetry={handleRetryTransaction}
          />
        </>
      )}
    </>
  );
}
