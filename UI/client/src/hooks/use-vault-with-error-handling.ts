import { useState, useCallback } from "react";
import { useVault } from "./use-vault";
import { useWeb3ErrorHandler } from "../components/web3-error-boundary";

export function useVaultWithErrorHandling() {
  const vault = useVault();
  const { handleWeb3Error } = useWeb3ErrorHandler();
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Enhanced deposit functions with error handling
  const safeDepositWS = useCallback(
    async (amount: string) => {
      try {
        setError(null);
        setIsRetrying(false);
        await vault.depositWS(amount);
      } catch (err) {
        const errorMessage = handleWeb3Error(err);
        setError(errorMessage);
        throw err; // Re-throw so the UI can handle loading states
      }
    },
    [vault.depositWS, handleWeb3Error],
  );

  const safeDepositUSDC = useCallback(
    async (amount: string) => {
      try {
        setError(null);
        setIsRetrying(false);
        await vault.depositUSDC(amount);
      } catch (err) {
        const errorMessage = handleWeb3Error(err);
        setError(errorMessage);
        throw err;
      }
    },
    [vault.depositUSDC, handleWeb3Error],
  );

  // Enhanced approval functions with error handling
  const safeApproveWS = useCallback(
    async (amount: string) => {
      try {
        setError(null);
        setIsRetrying(false);
        await vault.approveWS(amount);
      } catch (err) {
        const errorMessage = handleWeb3Error(err);
        setError(errorMessage);
        throw err;
      }
    },
    [vault.approveWS, handleWeb3Error],
  );

  const safeApproveUSDC = useCallback(
    async (amount: string) => {
      try {
        setError(null);
        setIsRetrying(false);
        await vault.approveUSDC(amount);
      } catch (err) {
        const errorMessage = handleWeb3Error(err);
        setError(errorMessage);
        throw err;
      }
    },
    [vault.approveUSDC, handleWeb3Error],
  );

  // Enhanced withdraw functions with error handling
  const safeWithdrawShares = useCallback(
    async (sharesX: string, sharesY: string) => {
      try {
        setError(null);
        setIsRetrying(false);
        await vault.withdrawShares(sharesX, sharesY);
      } catch (err) {
        const errorMessage = handleWeb3Error(err);
        setError(errorMessage);
        throw err;
      }
    },
    [vault.withdrawShares, handleWeb3Error],
  );

  const safeWithdrawAll = useCallback(async () => {
    try {
      setError(null);
      setIsRetrying(false);
      await vault.withdrawAll();
    } catch (err) {
      const errorMessage = handleWeb3Error(err);
      setError(errorMessage);
      throw err;
    }
  }, [vault.withdrawAll, handleWeb3Error]);

  // Retry mechanism for failed operations
  const retryLastOperation = useCallback(async () => {
    setIsRetrying(true);
    setError(null);
    // The retry logic would depend on storing the last operation details
    // For now, we just clear the error and let the user try again manually
  }, []);

  // Connection validation
  const validateConnection = useCallback(() => {
    if (!vault.contracts) {
      setError("Wallet not connected or contracts not available");
      return false;
    }
    return true;
  }, [vault.contracts]);

  // Balance validation
  const validateBalance = useCallback(
    (tokenType: "wS" | "usdce", amount: string) => {
      const balance =
        tokenType === "wS" ? vault.userBalanceWS : vault.userBalanceUSDC;
      const amountNum = parseFloat(amount);
      const balanceNum = parseFloat(balance);

      if (isNaN(amountNum) || amountNum <= 0) {
        setError("Please enter a valid amount");
        return false;
      }

      if (amountNum > balanceNum) {
        setError(`Insufficient ${tokenType.toUpperCase()} balance`);
        return false;
      }

      return true;
    },
    [vault.userBalanceWS, vault.userBalanceUSDC],
  );

  // Shares validation
  const validateShares = useCallback(
    (sharesX: string, sharesY: string) => {
      const sharesXNum = parseFloat(sharesX || "0");
      const sharesYNum = parseFloat(sharesY || "0");
      const userSharesXNum = parseFloat(vault.userSharesX);
      const userSharesYNum = parseFloat(vault.userSharesY);

      if (sharesXNum < 0 || sharesYNum < 0) {
        setError("Share amounts cannot be negative");
        return false;
      }

      if (sharesXNum === 0 && sharesYNum === 0) {
        setError("Please enter at least one share amount");
        return false;
      }

      if (sharesXNum > userSharesXNum) {
        setError("Insufficient wS shares");
        return false;
      }

      if (sharesYNum > userSharesYNum) {
        setError("Insufficient USDC.e shares");
        return false;
      }

      return true;
    },
    [vault.userSharesX, vault.userSharesY],
  );

  return {
    // Original vault data and functions
    ...vault,

    // Enhanced functions with error handling
    depositWS: safeDepositWS,
    depositUSDC: safeDepositUSDC,
    approveWS: safeApproveWS,
    approveUSDC: safeApproveUSDC,
    withdrawShares: safeWithdrawShares,
    withdrawAll: safeWithdrawAll,

    // Error handling state and functions
    error,
    clearError,
    isRetrying,
    retryLastOperation,

    // Validation functions
    validateConnection,
    validateBalance,
    validateShares,
  };
}
