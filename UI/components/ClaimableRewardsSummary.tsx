'use client'

interface RewardToken {
  token: string
  amount: number
  usdValue: number
  logo?: string
}

interface ClaimableRewardsSummaryProps {
  totalClaimableUSD: number
  metroRewards: RewardToken[]
  shadowRewards: RewardToken[]
  onClaimAll?: () => void
  isClaiming?: boolean
}

export function ClaimableRewardsSummary({ 
  totalClaimableUSD,
  metroRewards,
  shadowRewards,
  onClaimAll,
  isClaiming = false
}: ClaimableRewardsSummaryProps) {
  const hasRewards = totalClaimableUSD > 0
  const allRewards = [...metroRewards, ...shadowRewards]

  return (
    <div className="bg-black border border-gray-800/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Claimable Rewards</h3>
        {hasRewards && (
          <div className="px-3 py-1 bg-arca-green/20 border border-arca-green/30 rounded-full">
            <span className="text-arca-green text-sm font-semibold">
              ${totalClaimableUSD.toFixed(2)} USD
            </span>
          </div>
        )}
      </div>

      {!hasRewards ? (
        <div className="text-center py-8 text-gray-400">
          No claimable rewards yet
        </div>
      ) : (
        <div className="space-y-4">
          {/* Metro Rewards */}
          {metroRewards.length > 0 && (
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <img src="/MetropolisLogo.png" alt="Metro" className="w-5 h-5" />
                <h4 className="text-white font-semibold text-sm">Metropolis Rewards</h4>
              </div>
              <div className="space-y-2">
                {metroRewards.map((reward, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {reward.logo && (
                        <img src={reward.logo} alt={reward.token} className="w-4 h-4 rounded-full" />
                      )}
                      <span className="text-gray-300 text-sm">{reward.token}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold text-sm">
                        {reward.amount.toFixed(4)}
                      </div>
                      <div className="text-gray-400 text-xs">
                        ${reward.usdValue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shadow Rewards */}
          {shadowRewards.length > 0 && (
            <div className="bg-gradient-to-br from-amber-400/10 to-amber-500/5 border border-amber-400/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <img src="/SHadowLogo.jpg" alt="Shadow" className="w-5 h-5 rounded-full" />
                <h4 className="text-white font-semibold text-sm">Shadow Rewards</h4>
              </div>
              <div className="space-y-2">
                {shadowRewards.map((reward, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {reward.logo && (
                        <img src={reward.logo} alt={reward.token} className="w-4 h-4 rounded-full" />
                      )}
                      <span className="text-gray-300 text-sm">{reward.token}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold text-sm">
                        {reward.amount.toFixed(4)}
                      </div>
                      <div className="text-gray-400 text-xs">
                        ${reward.usdValue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Claim All Button */}
          {onClaimAll && (
            <button
              onClick={onClaimAll}
              disabled={isClaiming || !hasRewards}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                isClaiming || !hasRewards
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-arca-green text-black hover:bg-arca-green/90 shadow-[0_0_20px_rgba(0,255,163,0.3)] hover:shadow-[0_0_30px_rgba(0,255,163,0.5)]'
              }`}
            >
              {isClaiming ? 'Claiming All Rewards...' : 'Claim All Rewards'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
