import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

// 🚨 WARNING: TRANSACTION HISTORY IS INCOMPLETE - localStorage ONLY 🚨
// This only tracks manually added transactions, NOT blockchain events
// Users will miss transactions and have inaccurate history
// TODO: Replace with blockchain event indexing for complete transaction history
// DEMO MODE: These warnings will be removed once real event indexing is integrated

export interface TransactionRecord {
  id: string;
  hash: string;
  type: "deposit" | "withdraw" | "approve";
  token: "wS" | "USDC.e";
  amount: string;
  status: "pending" | "confirming" | "success" | "failed";
  timestamp: number;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  userAddress: string;
  chainId: number;
  error?: string;
  // Calculated values for display
  usdValue?: number;
  fee?: string;
}

export function useTransactionHistory() {
  const { address: userAddress, chainId } = useAccount();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  // Load transactions from localStorage on mount
  useEffect(() => {
    if (userAddress && chainId) {
      const storageKey = `arca_transactions_${userAddress}_${chainId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsedTransactions = JSON.parse(stored);
          setTransactions(parsedTransactions);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to parse stored transactions:", error);
          setTransactions([]);
        }
      }
    }
  }, [userAddress, chainId]);

  // Save transactions to localStorage whenever transactions change
  useEffect(() => {
    if (userAddress && chainId && transactions.length > 0) {
      const storageKey = `arca_transactions_${userAddress}_${chainId}`;
      localStorage.setItem(storageKey, JSON.stringify(transactions));
    }
  }, [transactions, userAddress, chainId]);

  // Add a new transaction
  const addTransaction = useCallback(
    (
      hash: string,
      type: "deposit" | "withdraw" | "approve",
      token: "wS" | "USDC.e",
      amount: string,
    ) => {
      if (!userAddress || !chainId) return;

      const newTransaction: TransactionRecord = {
        id: `${hash}_${Date.now()}`,
        hash,
        type,
        token,
        amount,
        status: "pending",
        timestamp: Date.now(),
        userAddress,
        chainId,
      };

      setTransactions((prev) => [newTransaction, ...prev]);
      return newTransaction.id;
    },
    [userAddress, chainId],
  );

  // Update transaction status
  const updateTransactionStatus = useCallback(
    (
      hash: string,
      status: "confirming" | "success" | "failed",
      additionalData?: Partial<TransactionRecord>,
    ) => {
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.hash === hash
            ? {
                ...tx,
                status,
                ...additionalData,
              }
            : tx,
        ),
      );
    },
    [],
  );

  // Remove old transactions (keep last 100)
  const cleanupTransactions = useCallback(() => {
    setTransactions((prev) => prev.slice(0, 100));
  }, []);

  // Get transactions by type
  const getTransactionsByType = useCallback(
    (type: "deposit" | "withdraw" | "approve") => {
      return transactions.filter((tx) => tx.type === type);
    },
    [transactions],
  );

  // Get recent transactions
  const getRecentTransactions = useCallback(
    (limit: number = 10) => {
      return transactions.slice(0, limit);
    },
    [transactions],
  );

  // Get pending transactions
  const getPendingTransactions = useCallback(() => {
    return transactions.filter((tx) =>
      ["pending", "confirming"].includes(tx.status),
    );
  }, [transactions]);

  // Calculate total deposited
  const getTotalDeposited = useCallback(() => {
    return transactions
      .filter((tx) => tx.type === "deposit" && tx.status === "success")
      .reduce((sum, tx) => {
        const amount = parseFloat(tx.amount) || 0;
        // Simple USD calculation - in production would use real token prices
        return sum + amount;
      }, 0);
  }, [transactions]);

  // Calculate total withdrawn
  const getTotalWithdrawn = useCallback(() => {
    return transactions
      .filter((tx) => tx.type === "withdraw" && tx.status === "success")
      .reduce((sum, tx) => {
        const amount = parseFloat(tx.amount) || 0;
        return sum + amount;
      }, 0);
  }, [transactions]);

  // Get transaction by hash
  const getTransactionByHash = useCallback(
    (hash: string) => {
      return transactions.find((tx) => tx.hash === hash);
    },
    [transactions],
  );

  // Clear all transactions
  const clearTransactions = useCallback(() => {
    setTransactions([]);
    if (userAddress && chainId) {
      const storageKey = `arca_transactions_${userAddress}_${chainId}`;
      localStorage.removeItem(storageKey);
    }
  }, [userAddress, chainId]);

  // Generate transaction summary for dashboard
  const getTransactionSummary = useCallback(() => {
    const totalDeposited = getTotalDeposited();
    const totalWithdrawn = getTotalWithdrawn();
    const netDeposited = totalDeposited - totalWithdrawn;

    const successfulTransactions = transactions.filter(
      (tx) => tx.status === "success",
    );
    const failedTransactions = transactions.filter(
      (tx) => tx.status === "failed",
    );

    return {
      totalTransactions: transactions.length,
      successfulTransactions: successfulTransactions.length,
      failedTransactions: failedTransactions.length,
      totalDeposited,
      totalWithdrawn,
      netDeposited,
      pendingTransactions: getPendingTransactions().length,
    };
  }, [
    transactions,
    getTotalDeposited,
    getTotalWithdrawn,
    getPendingTransactions,
  ]);

  return {
    // State
    transactions,

    // Actions
    addTransaction,
    updateTransactionStatus,
    cleanupTransactions,
    clearTransactions,

    // Queries
    getTransactionsByType,
    getRecentTransactions,
    getPendingTransactions,
    getTransactionByHash,
    getTotalDeposited,
    getTotalWithdrawn,
    getTransactionSummary,
  };
}
