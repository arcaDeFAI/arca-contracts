# Arca DeFi Vault Application

A modern DeFi application built with Next.js, RainbowKit, and Wagmi for managing yield vault strategies on the Sonic blockchain.

## Features

- 🔗 **Web3 Wallet Integration** - Connect with MetaMask, WalletConnect, and other popular wallets
- 💰 **Vault Management** - Deposit and withdraw from multiple yield vaults
- 📊 **Real-time Balances** - View your SONIC and USDC balances across vaults
- 🔄 **Withdrawal Queue** - Secure withdrawal system with claim functionality
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎨 **Modern UI** - Clean, dark theme matching the Arca brand

## Supported Tokens

- **SONIC (S)**: `0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38` (18 decimals)
- **USDC**: `0x29219dd400f2Bf60E5a23d13Be72B486D4038894` (6 decimals)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Web3 wallet (MetaMask recommended)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd arca-ui
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Update `.env.local` with your API keys:
```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_ALCHEMY_ID=your_alchemy_key_here
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Vault Configuration

To add or modify vaults, update the `VAULT_CONFIGS` array in `app/page.tsx`:

```typescript
const VAULT_CONFIGS = [
  {
    vaultAddress: '0x...', // Your vault contract address
    stratAddress: '0x...', // Your strategy contract address
    name: 'SONIC • USDC',
    tier: 'Active',
    tvl: 1245678,
    apy: 12.4,
  },
  // Add more vaults...
];
```

## Smart Contract Integration

The application integrates with:

- **MetroVault.abi.ts** - Main vault contract for deposits/withdrawals
- **MetroStrat.abi.ts** - Strategy contract for balance calculations
- **ERC20 tokens** - SONIC and USDC token contracts

## Key Components

- **VaultCard** - Reusable component for displaying vault information
- **DepositModal** - Handle token deposits with approval flow
- **WithdrawModal** - Manage withdrawals and claims
- **Header** - Navigation with wallet connection

## Architecture

```
app/
├── layout.tsx          # Root layout with providers
├── page.tsx           # Main dashboard page
├── providers.tsx      # Web3 providers setup
└── globals.css        # Global styles

components/
├── Header.tsx         # Navigation header
├── VaultCard.tsx      # Individual vault display
├── DepositModal.tsx   # Deposit functionality
└── WithdrawModal.tsx  # Withdrawal functionality

hooks/
├── useTokenBalance.ts # Token balance fetching
└── useVaultData.ts    # Vault data aggregation

lib/
├── contracts.ts       # Contract addresses and ABIs
├── utils.ts          # Utility functions
└── wagmi.ts          # Web3 configuration
```

## Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Security Notes

- Always verify contract addresses before deployment
- Test with small amounts first
- Smart contracts should be audited before mainnet deployment
- Keep private keys secure and never commit them to version control

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
