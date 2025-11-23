// Contract addresses
export const CONTRACTS = {
  SONIC: null, // Native token - no contract address
  WS: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38', // wS ERC20 token contract
  USDC: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  WETH: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b', // WETH ERC20 token contract
  METRO: '0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321',
  xSHADOW: '0x5050bc082FF4A74Fb6B0B04385dEfdDB114b2424',
  SHADOW: '0x3333b97138D4b086720b5aE8A7844b1345a33333',
  SHADOW_REWARDS: '0xe879d0E44e6873cf4ab71686055a4f6817685f02', // Default Shadow rewards contract (fallback for S-USDC)
  SHADOW_VOTER: '0x9F59398D0a397b2EEB8a6123a6c7295cB0b0062D', // Shadow voter contract for claiming rewards
} as const;

// Token decimals
export const DECIMALS = {
  SONIC: 18,
  WS: 18,
  USDC: 6,
  WETH: 18,
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
