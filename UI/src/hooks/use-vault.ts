import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther, type Address } from "viem";
import {
  getContracts,
  VAULT_ABI,
  ERC20_ABI,
  QUEUE_HANDLER_ABI,
} from "../lib/contracts";
import { getVaultConfig, type VaultConfig } from "../lib/vault-configs";
import { useState } from "react";

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
  useState(() => {
    if (writeError) {
      setError(writeError.message || "Transaction failed");
    }
  });

  const clearError = () => {
    setError(null);
  };

  // Get vault configuration - require both chainId and contracts
  const contracts = chainId ? getContracts(chainId) : null;
  const defaultVaultAddress = vaultAddress || contracts?.vault;
  const vaultConfig = defaultVaultAddress && chainId
    ? getVaultConfig(defaultVaultAddress, chainId)
    : null;

  // Determine if we should enable contract queries (but always call the hooks)
  const shouldEnableQueries = !!(vaultConfig && defaultVaultAddress && chainId);

  // Vault balance queries (token-agnostic)
  const { data: vaultBalanceX } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "tokenBalance",
    args: [0], // TokenX (first token in pair)
    query: { enabled: shouldEnableQueries },
  });

  const { data: vaultBalanceY } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "tokenBalance",
    args: [1], // TokenY (second token in pair)
    query: { enabled: shouldEnableQueries },
  });

  // User share queries (token-agnostic)
  const { data: userSharesX } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress, 0],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  const { data: userSharesY } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress, 1],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  // Share price queries (token-agnostic)
  const { data: pricePerShareX } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getPricePerFullShare",
    args: [0],
    query: { enabled: shouldEnableQueries },
  });

  const { data: pricePerShareY } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getPricePerFullShare",
    args: [1],
    query: { enabled: shouldEnableQueries },
  });

  // Token balance queries (dynamic based on vault config)
  const { data: userBalanceX } = useReadContract({
    address: vaultConfig?.tokenX.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  const { data: userBalanceY } = useReadContract({
    address: vaultConfig?.tokenY.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  // Token allowance queries (dynamic based on vault config)
  const { data: allowanceX } = useReadContract({
    address: vaultConfig?.tokenX.address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, defaultVaultAddress],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  const { data: allowanceY } = useReadContract({
    address: vaultConfig?.tokenY.address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, defaultVaultAddress],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  // Queue status queries (using legacy contracts structure for queue handler)
  const { data: pendingDeposits } = useReadContract({
    address: contracts?.queueHandler as Address,
    abi: QUEUE_HANDLER_ABI,
    functionName: "getPendingDepositsCount",
    query: { enabled: shouldEnableQueries },
  });

  const { data: pendingWithdraws } = useReadContract({
    address: contracts?.queueHandler as Address,
    abi: QUEUE_HANDLER_ABI,
    functionName: "getPendingWithdrawsCount",
    query: { enabled: shouldEnableQueries },
  });

  // Token-agnostic approve functions
  const approveTokenX = async (amount: string) => {
    if (!vaultConfig.tokenX.address || !defaultVaultAddress) return;

    writeContract({
      address: vaultConfig.tokenX.address as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [defaultVaultAddress, parseEther(amount)],
    });
  };

  const approveTokenY = async (amount: string) => {
    if (!vaultConfig.tokenY.address || !defaultVaultAddress) return;

    writeContract({
      address: vaultConfig.tokenY.address as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [defaultVaultAddress, parseEther(amount)],
    });
  };

  // Token-agnostic deposit functions
  const depositTokenX = async (amount: string) => {
    if (!defaultVaultAddress) return;

    setLastOperation("deposit");
    writeContract({
      address: defaultVaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "depositToken",
      args: [parseEther(amount), 0], // TokenX (first token)
    });
  };

  const depositTokenY = async (amount: string) => {
    if (!defaultVaultAddress) return;

    setLastOperation("deposit");
    writeContract({
      address: defaultVaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "depositToken",
      args: [parseEther(amount), 1], // TokenY (second token)
    });
  };

  // Token-agnostic withdraw functions
  const withdrawShares = async (sharesX: string, sharesY: string) => {
    if (!defaultVaultAddress) return;

    setLastOperation("withdraw");
    writeContract({
      address: defaultVaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "withdrawTokenShares",
      args: [[parseEther(sharesX), parseEther(sharesY)]],
    });
  };

  const withdrawAll = async () => {
    if (!defaultVaultAddress) return;

    setLastOperation("withdraw");
    writeContract({
      address: defaultVaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "withdrawAll",
    });
  };

  // Helper functions for formatting
  const formatBalance = (balance: bigint | unknown) => {
    if (!balance || typeof balance !== "bigint") return "0.0";
    const formatted = formatEther(balance);
    // Ensure consistent decimal display for UX
    return formatted.includes(".") ? formatted : `${formatted}.0`;
  };

  const hasAllowance = (tokenIndex: number, amount: string) => {
    const allowance = tokenIndex === 0 ? allowanceX : allowanceY;
    if (!allowance || typeof allowance !== "bigint") return false;
    return allowance >= parseEther(amount);
  };

  const validateBalance = (tokenIndex: number, amount: string) => {
    const balance = tokenIndex === 0 ? userBalanceX : userBalanceY;
    if (!balance || typeof balance !== "bigint") return false;
    return parseFloat(amount) <= parseFloat(formatEther(balance));
  };

  const validateConnection = () => {
    return !!userAddress;
  };

  return {
    // Contract info
    vaultConfig,
    vaultAddress: defaultVaultAddress,
    contracts,

    // Token info
    tokenXSymbol: vaultConfig?.tokenX.symbol || "",
    tokenYSymbol: vaultConfig?.tokenY.symbol || "",

    // Vault data (token-agnostic)
    vaultBalanceX: formatBalance(vaultBalanceX),
    vaultBalanceY: formatBalance(vaultBalanceY),
    userSharesX: formatBalance(userSharesX),
    userSharesY: formatBalance(userSharesY),
    pricePerShareX: formatBalance(pricePerShareX),
    pricePerShareY: formatBalance(pricePerShareY),

    // User balances (token-agnostic)
    userBalanceX: formatBalance(userBalanceX),
    userBalanceY: formatBalance(userBalanceY),

    // Queue status
    pendingDeposits: pendingDeposits?.toString() || "0",
    pendingWithdraws: pendingWithdraws?.toString() || "0",

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
