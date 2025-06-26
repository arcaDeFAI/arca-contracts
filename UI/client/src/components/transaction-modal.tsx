import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface TransactionFees {
  depositFee: string; // 0.5%
  networkFee: string; // Gas estimate in ETH
  networkFeeUSD?: string; // Gas estimate in USD
}

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: "deposit" | "withdraw" | "approve";
  token: "wS" | "USDC.e";
  amount: string;
  fees?: TransactionFees;
  isLoading?: boolean;
  userBalance?: string;
  vaultShare?: string; // For withdrawals
}

export function TransactionModal({
  isOpen,
  onClose,
  onConfirm,
  type,
  token,
  amount,
  fees,
  isLoading = false,
  userBalance = "0",
  vaultShare = "0",
}: TransactionModalProps) {
  const formatAmount = (value: string) => {
    const num = parseFloat(value);
    return isNaN(num) ? "0" : num.toFixed(6);
  };

  const calculateDepositFee = (depositAmount: string) => {
    const amount = parseFloat(depositAmount);
    return (amount * 0.005).toFixed(6); // 0.5% fee
  };

  const getModalTitle = () => {
    switch (type) {
      case "deposit":
        return `Confirm ${token} Deposit`;
      case "withdraw":
        return `Confirm ${token} Withdrawal`;
      case "approve":
        return `Approve ${token} Spending`;
      default:
        return "Confirm Transaction";
    }
  };

  const getModalDescription = () => {
    switch (type) {
      case "deposit":
        return `You are depositing ${formatAmount(amount)} ${token} into the Arca vault. This will mint vault shares proportional to your deposit.`;
      case "withdraw":
        return `You are withdrawing ${formatAmount(amount)} shares, which will return ${token} tokens based on the current vault price per share.`;
      case "approve":
        return `You need to approve the vault contract to spend your ${token} tokens before depositing. This is a one-time approval.`;
      default:
        return "Please review the transaction details below.";
    }
  };

  const renderTransactionDetails = () => {
    switch (type) {
      case "deposit":
        return (
          <div className="space-y-4">
            <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
              <h4 className="text-sm font-medium text-arca-secondary mb-3">
                Transaction Details
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">Deposit Amount:</span>
                  <span className="text-white font-medium">
                    {formatAmount(amount)} {token}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">
                    Deposit Fee (0.5%):
                  </span>
                  <span className="text-orange-400">
                    -{calculateDepositFee(amount)} {token}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">Net Deposit:</span>
                  <span className="text-white font-medium">
                    {(
                      parseFloat(amount) -
                      parseFloat(calculateDepositFee(amount))
                    ).toFixed(6)}{" "}
                    {token}
                  </span>
                </div>
                <hr className="border-arca-border" />
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">Your Balance:</span>
                  <span className="text-white">
                    {formatAmount(userBalance)} {token}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">Remaining After:</span>
                  <span className="text-white">
                    {(parseFloat(userBalance) - parseFloat(amount)).toFixed(6)}{" "}
                    {token}
                  </span>
                </div>
              </div>
            </div>

            {fees && (
              <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
                <h4 className="text-sm font-medium text-arca-secondary mb-3">
                  Network Fees
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-arca-secondary">Gas Fee:</span>
                    <span className="text-white">
                      {fees.networkFee} S
                      {fees.networkFeeUSD && (
                        <span className="text-arca-secondary ml-1">
                          (~${fees.networkFeeUSD})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "withdraw":
        return (
          <div className="space-y-4">
            <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
              <h4 className="text-sm font-medium text-arca-secondary mb-3">
                Withdrawal Details
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">
                    Shares to Withdraw:
                  </span>
                  <span className="text-white font-medium">
                    {formatAmount(amount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">
                    Current Share Value:
                  </span>
                  <span className="text-white">
                    {formatAmount(vaultShare)} {token}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">Estimated Tokens:</span>
                  <span className="text-white font-medium">
                    {(parseFloat(amount) * parseFloat(vaultShare)).toFixed(6)}{" "}
                    {token}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">
                    Withdrawal Fee (0.5%):
                  </span>
                  <span className="text-orange-400">
                    -
                    {(
                      parseFloat(amount) *
                      parseFloat(vaultShare) *
                      0.005
                    ).toFixed(6)}{" "}
                    {token}
                  </span>
                </div>
                <hr className="border-arca-border" />
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-arca-secondary">You'll Receive:</span>
                  <span className="text-white">
                    {(
                      parseFloat(amount) *
                      parseFloat(vaultShare) *
                      0.995
                    ).toFixed(6)}{" "}
                    {token}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case "approve":
        return (
          <div className="space-y-4">
            <div className="bg-arca-bg rounded-lg p-4 border border-arca-border">
              <h4 className="text-sm font-medium text-arca-secondary mb-3">
                Approval Details
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">Token:</span>
                  <span className="text-white font-medium">{token}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">Approval Amount:</span>
                  <span className="text-white font-medium">
                    {formatAmount(amount)} {token}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-arca-secondary">Spender:</span>
                  <span className="text-white text-xs font-mono">
                    Arca Vault Contract
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-300 text-xs">
                💡 This approval allows the vault contract to transfer your{" "}
                {token} tokens when you deposit. You only need to approve once
                per token.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-arca-surface border-arca-border">
        <DialogHeader>
          <DialogTitle className="text-white">{getModalTitle()}</DialogTitle>
          <DialogDescription className="text-arca-secondary">
            {getModalDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">{renderTransactionDetails()}</div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="border-arca-border text-white hover:bg-arca-border"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              `Confirm ${type === "approve" ? "Approval" : type === "deposit" ? "Deposit" : "Withdrawal"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
