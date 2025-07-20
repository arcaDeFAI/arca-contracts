# Arca - DeFi Vault Management Platform

## Overview

Arca is a decentralized finance (DeFi) vault management platform built as a full-stack web application with React frontend and Express backend. The application allows users to manage crypto vaults, stake tokens, and track their DeFi portfolio across multiple blockchain networks, with a primary focus on the Sonic blockchain.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state
- **Styling**: Tailwind CSS with custom Arca color scheme
- **UI Components**: Radix UI primitives with custom shadcn/ui components
- **Web3 Integration**: Wagmi for blockchain interactions, RainbowKit for wallet connections
- **Build Tool**: Vite with custom configuration for development and production

### Backend Architecture

- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Development**: TSX for TypeScript execution in development
- **Production**: ESBuild for server bundling

### Database Layer

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Management**: Drizzle Kit for migrations
- **Development Storage**: In-memory storage with interface abstraction
- **Production Ready**: Configured for Neon Database (PostgreSQL)

## Key Components

### Frontend Pages

1. **Vaults** (`/`, `/vaults`) - Main vault browsing and management interface
2. **Dashboard** (`/dashboard`) - Portfolio overview with charts and statistics
3. **Staking** (`/staking`) - Token staking interface with multiple tiers
4. **Navigation** - Responsive navigation with wallet connection

### Backend Services

- **Storage Interface**: Abstracted storage layer ready for Web3-specific caching needs
- **Routes**: RESTful API structure with `/api` prefix for future endpoints
- **Middleware**: Request logging, JSON parsing, error handling

### Web3 Integration

- **Supported Chains**: Ethereum Mainnet, Polygon, Arbitrum, Sonic
- **Wallet Support**: MetaMask, WalletConnect, Safe, and injected wallets
- **Custom Chain**: Sonic blockchain configuration (Chain ID: 146)

## Data Flow

1. **User Authentication**: Web3 wallet-based authentication through RainbowKit
2. **Data Fetching**: TanStack Query manages API calls with caching and background updates
3. **State Management**: React state for UI, TanStack Query for server state
4. **Smart Contract Integration**: Direct blockchain interactions via Wagmi/Viem
5. **Real-time Updates**: On-chain event listening and query invalidation

## External Dependencies

### Core Dependencies

- **React Ecosystem**: React, React DOM, Wouter for routing
- **Web3 Stack**: Wagmi, RainbowKit, Viem for blockchain interactions
- **UI Framework**: Radix UI primitives, Tailwind CSS, Lucide icons
- **Data Management**: TanStack Query, React Hook Form with Zod validation
- **Backend**: Express.js, Drizzle ORM, Neon Database serverless

### Development Tools

- **Build Tools**: Vite, ESBuild, TypeScript compiler
- **Database**: Drizzle Kit for schema management and migrations
- **Styling**: PostCSS, Autoprefixer, Tailwind CSS

## Deployment Strategy

### Development Environment

- **Runtime**: Replit with Node.js 20, Web, and PostgreSQL 16 modules
- **Development Server**: Vite dev server with HMR on port 5000
- **Database**: PostgreSQL development instance

### Production Deployment

- **Target**: Autoscale deployment on Replit
- **Build Process**:
  1. Vite builds frontend to `dist/public`
  2. ESBuild bundles server to `dist/index.js`
- **Runtime**: Production server serves static files and API routes
- **Port Configuration**: Internal port 5000, external port 80

### Environment Configuration

- **Database**: Configurable via `DATABASE_URL` environment variable
- **Web3**: WalletConnect project ID via `VITE_WALLET_CONNECT_PROJECT_ID`
- **Development**: Automatic Replit integration with cartographer plugin

## Changelog

```
Changelog:
- June 15, 2025. Initial setup
- June 15, 2025. Added complete deposit/withdraw functionality with smart contract integration
- June 15, 2025. Updated UI terminology from "Shares" to "Tokens" for better user clarity
- June 15, 2025. Removed redundant "Provide Liquidity" buttons - deposit functionality now handled by "Deposit Tokens"
- June 15, 2025. Removed ARCA EARNED section from vault cards and made deposit/withdraw full-width
- June 15, 2025. Added MANAGE button for dashboard navigation in vault expanded views
- June 15, 2025. Updated Deposit/Withdraw tabs with green theme and white border styling
- June 15, 2025. Fixed mobile navigation layout with improved button sizing and spacing
- June 15, 2025. Removed unnecessary user authentication schema - Web3 wallet connection handles identity
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```
