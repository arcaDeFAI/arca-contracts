import { useState, useEffect, useCallback } from "react";
import { usePublicClient } from "wagmi";
import { getContracts } from "../lib/contracts";

// Vault-scoped transaction history with proper token context
// This replaces the global transaction history for multi-vault support

export interface VaultTransactionContext {
  vaultAddress: string;
  tokenXSymbol: string;
  tokenYSymbol: string;
  chainId: number;
  userAddress: string;
}

export interface VaultTransactionRecord {
  id: string;
  hash: string;
  type: "deposit" | "withdraw" | "approve";
  token: string; // Actual token symbol (e.g., "wS", "METRO", "BTC")
  amount: string;
  status: "pending" | "confirming" | "success" | "failed";
  timestamp: number;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  vaultAddress: string; // Which vault this transaction belongs to
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

/**
 * Vault-scoped transaction history hook
 * Each vault maintains its own transaction history with proper token symbols
 */
export function useVaultTransactionHistory(context: VaultTransactionContext) {
  const publicClient = usePublicClient();
  const [transactions, setTransactions] = useState<VaultTransactionRecord[]>(
    [],
  );
  const [isLoadingBlockchainHistory, setIsLoadingBlockchainHistory] =
    useState(false);
  const [blockchainHistoryLoaded, setBlockchainHistoryLoaded] = useState(false);

  // Vault-specific storage key
  const storageKey = `arca_vault_transactions_${context.vaultAddress}_${context.chainId}_${context.userAddress}`;

  // Map tokenType from blockchain events to actual token symbols
  const mapTokenType = useCallback(
    (tokenType: number): string => {
      return tokenType === 0 ? context.tokenXSymbol : context.tokenYSymbol;
    },
    [context.tokenXSymbol, context.tokenYSymbol],
  );

  // Load blockchain transaction history for this specific vault
  const loadBlockchainHistory = useCallback(
    async (signal?: AbortSignal) => {
      if (!publicClient || blockchainHistoryLoaded) {
        return;
      }

      // Skip if no vault address provided
      if (!context.vaultAddress) {
        return;
      }

      // Check if already aborted
      if (signal?.aborted) return;

      setIsLoadingBlockchainHistory(true);

      try {
        // Get contract deployment block to limit search range
        const fromBlock = BigInt(0); // In production, use deployment block
        const toBlock = "latest" as const;

        // Fetch deposit events for this specific vault
        const depositLogs = await publicClient.getLogs({
          address: context.vaultAddress as `0x${string}`,
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
            user: context.userAddress as `0x${string}`,
          },
          fromBlock,
          toBlock,
        });

        // Fetch withdraw events for this specific vault
        const withdrawLogs = await publicClient.getLogs({
          address: context.vaultAddress as `0x${string}`,
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
            user: context.userAddress as `0x${string}`,
          },
          fromBlock,
          toBlock,
        });

        // Check if aborted after network requests
        if (signal?.aborted) return;

        // Convert logs to transaction records with proper token symbols
        const blockchainTransactions: VaultTransactionRecord[] = [];

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
            token: mapTokenType(args.tokenType), // Use actual token symbol
            amount: (Number(args.amount) / 1e18).toString(),
            status: "success", // Events only exist for successful transactions
            timestamp: Date.now(), // Would need to fetch block timestamp in production
            blockNumber: Number(log.blockNumber),
            vaultAddress: context.vaultAddress,
            chainId: context.chainId,
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
            token: mapTokenType(args.tokenType), // Use actual token symbol
            amount: (Number(args.amount) / 1e18).toString(),
            status: "success",
            timestamp: Date.now(), // Would need block timestamp
            blockNumber: Number(log.blockNumber),
            vaultAddress: context.vaultAddress,
            chainId: context.chainId,
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

        // Check if aborted before updating state
        if (signal?.aborted) return;

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

        // Check if aborted before setting state
        if (!signal?.aborted) {
          setBlockchainHistoryLoaded(true);
        }
      } catch (error) {
        // Don't log errors if the request was aborted
        if (!signal?.aborted) {
          console.error(
            `Failed to load blockchain transaction history for vault ${context.vaultAddress}:`,
            error,
          );
        }
      } finally {
        // Only update loading state if not aborted
        if (!signal?.aborted) {
          setIsLoadingBlockchainHistory(false);
        }
      }
    },
    [context, publicClient, blockchainHistoryLoaded, mapTokenType],
  );

  // Load localStorage transactions and blockchain history on mount
  useEffect(() => {
    // Create AbortController for cleanup
    const abortController = new AbortController();

    // Load localStorage data first
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsedTransactions = JSON.parse(stored).map(
          (tx: VaultTransactionRecord) => ({
            ...tx,
            source: tx.source || "localStorage", // Ensure source is set
          }),
        );
        setTransactions(parsedTransactions);
      } catch (error) {
        console.error("Failed to parse stored vault transactions:", error);
        setTransactions([]);
      }
    }

    // Load blockchain history with abort signal
    void loadBlockchainHistory(abortController.signal);

    // Cleanup function - abort the request if component unmounts
    return () => {
      abortController.abort();
    };
  }, [storageKey, loadBlockchainHistory]);

  // Save transactions to localStorage whenever transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(transactions));
    }
  }, [transactions, storageKey]);

  // Add a new transaction (for pending/manual tracking)
  const addTransaction = useCallback(
    (
      hash: string,
      type: "deposit" | "withdraw" | "approve",
      token: string, // Actual token symbol
      amount: string,
    ) => {
      const newTransaction: VaultTransactionRecord = {
        id: `${hash}_${Date.now()}`,
        hash,
        type,
        token,
        amount,
        status: "pending",
        timestamp: Date.now(),
        vaultAddress: context.vaultAddress,
        chainId: context.chainId,
        source: "localStorage", // Manual tracking
      };

      setTransactions((prev) => [newTransaction, ...prev]);
      return newTransaction.id;
    },
    [context.vaultAddress, context.chainId],
  );

  // Update transaction status
  const updateTransactionStatus = useCallback(
    (
      hash: string,
      status: "confirming" | "success" | "failed",
      additionalData?: Partial<VaultTransactionRecord>,
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

  // Get transactions by type
  const getTransactionsByType = useCallback(
    (type: "deposit" | "withdraw" | "approve") => {
      return transactions.filter((tx) => tx.type === type);
    },
    [transactions],
  );

  // Get pending transactions
  const getPendingTransactions = useCallback(() => {
    return transactions.filter((tx) =>
      ["pending", "confirming"].includes(tx.status),
    );
  }, [transactions]);

  // Calculate total deposited for this vault
  const getTotalDeposited = useCallback(() => {
    return transactions
      .filter((tx) => tx.type === "deposit" && tx.status === "success")
      .reduce((sum, tx) => {
        const amount = parseFloat(tx.amount) || 0;
        return sum + amount;
      }, 0);
  }, [transactions]);

  // Calculate total withdrawn for this vault
  const getTotalWithdrawn = useCallback(() => {
    return transactions
      .filter((tx) => tx.type === "withdraw" && tx.status === "success")
      .reduce((sum, tx) => {
        const amount = parseFloat(tx.amount) || 0;
        return sum + amount;
      }, 0);
  }, [transactions]);

  // Calculate time window in days since first successful deposit
  const calculateTimeWindowDays = useCallback(() => {
    const successfulDeposits = transactions
      .filter((tx) => tx.type === "deposit" && tx.status === "success")
      .sort((a, b) => a.timestamp - b.timestamp); // Oldest first

    if (successfulDeposits.length === 0) {
      return 1; // Minimum 1 day to avoid division by zero
    }

    const firstDepositTime = successfulDeposits[0].timestamp;
    const now = Date.now();
    const timeDiffMs = now - firstDepositTime;
    const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

    // Return minimum 1 day to avoid division by zero in APR calculations
    return Math.max(1, timeDiffDays);
  }, [transactions]);

  return {
    // State
    transactions,
    isLoadingBlockchainHistory,
    blockchainHistoryLoaded,

    // Actions
    addTransaction,
    updateTransactionStatus,
    loadBlockchainHistory, // Allow manual refresh

    // Queries
    getTransactionsByType,
    getPendingTransactions,
    getTotalDeposited,
    getTotalWithdrawn,
    calculateTimeWindowDays,

    // Vault context
    vaultAddress: context.vaultAddress,
    tokenXSymbol: context.tokenXSymbol,
    tokenYSymbol: context.tokenYSymbol,
  };
}
