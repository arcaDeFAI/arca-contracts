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
import { useState } from "react";

export function useVault() {
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

  const contracts = getContracts(chainId || 31337); // Default to fork for testing

  // Vault balance queries
  const { data: vaultBalanceX } = useReadContract({
    address: contracts?.vault as Address,
    abi: VAULT_ABI,
    functionName: "tokenBalance",
    args: [0], // TokenX (wS)
    query: { enabled: !!contracts?.vault },
  });

  const { data: vaultBalanceY } = useReadContract({
    address: contracts?.vault as Address,
    abi: VAULT_ABI,
    functionName: "tokenBalance",
    args: [1], // TokenY (USDC.e)
    query: { enabled: !!contracts?.vault },
  });

  // User share queries
  const { data: userSharesX } = useReadContract({
    address: contracts?.vault as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress, 0],
    query: { enabled: !!contracts?.vault && !!userAddress },
  });

  const { data: userSharesY } = useReadContract({
    address: contracts?.vault as Address,
    abi: VAULT_ABI,
    functionName: "getShares",
    args: [userAddress, 1],
    query: { enabled: !!contracts?.vault && !!userAddress },
  });

  // Share price queries
  const { data: pricePerShareX } = useReadContract({
    address: contracts?.vault as Address,
    abi: VAULT_ABI,
    functionName: "getPricePerFullShare",
    args: [0],
    query: { enabled: !!contracts?.vault },
  });

  const { data: pricePerShareY } = useReadContract({
    address: contracts?.vault as Address,
    abi: VAULT_ABI,
    functionName: "getPricePerFullShare",
    args: [1],
    query: { enabled: !!contracts?.vault },
  });

  // Token balance queries
  const { data: userBalanceWS } = useReadContract({
    address: contracts?.tokens.wS as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
    query: { enabled: !!contracts?.tokens.wS && !!userAddress },
  });

  const { data: userBalanceUSDC } = useReadContract({
    address: contracts?.tokens.usdce as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
    query: { enabled: !!contracts?.tokens.usdce && !!userAddress },
  });

  // Token allowance queries
  const { data: allowanceWS } = useReadContract({
    address: contracts?.tokens.wS as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, contracts?.vault],
    query: {
      enabled: !!contracts?.tokens.wS && !!userAddress && !!contracts?.vault,
    },
  });

  const { data: allowanceUSDC } = useReadContract({
    address: contracts?.tokens.usdce as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, contracts?.vault],
    query: {
      enabled: !!contracts?.tokens.usdce && !!userAddress && !!contracts?.vault,
    },
  });

  // Queue status queries
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

  // Approve tokens
  const approveWS = async (amount: string) => {
    if (!contracts?.tokens.wS || !contracts?.vault) return;

    writeContract({
      address: contracts.tokens.wS as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [contracts.vault, parseEther(amount)],
    });
  };

  const approveUSDC = async (amount: string) => {
    if (!contracts?.tokens.usdce || !contracts?.vault) return;

    writeContract({
      address: contracts.tokens.usdce as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [contracts.vault, parseEther(amount)], // Note: Assuming 18 decimals for simplicity
    });
  };

  // Deposit functions
  const depositWS = async (amount: string) => {
    if (!contracts?.vault) return;

    setLastOperation("deposit");
    writeContract({
      address: contracts.vault as Address,
      abi: VAULT_ABI,
      functionName: "depositToken",
      args: [parseEther(amount), 0], // TokenX (wS)
    });
  };

  const depositUSDC = async (amount: string) => {
    if (!contracts?.vault) return;

    setLastOperation("deposit");
    writeContract({
      address: contracts.vault as Address,
      abi: VAULT_ABI,
      functionName: "depositToken",
      args: [parseEther(amount), 1], // TokenY (USDC.e)
    });
  };

  // Withdraw functions
  const withdrawShares = async (sharesX: string, sharesY: string) => {
    if (!contracts?.vault) return;

    setLastOperation("withdraw");
    writeContract({
      address: contracts.vault as Address,
      abi: VAULT_ABI,
      functionName: "withdrawTokenShares",
      args: [[parseEther(sharesX), parseEther(sharesY)]],
    });
  };

  const withdrawAll = async () => {
    if (!contracts?.vault) return;

    setLastOperation("withdraw");
    writeContract({
      address: contracts.vault as Address,
      abi: VAULT_ABI,
      functionName: "withdrawAll",
    });
  };

  // Helper functions for formatting
  const formatBalance = (balance: bigint | unknown) => {
    if (!balance || typeof balance !== "bigint") return "0";
    return formatEther(balance);
  };

  const hasAllowance = (tokenType: "wS" | "usdce", amount: string) => {
    const allowance = tokenType === "wS" ? allowanceWS : allowanceUSDC;
    if (!allowance || typeof allowance !== "bigint") return false;
    return allowance >= parseEther(amount);
  };

  return {
    // Contract addresses
    contracts,

    // Vault data
    vaultBalanceX: formatBalance(vaultBalanceX),
    vaultBalanceY: formatBalance(vaultBalanceY),
    userSharesX: formatBalance(userSharesX),
    userSharesY: formatBalance(userSharesY),
    pricePerShareX: formatBalance(pricePerShareX),
    pricePerShareY: formatBalance(pricePerShareY),

    // User balances
    userBalanceWS: formatBalance(userBalanceWS),
    userBalanceUSDC: formatBalance(userBalanceUSDC),

    // Queue status
    pendingDeposits: pendingDeposits?.toString() || "0",
    pendingWithdraws: pendingWithdraws?.toString() || "0",

    // Transaction state
    isWritePending,
    isConfirming,
    isConfirmed,
    lastOperation,
    hash,

    // Actions
    approveWS,
    approveUSDC,
    depositWS,
    depositUSDC,
    withdrawShares,
    withdrawAll,
    hasAllowance,

    // Utils
    formatBalance,
  };
}
