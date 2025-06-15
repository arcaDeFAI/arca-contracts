import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Mock data - replace with actual contract calls
const stakingTiers = [
  { id: 0, name: '3 Month', multiplier: 1.5, lockPeriod: 90, penaltyRate: 35, color: 'bg-blue-500' },
  { id: 1, name: '6 Month', multiplier: 2.0, lockPeriod: 180, penaltyRate: 25, color: 'bg-purple-500' },
  { id: 2, name: '12 Month', multiplier: 3.0, lockPeriod: 365, penaltyRate: 15, color: 'bg-arca-primary' }
];

const mockMetroPositions = [
  {
    id: 0,
    amount: 1000,
    nMetroAmount: 1500,
    tierId: 0,
    startTime: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
    unlockTime: Date.now() + (60 * 24 * 60 * 60 * 1000), // 60 days from now
    rebaseRewards: 45.2,
    isActive: true
  },
  {
    id: 1,
    amount: 2500,
    nMetroAmount: 5000,
    tierId: 1,
    startTime: Date.now() - (45 * 24 * 60 * 60 * 1000), // 45 days ago
    unlockTime: Date.now() + (135 * 24 * 60 * 60 * 1000), // 135 days from now
    rebaseRewards: 128.7,
    isActive: true
  }
];

const mockX33Positions = [
  {
    id: 0,
    amount: 500,
    nShadowAmount: 500,
    startTime: Date.now() - (15 * 24 * 60 * 60 * 1000), // 15 days ago
    isActive: true
  }
];

