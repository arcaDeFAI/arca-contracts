export const VOTER_CLAIM_ABI = [
    {
      inputs: [
        { name: '_gauges', type: 'address[]' },
        { name: '_tokens', type: 'address[][]' },
        { name: '_nfpTokenIds', type: 'uint256[][]' }
      ],
      name: 'claimClGaugeRewards',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        { name: '_gauges', type: 'address[]' },
        { name: '_tokens', type: 'address[][]' },
        { name: '_nfpTokenIds', type: 'uint256[][]' }
      ],
      name: 'claimClGaugeRewardsAndExit',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    }
  ] as const;