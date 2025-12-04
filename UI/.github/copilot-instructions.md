# Copilot / AI Agent Instructions for Arca DeFi UI

Purpose: help an AI coding agent be immediately productive in this repo by describing architecture, conventions, and concrete examples.

- **Big picture**: This is a Next.js app (app-router) that provides a web UI for Arca vaults. UI composition follows `app/` for routes/layout, `components/` for presentational pieces, `hooks/` for data access, and `lib/` for contracts, helpers and Web3 configuration.

- **Key files to read first**:
  - `app/layout.tsx` and `app/providers.tsx` — global providers and theme/wagmi setup
  - `lib/wagmi.ts` — primary Web3 client configuration
  - `lib/contracts.ts` and `typechain.ts` — contract addresses and ABIs
  - `app/page.tsx` — dashboard and `VAULT_CONFIGS` entry point for vault metadata
  - `components/DepositModal.tsx`, `WithdrawModal.tsx` — common token approval/deposit-withdraw flows

- **Run / build / debug**:
  - Dev server: `npm run dev` (starts Next dev server on :3000)
  - Build: `npm run build`
  - Start prod server: `npm start`
  - Lint: `npm run lint` (lint:fix is TODO placeholder in `package.json`)

- **Env & external integrations**:
  - Environment keys live in local `.env`/`.env.local`. Common keys referenced: `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, `NEXT_PUBLIC_ALCHEMY_ID` (see README)
  - Web3 libs: `wagmi`, `viem`, `@rainbow-me/rainbowkit` — use `lib/wagmi.ts` for provider/connector patterns
  - Amplify backend lives under `amplify/` (infrastructure + backend.ts)

- **Data fetching & state**:
  - Uses `@tanstack/react-query` for server-state hooks. Look at `hooks/` for patterns like `useVaultData.ts`, `useTokenBalance.ts`.
  - Hook pattern: small focused hooks that return query results + loading/error states. Prefer composing them in components rather than duplicating logic.

- **Web3 & token patterns**:
  - Token decimals matter: SONIC is 18, USDC is 6 (see README). Use `lib/tokenHelpers.ts` / `lib/tokenUtils.ts` for conversions.
  - Approval → tx → refresh pattern is implemented in `DepositModal`/`WithdrawModal`. Follow their structure for new modal flows.

- **Component conventions**:
  - `components/` contains mostly presentational components + controlled modals. Side-effects and network calls should live in `hooks/` or `lib/` utilities.
  - `VaultCard` and `VaultTableView` are the canonical examples for rendering vault lists & metrics.

- **Where to update vaults / add vaults**:
  - Edit `VAULT_CONFIGS` in `app/page.tsx`. Keep shape consistent with existing entries (addresses, name, tier, apy, tvl).

- **Testing & CI notes**:
  - `package.json` currently has placeholders for `test` and `lint:fix`. Treat tests as absent — add unit tests for new hooks/components and prefer small, focused test files.

- **Example prompts / tasks the agent can perform (concrete)**:
  1. "Add a new hook `useVaultBalances` that composes `useVaultData` + `useTokenBalance` and returns aggregated TVL." — put file under `hooks/`, export named hook, add a small unit test file beside it.
  2. "Implement token decimal formatting utility in `lib/tokenUtils.ts` and replace inline conversions in `DepositModal.tsx` and `WithdrawModal.tsx`." — reference SONIC (18) and USDC (6).
  3. "Add a dev-only debug page at `app/debug/page.tsx` that reads `lib/contracts.ts` and prints the configured addresses." — follow app-router conventions and wrap UI with `AuthGuard` if necessary.

- **Do not assume**:
  - There are no existing tests or CI config in this UI package. Validate before making changes that rely on test runners.
  - That `lint:fix` or `test` scripts are implemented — they are placeholders.