export default function Staking() {
  const [selectedTab, setSelectedTab] = useState<'metro' | 'x33'>('metro');
  const [selectedTier, setSelectedTier] = useState(0);
  const [stakeAmount, setStakeAmount] = useState('');

  const formatTimeRemaining = (unlockTime: number) => {
    const now = Date.now();
    const remaining = unlockTime - now;
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    return days > 0 ? `${days} days` : 'Unlocked';
  };

  const calculateProgress = (startTime: number, unlockTime: number) => {
    const now = Date.now();
    const total = unlockTime - startTime;
    const elapsed = now - startTime;
    return Math.min((elapsed / total) * 100, 100);
  };

  const calculateCurrentPenalty = (startTime: number, unlockTime: number, tierId: number) => {
    const now = Date.now();
    if (now >= unlockTime) return 0;
    
    const tier = stakingTiers[tierId];
    const timeRemaining = unlockTime - now;
    const totalLockTime = tier.lockPeriod * 24 * 60 * 60 * 1000;
    const timeRatio = timeRemaining / totalLockTime;
    
    return (tier.penaltyRate * timeRatio) / 100;
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">Staking</h1>
        <p className="text-arca-secondary text-sm sm:text-base">Stake METRO and X33 tokens to earn rewards</p>
      </div>
      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-arca-surface border-arca-border">
          <CardContent className="p-4">
            <div className="text-arca-secondary text-sm">Total METRO Staked</div>
            <div className="text-white font-bold text-xl">1,250,000</div>
          </CardContent>
        </Card>
        <Card className="bg-arca-surface border-arca-border">
          <CardContent className="p-4">
            <div className="text-arca-secondary text-sm">Total X33 Staked</div>
            <div className="text-white font-bold text-xl">89,500</div>
          </CardContent>
        </Card>
        <Card className="bg-arca-surface border-arca-border">
          <CardContent className="p-4">
            <div className="text-arca-secondary text-sm">Piggy Bank</div>
            <div className="font-bold text-xl text-[#fcfbfa]">45,230</div>
          </CardContent>
        </Card>
        <Card className="bg-arca-surface border-arca-border">
          <CardContent className="p-4">
            <div className="text-arca-secondary text-sm">Pending Rewards</div>
            <div className="font-bold text-xl text-[#fcfcfc]">12,847</div>
          </CardContent>
        </Card>
      </div>
      {/* Tab Selection */}
      <div className="flex mb-6">
        <button
          className={`px-6 py-3 rounded-l-lg font-medium transition-colors ${
            selectedTab === 'metro'
              ? 'bg-arca-primary text-black'
              : 'bg-arca-surface text-white hover:bg-arca-border'
          }`}
          onClick={() => setSelectedTab('metro')}
        >
          METRO Staking
        </button>
        <button
          className={`px-6 py-3 rounded-r-lg font-medium transition-colors ${
            selectedTab === 'x33'
              ? 'bg-arca-primary text-black'
              : 'bg-arca-surface text-white hover:bg-arca-border'
          }`}
          onClick={() => setSelectedTab('x33')}
        >
          X33 Staking
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Staking Interface */}
        <div>
          <Card className="bg-arca-surface border-arca-border">
            <CardHeader>
              <CardTitle className="text-white">
                {selectedTab === 'metro' ? 'Stake METRO' : 'Stake X33'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedTab === 'metro' && (
                <>
                  <div>
                    <label className="text-arca-secondary text-sm mb-2 block">Select Staking Tier</label>
                    <div className="grid grid-cols-3 gap-2">
                      {stakingTiers.map((tier) => (
                        <button
                          key={tier.id}
                          className={`p-3 rounded-lg border transition-all ${
                            selectedTier === tier.id
                              ? 'border-arca-primary bg-arca-primary/10'
                              : 'border-arca-border bg-arca-bg hover:border-arca-primary/50'
                          }`}
                          onClick={() => setSelectedTier(tier.id)}
                        >
                          <div className="text-white font-medium text-sm">{tier.name}</div>
                          <div className="text-arca-primary text-xs">{tier.multiplier}x</div>
                          <div className="text-arca-secondary text-xs">{tier.penaltyRate}% penalty</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-arca-bg rounded-lg p-4">
                    <div className="text-white font-medium mb-2">Selected Tier Details</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-arca-secondary">Multiplier:</span>
                        <span className="text-arca-primary">{stakingTiers[selectedTier].multiplier}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-arca-secondary">Lock Period:</span>
                        <span className="text-white">{stakingTiers[selectedTier].lockPeriod} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-arca-secondary">Early Exit Penalty:</span>
                        <span className="text-red-400">{stakingTiers[selectedTier].penaltyRate}%</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-arca-secondary text-sm mb-2 block">
                  Amount to Stake
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="bg-arca-bg border-arca-border text-white pr-16"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-arca-primary text-sm hover:text-arca-primary/80">
                    MAX
                  </button>
                </div>
                <div className="text-arca-secondary text-xs mt-1">
                  Balance: <span className="text-arca-primary">{selectedTab === 'metro' ? '10,000 METRO' : '5,000 X33'}</span>
                </div>
              </div>

              {selectedTab === 'metro' && stakeAmount && (
                <div className="bg-arca-bg rounded-lg p-4">
                  <div className="text-arca-secondary font-medium mb-2">You Will Receive</div>
                  <div className="text-arca-primary text-2xl font-bold">
                    {(parseFloat(stakeAmount) * stakingTiers[selectedTier].multiplier).toLocaleString()} nMETRO
                  </div>
                </div>
              )}

              {selectedTab === 'x33' && stakeAmount && (
                <div className="bg-arca-bg rounded-lg p-4">
                  <div className="text-arca-secondary font-medium mb-2">You Will Receive</div>
                  <div className="text-arca-primary text-2xl font-bold">
                    {parseFloat(stakeAmount).toLocaleString()} nShadow
                  </div>
                  <div className="text-arca-secondary text-sm mt-1">1:1 ratio, no lock period</div>
                </div>
              )}

              <Button className="w-full bg-arca-primary text-black hover:bg-arca-primary/90">
                Stake {selectedTab === 'metro' ? 'METRO' : 'X33'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Active Positions */}
        <div>
          <Card className="bg-arca-surface border-arca-border">
            <CardHeader>
              <CardTitle className="text-white">
                Your {selectedTab === 'metro' ? 'METRO' : 'X33'} Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedTab === 'metro' ? (
                  mockMetroPositions.length > 0 ? (
                    mockMetroPositions.map((position) => (
                      <div key={position.id} className="bg-arca-bg rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-arca-primary font-medium">
                              {position.amount.toLocaleString()} METRO
                            </div>
                            <div className="text-arca-secondary text-sm">
                              {stakingTiers[position.tierId].name} Tier
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-arca-primary/20 text-arca-primary">
                            {position.nMetroAmount.toLocaleString()} nMETRO
                          </Badge>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-arca-secondary">Progress:</span>
                            <span className="text-arca-secondary">
                              {formatTimeRemaining(position.unlockTime)}
                            </span>
                          </div>
                          <Progress 
                            value={calculateProgress(position.startTime, position.unlockTime)} 
                            className="h-2"
                          />
                          
                          <div className="flex justify-between text-sm">
                            <span className="text-arca-secondary">Rebase Rewards:</span>
                            <span className="text-arca-primary">+{position.rebaseRewards} METRO</span>
                          </div>
                          
                          <div className="flex justify-between text-sm">
                            <span className="text-arca-secondary">Current Penalty:</span>
                            <span className="text-red-400">
                              {calculateCurrentPenalty(position.startTime, position.unlockTime, position.tierId).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {Date.now() >= position.unlockTime ? (
                            <Button className="flex-1 bg-arca-primary text-black hover:bg-arca-primary/90">
                              Unlock
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              className="flex-1 border-red-400 text-red-400 hover:bg-red-400/10"
                            >
                              Emergency Exit
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            className="border-arca-primary text-arca-primary hover:bg-arca-primary/10"
                          >
                            Claim Rewards
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-arca-secondary">No METRO positions found</div>
                      <div className="text-arca-secondary text-sm">Stake METRO tokens to get started</div>
                    </div>
                  )
                ) : (
                  mockX33Positions.length > 0 ? (
                    mockX33Positions.map((position) => (
                      <div key={position.id} className="bg-arca-bg rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-arca-primary font-medium">
                              {position.amount.toLocaleString()} X33
                            </div>
                            <div className="text-arca-secondary text-sm">
                              Staked {Math.floor((Date.now() - position.startTime) / (24 * 60 * 60 * 1000))} days ago
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-arca-primary/20 text-arca-primary">
                            {position.nShadowAmount.toLocaleString()} nShadow
                          </Badge>
                        </div>

                        <Button className="w-full bg-arca-primary text-black hover:bg-arca-primary/90">
                          Unstake X33
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-arca-secondary">No X33 positions found</div>
                      <div className="text-arca-secondary text-sm">Stake X33 tokens to get started</div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}