'use client';

import { useRewardsData } from '@/hooks/useRewardsData';
import { formatUSD } from '@/lib/utils';

interface RewardsDisplayProps {
  vaultAddress: string;
  vaultName: string;
  userAddress?: string;
  onClaim: () => void;
  isClaiming: boolean;
}

export function RewardsDisplay({
  vaultAddress,
  vaultName,
  userAddress,
  onClaim,
  isClaiming,
}: RewardsDisplayProps) {
  const { rewards, totalValueUSD, isLoading } = useRewardsData(vaultAddress, userAddress);

  // Don't show if no rewards
  if (!isLoading && rewards.length === 0) {
    return null;
  }

  return (
    <div className="bg-arca-light-gray/30 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-gray-400">Your Pending Rewards:</span>
        {!isLoading && rewards.length > 0 && (
          <span className="font-semibold text-arca-green">Available</span>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-400">Loading rewards...</div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {rewards.map((reward, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-400">{reward.symbol}:</span>
                <div className="text-right">
                  <span className="text-white">
                    {parseFloat(reward.amountFormatted).toFixed(4)} tokens
                  </span>
                  <span className="text-gray-500 ml-2">
                    ({formatUSD(reward.valueUSD)})
                  </span>
                </div>
              </div>
            ))}
            
            {rewards.length > 0 && (
              <div className="flex justify-between text-sm font-semibold border-t border-gray-600 pt-2 mt-2">
                <span className="text-gray-300">Total Value:</span>
                <span className="text-arca-green">{formatUSD(totalValueUSD)}</span>
              </div>
            )}
          </div>

          <button
            onClick={onClaim}
            disabled={isClaiming || rewards.length === 0}
            className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
              isClaiming || rewards.length === 0
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-arca-green text-black hover:bg-arca-green/90'
            }`}
          >
            {isClaiming ? 'Claiming...' : 'Claim All Rewards'}
          </button>
        </>
      )}
    </div>
  );
}
