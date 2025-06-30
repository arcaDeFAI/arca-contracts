import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type TransactionStatus =
  | "idle"
  | "pending"
  | "confirming"
  | "success"
  | "failed";

export interface TransactionProgressProps {
  isOpen: boolean;
  onClose: () => void;
  status: TransactionStatus;
  txHash?: string;
  type: "deposit" | "withdraw" | "approve";
  token: string;
  amount?: string;
  error?: string;
  onRetry?: () => void;
}

export function TransactionProgress({
  isOpen,
  onClose,
  status,
  txHash,
  type,
  token,
  amount,
  error,
  onRetry,
}: TransactionProgressProps) {
  const getStatusIcon = () => {
    switch (status) {
      case "pending":
        return (
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
      case "confirming":
        return (
          <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        );
      case "success":
        return (
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case "failed":
        return (
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case "pending":
        return "Transaction Pending";
      case "confirming":
        return "Confirming Transaction";
      case "success":
        return "Transaction Successful";
      case "failed":
        return "Transaction Failed";
      default:
        return "Transaction Status";
    }
  };

  const getStatusDescription = () => {
    const actionText = type === "approve" ? "approval" : type;

    switch (status) {
      case "pending":
        return `Your ${actionText} transaction is being processed. Please wait while it's included in a block.`;
      case "confirming":
        return `Your ${actionText} transaction has been included in a block and is being confirmed.`;
      case "success":
        return `Your ${actionText} of ${amount ? `${amount} ${token}` : token} was successful!`;
      case "failed":
        return `Your ${actionText} transaction failed. ${error || "Please try again."}`;
      default:
        return "";
    }
  };

  const getProgressSteps = () => {
    const steps = [
      { label: "Initiated", completed: status !== "idle" },
      {
        label: "Pending",
        completed: ["confirming", "success"].includes(status),
      },
      { label: "Confirmed", completed: status === "success" },
    ];

    return (
      <div className="flex items-center justify-center space-x-4 mt-6">
        {steps.map((step, index) => (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full transition-colors ${
                  step.completed
                    ? "bg-green-500"
                    : status === "failed"
                      ? "bg-red-500"
                      : "bg-arca-border"
                }`}
              />
              <span className="text-xs text-arca-secondary mt-1">
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-8 h-px transition-colors ${
                  step.completed ? "bg-green-500" : "bg-arca-border"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const canClose = status === "success" || status === "failed";

  return (
    <Dialog open={isOpen} onOpenChange={canClose ? onClose : undefined}>
      <DialogContent className="sm:max-w-md bg-arca-surface border-arca-border">
        <DialogHeader>
          <DialogTitle className="text-white text-center">
            {getStatusTitle()}
          </DialogTitle>
          <DialogDescription className="text-arca-secondary text-center">
            {getStatusDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center space-y-4">
          {getStatusIcon()}

          {txHash && (
            <div className="bg-arca-bg rounded-lg p-3 border border-arca-border w-full">
              <div className="text-xs text-arca-secondary mb-1">
                Transaction Hash:
              </div>
              <div className="text-xs font-mono text-white break-all">
                {txHash}
              </div>
              <a
                href={`https://sonicscan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-xs mt-2 inline-block"
              >
                View on Sonicscan →
              </a>
            </div>
          )}

          {status !== "failed" && getProgressSteps()}

          {status === "failed" && error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 w-full">
              <div className="text-red-400 text-sm">
                <strong>Error Details:</strong>
              </div>
              <div className="text-red-300 text-xs mt-1">{error}</div>
            </div>
          )}
        </div>

        {canClose && (
          <div className="flex flex-col sm:flex-row gap-2">
            {status === "failed" && onRetry && (
              <Button
                variant="outline"
                onClick={onRetry}
                className="border-arca-border text-white hover:bg-arca-border"
              >
                Try Again
              </Button>
            )}
            <Button
              onClick={onClose}
              className={
                status === "success"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }
            >
              {status === "success" ? "Continue" : "Close"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
