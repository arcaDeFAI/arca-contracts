'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface AuthGuardProps {
  children: ReactNode;
}

function AccessDenied() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-red-400">Access Restricted</h1>
          <p className="text-gray-300 text-lg">
            This application is currently in pre-alpha testing.
          </p>
          <p className="text-gray-400 text-sm">
            Your wallet address is not authorized to access this application.
          </p>
        </div>

        <div className="border border-gray-700 rounded-lg p-6 bg-gray-900">
          <p className="text-gray-300 text-sm mb-4">
            Connected wallet:
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <p>For access, please contact the development team.</p>
        </div>
      </div>
    </div>
  );
}

function ConnectWallet() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-blue-400">Welcome to Arca DeFi</h1>
          <p className="text-gray-300 text-lg">
            Connect your wallet to continue
          </p>
          <p className="text-gray-400 text-sm">
            This application is currently in pre-alpha testing for authorized users only.
          </p>
        </div>

        <div className="border border-gray-700 rounded-lg p-6 bg-gray-900">
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthGuard({ children }: AuthGuardProps) {
  // TODO: Re-enable auth when ready
  // Temporarily skip authentication
  return <>{children}</>;

  /* Original auth logic - commented out for now
  const { address, isConnected } = useAccount();
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Show loading state during SSR and initial mount
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // If wallet is not connected, show connect wallet screen
  if (!isConnected || !address) {
    return <ConnectWallet />;
  }

  // Check if the connected address is in the whitelist
  const whitelistedAddresses = process.env.NEXT_PUBLIC_WHITELISTED_ADDRESSES?.split(',') || [];
  const isAuthorized = whitelistedAddresses.some(
    whitelistedAddress => whitelistedAddress.toLowerCase().trim() === address.toLowerCase()
  );

  // If wallet is connected but not authorized, show access denied
  if (!isAuthorized) {
    return <AccessDenied />;
  }

  // If wallet is connected and authorized, show the protected content
  return <>{children}</>;
  */
}