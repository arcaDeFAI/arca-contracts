import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther, parseUnits, formatUnits, type Address } from "viem";
import {
  getContracts,
  VAULT_ABI,
  ERC20_ABI,
  QUEUE_HANDLER_ABI,
  REWARD_CLAIMER_ABI,
} from "../lib/contracts";
import {
  createVaultConfigFromRegistry,
  type VaultConfig,
} from "../lib/vault-configs";
import { useState, useEffect, useMemo } from "react";
import { useVaultRegistry } from "./use-vault-registry";

export function useVault(vaultAddress?: string) {
  const { address: userAddress, chainId } = useAccount();
  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const [lastOperation, setLastOperation] = useState<
    "deposit" | "withdraw" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // Update error state when write error occurs
  useEffect(() => {
    if (writeError) {
      setError(writeError.message || "Transaction failed");
    }
  }, [writeError]);

  const clearError = () => {
    setError(null);
  };

  // Get vault registry data
  const { vaults: registryVaults, isLoading: registryLoading } =
    useVaultRegistry();

  // Find the vault info from registry
  const vaultInfo = vaultAddress
    ? registryVaults.find(
        (v) => v.vault.toLowerCase() === vaultAddress.toLowerCase(),
      )
    : null;

  // Create vault config from registry data
  const vaultConfig =
    vaultInfo && chainId
      ? createVaultConfigFromRegistry(vaultInfo, chainId)
      : null;

  // Determine if we should enable contract queries
  const shouldEnableQueries = !!(
    vaultConfig &&
    vaultAddress &&
    chainId &&
    !registryLoading
  );

  // Vault balance queries (token-agnostic)
  const { data: vaultBalanceX } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "tokenBalance",
    args: [0], // TokenX (first token in pair)
    query: {
      enabled: shouldEnableQueries,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const { data: vaultBalanceY } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "tokenBalance",
    args: [1], // TokenY (second token in pair)
    query: {
      enabled: shouldEnableQueries,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // User share queries (token-agnostic)
  const { data: userSharesX } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress as Address, 0],
    query: {
      enabled: shouldEnableQueries && !!userAddress,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const { data: userSharesY } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress as Address, 1],
    query: {
      enabled: shouldEnableQueries && !!userAddress,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Share price queries (token-agnostic)
  const { data: pricePerShareX } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getPricePerFullShare",
    args: [0],
    query: {
      enabled: shouldEnableQueries,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const { data: pricePerShareY } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getPricePerFullShare",
    args: [1],
    query: {
      enabled: shouldEnableQueries,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Token balance queries (dynamic based on vault config)
  const { data: userBalanceX } = useReadContract({
    address: vaultConfig?.tokenX.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress as Address],
    query: {
      enabled: shouldEnableQueries && !!userAddress,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const { data: userBalanceY } = useReadContract({
    address: vaultConfig?.tokenY.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress as Address],
    query: {
      enabled: shouldEnableQueries && !!userAddress,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Token allowance queries (dynamic based on vault config)
  const { data: allowanceX } = useReadContract({
    address: vaultConfig?.tokenX.address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress as Address, vaultAddress as Address],
    query: {
      enabled: shouldEnableQueries && !!userAddress,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const { data: allowanceY } = useReadContract({
    address: vaultConfig?.tokenY.address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress as Address, vaultAddress as Address],
    query: {
      enabled: shouldEnableQueries && !!userAddress,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Queue status queries
  const { data: pendingDeposits } = useReadContract({
    address: vaultInfo?.queueHandler as Address,
    abi: QUEUE_HANDLER_ABI,
    functionName: "getPendingDepositsCount",
    query: {
      enabled: shouldEnableQueries && !!vaultInfo?.queueHandler,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const { data: pendingWithdraws } = useReadContract({
    address: vaultInfo?.queueHandler as Address,
    abi: QUEUE_HANDLER_ABI,
    functionName: "getPendingWithdrawsCount",
    query: {
      enabled: shouldEnableQueries && !!vaultInfo?.queueHandler,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Reward claimer queries
  const { data: totalCompoundedX } = useReadContract({
    address: vaultInfo?.rewardClaimer as Address,
    abi: REWARD_CLAIMER_ABI,
    functionName: "getTotalCompounded",
    args: [0], // TokenX (first token in pair)
    query: {
      enabled: shouldEnableQueries && !!vaultInfo?.rewardClaimer,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const { data: totalCompoundedY } = useReadContract({
    address: vaultInfo?.rewardClaimer as Address,
    abi: REWARD_CLAIMER_ABI,
    functionName: "getTotalCompounded",
    args: [1], // TokenY (second token in pair)
    query: {
      enabled: shouldEnableQueries && !!vaultInfo?.rewardClaimer,
      staleTime: 10000, // Consider data fresh for 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Token-agnostic approve functions
  const approveTokenX = async (amount: string) => {
    if (!vaultConfig?.tokenX.address || !vaultAddress) return;

    const decimals = vaultConfig.tokenX.decimals || 18;
    writeContract({
      address: vaultConfig.tokenX.address as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vaultAddress as Address, parseUnits(amount, decimals)],
    });
  };

  const approveTokenY = async (amount: string) => {
    if (!vaultConfig?.tokenY.address || !vaultAddress) return;

    const decimals = vaultConfig.tokenY.decimals || 18;
    writeContract({
      address: vaultConfig.tokenY.address as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vaultAddress as Address, parseUnits(amount, decimals)],
    });
  };

  // Token-agnostic deposit functions
  const depositTokenX = async (amount: string) => {
    if (!vaultAddress || !vaultConfig) return;

    const decimals = vaultConfig.tokenX.decimals || 18;
    setLastOperation("deposit");
    writeContract({
      address: vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "depositToken",
      args: [parseUnits(amount, decimals), 0], // TokenX (first token)
    });
  };

  const depositTokenY = async (amount: string) => {
    if (!vaultAddress || !vaultConfig) return;

    const decimals = vaultConfig.tokenY.decimals || 18;
    setLastOperation("deposit");
    writeContract({
      address: vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "depositToken",
      args: [parseUnits(amount, decimals), 1], // TokenY (second token)
    });
  };

  // Token-agnostic withdraw functions
  const withdrawShares = async (sharesX: string, sharesY: string) => {
    if (!vaultAddress) return;

    // Shares always use 18 decimals regardless of underlying token
    setLastOperation("withdraw");
    writeContract({
      address: vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "withdrawTokenShares",
      args: [[parseEther(sharesX), parseEther(sharesY)]],
    });
  };

  const withdrawAll = async () => {
    if (!vaultAddress) return;

    setLastOperation("withdraw");
    writeContract({
      address: vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "withdrawAll",
    });
  };

  // Helper functions for formatting
  const formatBalance = (balance: bigint | unknown, decimals: number = 18) => {
    if (!balance || typeof balance !== "bigint") return "0.0";
    const formatted = formatUnits(balance, decimals);
    // Ensure consistent decimal display for UX
    return formatted.includes(".") ? formatted : `${formatted}.0`;
  };

  const hasAllowance = (tokenIndex: number, amount: string) => {
    const allowance = tokenIndex === 0 ? allowanceX : allowanceY;
    if (!allowance || typeof allowance !== "bigint") return false;
    const decimals = tokenIndex === 0 
      ? vaultConfig?.tokenX.decimals || 18 
      : vaultConfig?.tokenY.decimals || 18;
    return allowance >= parseUnits(amount, decimals);
  };

  const validateBalance = (tokenIndex: number, amount: string) => {
    const balance = tokenIndex === 0 ? userBalanceX : userBalanceY;
    if (!balance || typeof balance !== "bigint") return false;
    const decimals = tokenIndex === 0 
      ? vaultConfig?.tokenX.decimals || 18 
      : vaultConfig?.tokenY.decimals || 18;
    return parseFloat(amount) <= parseFloat(formatUnits(balance, decimals));
  };

  const validateConnection = () => {
    return !!userAddress;
  };

  return {
    // Contract info
    vaultConfig,
    vaultAddress: vaultAddress,
    userAddress,
    chainId,

    // Token info
    tokenXSymbol: vaultConfig?.tokenX.symbol || "",
    tokenYSymbol: vaultConfig?.tokenY.symbol || "",

    // Vault data (token-agnostic)
    vaultBalanceX: formatBalance(vaultBalanceX, vaultConfig?.tokenX.decimals),
    vaultBalanceY: formatBalance(vaultBalanceY, vaultConfig?.tokenY.decimals),
    userSharesX: formatBalance(userSharesX), // Shares always use 18 decimals
    userSharesY: formatBalance(userSharesY), // Shares always use 18 decimals
    pricePerShareX: formatBalance(pricePerShareX), // Price per share is 18 decimals
    pricePerShareY: formatBalance(pricePerShareY), // Price per share is 18 decimals

    // User balances (token-agnostic)
    userBalanceX: formatBalance(userBalanceX, vaultConfig?.tokenX.decimals),
    userBalanceY: formatBalance(userBalanceY, vaultConfig?.tokenY.decimals),

    // Queue status
    pendingDeposits: pendingDeposits?.toString() || "0",
    pendingWithdraws: pendingWithdraws?.toString() || "0",

    // Reward data (token-agnostic)
    totalCompoundedX: formatBalance(totalCompoundedX),
    totalCompoundedY: formatBalance(totalCompoundedY),
    rewardClaimerAddress: vaultInfo?.rewardClaimer,
    rewardDataAvailable:
      !!vaultInfo?.rewardClaimer && (!!totalCompoundedX || !!totalCompoundedY),

    // Transaction state
    isWritePending,
    isConfirming,
    isConfirmed,
    lastOperation,
    hash,

    // Token-agnostic actions
    approveTokenX,
    approveTokenY,
    depositTokenX,
    depositTokenY,
    withdrawShares,
    withdrawAll,
    hasAllowance,
    validateBalance,
    validateConnection,

    // Utils
    formatBalance,

    // Error handling
    error,
    setError,
    clearError,

    // Legacy compatibility (for backward compatibility during transition)
    userBalanceWS: formatBalance(userBalanceX), // Deprecated: use userBalanceX
    userBalanceUSDC: formatBalance(userBalanceY), // Deprecated: use userBalanceY
    approveWS: approveTokenX, // Deprecated: use approveTokenX
    approveUSDC: approveTokenY, // Deprecated: use approveTokenY
    depositWS: depositTokenX, // Deprecated: use depositTokenX
    depositUSDC: depositTokenY, // Deprecated: use depositTokenY
  };
}
