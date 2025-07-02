import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class Web3ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log the error for debugging
    // eslint-disable-next-line no-console
    console.error("Web3 Error Boundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="bg-arca-surface border border-red-500 rounded-lg p-6 m-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">!</span>
            </div>
            <h2 className="text-red-500 font-semibold text-lg">
              Something went wrong
            </h2>
          </div>

          <div className="text-arca-secondary mb-4">
            <p className="mb-2">
              There was an error loading the vault interface. This might be due
              to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Network connection issues</li>
              <li>Wallet connection problems</li>
              <li>Contract interaction errors</li>
              <li>Incorrect network selection</li>
            </ul>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={this.handleRetry}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-arca-border text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors"
            >
              Reload Page
            </button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-arca-secondary hover:text-white">
                Error Details (Development)
              </summary>
              <pre className="mt-2 p-3 bg-arca-bg border border-arca-border rounded text-red-400 overflow-auto">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for displaying Web3-specific error messages
export function useWeb3ErrorHandler() {
  const handleWeb3Error = (error: unknown): string => {
    if (typeof error === "string") {
      return error;
    }

    if (error instanceof Error) {
      // Handle specific Web3 error types
      if (error.message.includes("User rejected")) {
        return "Transaction was rejected by user";
      }

      if (error.message.includes("insufficient funds")) {
        return "Insufficient funds for transaction";
      }

      if (error.message.includes("gas required exceeds allowance")) {
        return "Transaction would exceed gas limit";
      }

      if (error.message.includes("execution reverted")) {
        return "Transaction failed - please check contract conditions";
      }

      if (error.message.includes("network")) {
        return "Network connection error - please check your connection";
      }

      if (error.message.includes("nonce")) {
        return "Transaction nonce error - please try again";
      }

      // Generic error message
      return error.message || "An unexpected error occurred";
    }

    return "An unknown error occurred";
  };

  return { handleWeb3Error };
}

// Component for displaying error messages
interface ErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorDisplay({
  error,
  onDismiss,
  className = "",
}: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div
      className={`bg-red-500/10 border border-red-500/50 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start space-x-3">
        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">!</span>
        </div>
        <div className="flex-1">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
