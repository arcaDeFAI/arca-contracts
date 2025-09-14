export const SHADOW_REWARDS_ABI = [
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    name: 'earned',
    outputs: [
      { name: 'reward', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;
