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
  REWARD_CLAIMER_ABI,
} from "../lib/contracts";
import {
  createVaultConfigFromRegistry,
  type VaultConfig,
} from "../lib/vault-configs";
import { useState } from "react";
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
  useState(() => {
    if (writeError) {
      setError(writeError.message || "Transaction failed");
    }
  });

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
    query: { enabled: shouldEnableQueries },
  });

  const { data: vaultBalanceY } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "tokenBalance",
    args: [1], // TokenY (second token in pair)
    query: { enabled: shouldEnableQueries },
  });

  // User share queries (token-agnostic)
  const { data: userSharesX } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress as Address, 0],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  const { data: userSharesY } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress as Address, 1],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  // Share price queries (token-agnostic)
  const { data: pricePerShareX } = useReadContract({
    address: vaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getPricePerFullShare",
    args: [0],
    query: { enabled: shouldEnableQueries },
  });

  const { data: pricePerShareY } = useReadContract({
    address: vaultAddress as Address,
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
    args: [userAddress as Address],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  const { data: userBalanceY } = useReadContract({
    address: vaultConfig?.tokenY.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress as Address],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  // Token allowance queries (dynamic based on vault config)
  const { data: allowanceX } = useReadContract({
    address: vaultConfig?.tokenX.address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress as Address, vaultAddress as Address],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  const { data: allowanceY } = useReadContract({
    address: vaultConfig?.tokenY.address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress as Address, vaultAddress as Address],
    query: { enabled: shouldEnableQueries && !!userAddress },
  });

  // Queue status queries
  const { data: pendingDeposits } = useReadContract({
    address: vaultInfo?.queueHandler as Address,
    abi: QUEUE_HANDLER_ABI,
    functionName: "getPendingDepositsCount",
    query: { enabled: shouldEnableQueries && !!vaultInfo?.queueHandler },
  });

  const { data: pendingWithdraws } = useReadContract({
    address: vaultInfo?.queueHandler as Address,
    abi: QUEUE_HANDLER_ABI,
    functionName: "getPendingWithdrawsCount",
    query: { enabled: shouldEnableQueries && !!vaultInfo?.queueHandler },
  });

  // Reward claimer queries
  const { data: totalCompoundedX } = useReadContract({
    address: vaultInfo?.rewardClaimer as Address,
    abi: REWARD_CLAIMER_ABI,
    functionName: "getTotalCompounded",
    args: [0], // TokenX (first token in pair)
    query: { enabled: shouldEnableQueries && !!vaultInfo?.rewardClaimer },
  });

  const { data: totalCompoundedY } = useReadContract({
    address: vaultInfo?.rewardClaimer as Address,
    abi: REWARD_CLAIMER_ABI,
    functionName: "getTotalCompounded",
    args: [1], // TokenY (second token in pair)
    query: { enabled: shouldEnableQueries && !!vaultInfo?.rewardClaimer },
  });

  // Token-agnostic approve functions
  const approveTokenX = async (amount: string) => {
    if (!vaultConfig?.tokenX.address || !vaultAddress) return;

    writeContract({
      address: vaultConfig.tokenX.address as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vaultAddress as Address, parseEther(amount)],
    });
  };

  const approveTokenY = async (amount: string) => {
    if (!vaultConfig?.tokenY.address || !vaultAddress) return;

    writeContract({
      address: vaultConfig.tokenY.address as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vaultAddress as Address, parseEther(amount)],
    });
  };

  // Token-agnostic deposit functions
  const depositTokenX = async (amount: string) => {
    if (!vaultAddress) return;

    setLastOperation("deposit");
    writeContract({
      address: vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "depositToken",
      args: [parseEther(amount), 0], // TokenX (first token)
    });
  };

  const depositTokenY = async (amount: string) => {
    if (!vaultAddress) return;

    setLastOperation("deposit");
    writeContract({
      address: vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: "depositToken",
      args: [parseEther(amount), 1], // TokenY (second token)
    });
  };

  // Token-agnostic withdraw functions
  const withdrawShares = async (sharesX: string, sharesY: string) => {
    if (!vaultAddress) return;

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
    vaultAddress: vaultAddress,
    userAddress,
    chainId,

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
