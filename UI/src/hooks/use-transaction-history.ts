import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { getContracts } from "../lib/contracts";

// Enhanced transaction history with blockchain event indexing
// Combines localStorage tracking with real blockchain events for complete history

export interface TransactionRecord {
  id: string;
  hash: string;
  type: "deposit" | "withdraw" | "approve";
  token: string;
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
  // Enhanced fields for blockchain integration
  source: "localStorage" | "blockchain"; // Track data source
  logIndex?: number; // For blockchain events
  tokenType?: number; // 0 = TokenX, 1 = TokenY
  shares?: string; // Shares minted/burned
}

export function useTransactionHistory() {
  const { address: userAddress, chainId } = useAccount();
  const publicClient = usePublicClient();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoadingBlockchainHistory, setIsLoadingBlockchainHistory] =
    useState(false);
  const [blockchainHistoryLoaded, setBlockchainHistoryLoaded] = useState(false);

  // Load blockchain transaction history
  const loadBlockchainHistory = useCallback(async () => {
    if (!userAddress || !chainId || !publicClient || blockchainHistoryLoaded) {
      return;
    }

    const contracts = getContracts(chainId);
    if (!contracts?.vault) {
      return;
    }

    setIsLoadingBlockchainHistory(true);

    try {
      // Get contract deployment block to limit search range
      const fromBlock = BigInt(0); // In production, use deployment block
      const toBlock = "latest" as const;

      // Fetch deposit events
      const depositLogs = await publicClient.getLogs({
        address: contracts.vault as `0x${string}`,
        event: {
          type: "event",
          name: "Deposit",
          inputs: [
            { type: "address", indexed: true, name: "user" },
            { type: "uint8", indexed: true, name: "tokenType" },
            { type: "uint256", indexed: false, name: "amount" },
            { type: "uint256", indexed: false, name: "shares" },
          ],
        },
        args: {
          user: userAddress as `0x${string}`,
        },
        fromBlock,
        toBlock,
      });

      // Fetch withdraw events
      const withdrawLogs = await publicClient.getLogs({
        address: contracts.vault as `0x${string}`,
        event: {
          type: "event",
          name: "Withdraw",
          inputs: [
            { type: "address", indexed: true, name: "user" },
            { type: "uint8", indexed: true, name: "tokenType" },
            { type: "uint256", indexed: false, name: "amount" },
            { type: "uint256", indexed: false, name: "shares" },
          ],
        },
        args: {
          user: userAddress as `0x${string}`,
        },
        fromBlock,
        toBlock,
      });

      // Convert logs to transaction records
      const blockchainTransactions: TransactionRecord[] = [];

      // Process deposit events
      for (const log of depositLogs) {
        const args = log.args as {
          user: string;
          tokenType: number;
          amount: bigint;
          shares: bigint;
        };
        blockchainTransactions.push({
          id: `${log.transactionHash}_${log.logIndex}`,
          hash: log.transactionHash,
          type: "deposit",
          token: args.tokenType === 0 ? "TokenX" : "TokenY", // Generic token mapping - would need vault context for actual symbols
          amount: (Number(args.amount) / 1e18).toString(), // Convert from wei
          status: "success", // Events only exist for successful transactions
          timestamp: Date.now(), // Would need to fetch block timestamp in production
          blockNumber: Number(log.blockNumber),
          userAddress,
          chainId,
          source: "blockchain",
          logIndex: log.logIndex,
          tokenType: args.tokenType,
          shares: (Number(args.shares) / 1e18).toString(),
        });
      }

      // Process withdraw events
      for (const log of withdrawLogs) {
        const args = log.args as {
          user: string;
          tokenType: number;
          amount: bigint;
          shares: bigint;
        };
        blockchainTransactions.push({
          id: `${log.transactionHash}_${log.logIndex}`,
          hash: log.transactionHash,
          type: "withdraw",
          token: args.tokenType === 0 ? "TokenX" : "TokenY", // Generic token mapping - would need vault context for actual symbols
          amount: (Number(args.amount) / 1e18).toString(),
          status: "success",
          timestamp: Date.now(), // Would need block timestamp
          blockNumber: Number(log.blockNumber),
          userAddress,
          chainId,
          source: "blockchain",
          logIndex: log.logIndex,
          tokenType: args.tokenType,
          shares: (Number(args.shares) / 1e18).toString(),
        });
      }

      // Sort by block number (newest first)
      blockchainTransactions.sort(
        (a, b) => (b.blockNumber || 0) - (a.blockNumber || 0),
      );

      // Merge with existing localStorage transactions
      setTransactions((prev) => {
        const localStorageTransactions = prev.filter(
          (tx) => tx.source === "localStorage",
        );
        const combined = [
          ...blockchainTransactions,
          ...localStorageTransactions,
        ];
        // Remove duplicates (prefer blockchain data)
        const unique = combined.filter(
          (tx, index) =>
            combined.findIndex((t) => t.hash === tx.hash) === index,
        );
        return unique.sort((a, b) => b.timestamp - a.timestamp);
      });

      setBlockchainHistoryLoaded(true);
    } catch (error) {
      console.error("Failed to load blockchain transaction history:", error);
    } finally {
      setIsLoadingBlockchainHistory(false);
    }
  }, [userAddress, chainId, publicClient, blockchainHistoryLoaded]);

  // Load localStorage transactions and blockchain history on mount
  useEffect(() => {
    if (userAddress && chainId) {
      // Load localStorage data first
      const storageKey = `arca_transactions_${userAddress}_${chainId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsedTransactions = JSON.parse(stored).map(
            (tx: TransactionRecord) => ({
              ...tx,
              source: tx.source || "localStorage", // Ensure source is set
            }),
          );
          setTransactions(parsedTransactions);
        } catch (error) {
          console.error("Failed to parse stored transactions:", error);
          setTransactions([]);
        }
      }

      // Load blockchain history
      void loadBlockchainHistory();
    }
  }, [userAddress, chainId, loadBlockchainHistory]);

  // Save transactions to localStorage whenever transactions change
  useEffect(() => {
    if (userAddress && chainId && transactions.length > 0) {
      const storageKey = `arca_transactions_${userAddress}_${chainId}`;
      localStorage.setItem(storageKey, JSON.stringify(transactions));
    }
  }, [transactions, userAddress, chainId]);

  // Add a new transaction (for pending/manual tracking)
  const addTransaction = useCallback(
    (
      hash: string,
      type: "deposit" | "withdraw" | "approve",
      token: string,
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
        source: "localStorage", // Manual tracking
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

  // Calculate total deposited (prioritize blockchain data)
  const getTotalDeposited = useCallback(() => {
    return transactions
      .filter((tx) => tx.type === "deposit" && tx.status === "success")
      .reduce((sum, tx) => {
        const amount = parseFloat(tx.amount) || 0;
        // TODO: Use real token prices for USD calculation
        // For now, treat as token amounts
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

    const blockchainTransactions = transactions.filter(
      (tx) => tx.source === "blockchain",
    );

    return {
      totalTransactions: transactions.length,
      successfulTransactions: successfulTransactions.length,
      failedTransactions: failedTransactions.length,
      totalDeposited,
      totalWithdrawn,
      netDeposited,
      pendingTransactions: getPendingTransactions().length,
      blockchainTransactions: blockchainTransactions.length,
      isBlockchainHistoryComplete: blockchainHistoryLoaded,
      isLoadingBlockchainHistory,
    };
  }, [
    transactions,
    getTotalDeposited,
    getTotalWithdrawn,
    getPendingTransactions,
    blockchainHistoryLoaded,
    isLoadingBlockchainHistory,
  ]);

  return {
    // State
    transactions,
    isLoadingBlockchainHistory,
    blockchainHistoryLoaded,

    // Actions
    addTransaction,
    updateTransactionStatus,
    cleanupTransactions,
    clearTransactions,
    loadBlockchainHistory, // Allow manual refresh

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
