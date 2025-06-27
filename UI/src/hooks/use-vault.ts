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
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const [lastOperation, setLastOperation] = useState<
    "deposit" | "withdraw" | null
  >(null);

  // Get vault configuration - fallback to default vault if none provided
  const contracts = getContracts(chainId || 31337);
  const defaultVaultAddress = vaultAddress || contracts?.vault;
  const vaultConfig = defaultVaultAddress
    ? getVaultConfig(defaultVaultAddress)
    : null;

  // If no vault config found, return empty state
  if (!vaultConfig || !defaultVaultAddress) {
    return {
      // Contract info
      vaultConfig: null,
      vaultAddress: defaultVaultAddress,

      // Token info
      tokenXSymbol: "",
      tokenYSymbol: "",

      // Vault data
      vaultBalanceX: "0.0",
      vaultBalanceY: "0.0",
      userSharesX: "0.0",
      userSharesY: "0.0",
      pricePerShareX: "0.0",
      pricePerShareY: "0.0",

      // User balances
      userBalanceX: "0.0",
      userBalanceY: "0.0",

      // Queue status
      pendingDeposits: "0",
      pendingWithdraws: "0",

      // Transaction state
      isWritePending: false,
      isConfirming: false,
      isConfirmed: false,
      lastOperation,
      hash: undefined,

      // Actions (no-ops when no vault)
      approveTokenX: async () => {},
      approveTokenY: async () => {},
      depositTokenX: async () => {},
      depositTokenY: async () => {},
      withdrawShares: async () => {},
      withdrawAll: async () => {},
      hasAllowance: () => false,
      validateBalance: () => false,
      validateConnection: () => false,

      // Utils
      formatBalance: (balance: bigint | unknown) => "0.0",
    };
  }

  // Vault balance queries (token-agnostic)
  const { data: vaultBalanceX } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "tokenBalance",
    args: [0], // TokenX (first token in pair)
    query: { enabled: !!defaultVaultAddress },
  });

  const { data: vaultBalanceY } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "tokenBalance",
    args: [1], // TokenY (second token in pair)
    query: { enabled: !!defaultVaultAddress },
  });

  // User share queries (token-agnostic)
  const { data: userSharesX } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress, 0],
    query: { enabled: !!defaultVaultAddress && !!userAddress },
  });

  const { data: userSharesY } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress, 1],
    query: { enabled: !!defaultVaultAddress && !!userAddress },
  });

  // Share price queries (token-agnostic)
  const { data: pricePerShareX } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getPricePerFullShare",
    args: [0],
    query: { enabled: !!defaultVaultAddress },
  });

  const { data: pricePerShareY } = useReadContract({
    address: defaultVaultAddress as Address,
    abi: VAULT_ABI,
    functionName: "getPricePerFullShare",
    args: [1],
    query: { enabled: !!defaultVaultAddress },
  });

  // Token balance queries (dynamic based on vault config)
  const { data: userBalanceX } = useReadContract({
    address: vaultConfig.tokenX.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
    query: { enabled: !!vaultConfig.tokenX.address && !!userAddress },
  });

  const { data: userBalanceY } = useReadContract({
    address: vaultConfig.tokenY.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
    query: { enabled: !!vaultConfig.tokenY.address && !!userAddress },
  });

  // Token allowance queries (dynamic based on vault config)
  const { data: allowanceX } = useReadContract({
    address: vaultConfig.tokenX.address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, defaultVaultAddress],
    query: {
      enabled:
        !!vaultConfig.tokenX.address && !!userAddress && !!defaultVaultAddress,
    },
  });

  const { data: allowanceY } = useReadContract({
    address: vaultConfig.tokenY.address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, defaultVaultAddress],
    query: {
      enabled:
        !!vaultConfig.tokenY.address && !!userAddress && !!defaultVaultAddress,
    },
  });

  // Queue status queries (using legacy contracts structure for queue handler)
  const { data: pendingDeposits } = useReadContract({
    address: contracts?.queueHandler as Address,
    abi: QUEUE_HANDLER_ABI,
    functionName: "getPendingDepositsCount",
    query: { enabled: !!contracts?.queueHandler },
  });

  const { data: pendingWithdraws } = useReadContract({
    address: contracts?.queueHandler as Address,
    abi: QUEUE_HANDLER_ABI,
    functionName: "getPendingWithdrawsCount",
    query: { enabled: !!contracts?.queueHandler },
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
    if (!balance) return false;
    return parseFloat(amount) <= parseFloat(balance);
  };

  const validateConnection = () => {
    return !!userAddress;
  };

  return {
    // Contract info
    vaultConfig,
    vaultAddress: defaultVaultAddress,

    // Token info
    tokenXSymbol: vaultConfig.tokenX.symbol,
    tokenYSymbol: vaultConfig.tokenY.symbol,

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

    // Legacy compatibility (for backward compatibility during transition)
    userBalanceWS: formatBalance(userBalanceX), // Deprecated: use userBalanceX
    userBalanceUSDC: formatBalance(userBalanceY), // Deprecated: use userBalanceY
    approveWS: approveTokenX, // Deprecated: use approveTokenX
    approveUSDC: approveTokenY, // Deprecated: use approveTokenY
    depositWS: depositTokenX, // Deprecated: use depositTokenX
    depositUSDC: depositTokenY, // Deprecated: use depositTokenY
  };
}
