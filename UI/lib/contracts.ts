// Contract addresses
export const CONTRACTS = {
  SONIC: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38',
  USDC: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  METRO: '0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321',
} as const;

// Token decimals
export const DECIMALS = {
  SONIC: 18,
  USDC: 6,
} as const;

// ERC20 ABI for token operations
export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
] as const;
