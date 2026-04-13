// Subgraph client for Arca Vaults on Sonic
// Tracks RewardForwarded events for custom APR calculation

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  'https://api.goldsky.com/api/public/project_cmkigrmrzomyu01uffa1n57a5/subgraphs/arca-vaults/1.0.12/gn';

/**
 * Unix timestamp (seconds) of the Sonic block this subgraph starts indexing from.
 * Block 66,600,000 = 2026-04-03T20:33:56Z
 * Used to display "Since Apr 3, 2026" on the Total Earned card.
 */
export const SUBGRAPH_START_TIMESTAMP_MS = 1775248436 * 1000;

export interface SubgraphResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

export async function querySubgraph<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const json: SubgraphResponse<T> = await response.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Subgraph error: ${json.errors[0].message}`);
  }

  return json.data;
}

// Type definitions matching subgraph schema (v1.0.8)

export interface VaultEntity {
  id: string;
  strategy: string;
  protocol: string;
  rewardEvents: RewardEventEntity[];
}

export interface RewardEventEntity {
  id: string;
  vault: { id: string };
  strategy: string;
  rewardToken: string;
  amount: string;         // raw BigInt string
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface SnapshotEntity {
  id: string;
  vault: { id: string };
  amountXPerShare: string; // raw BigInt string — previewAmounts(1e18).amountX
  amountYPerShare: string; // raw BigInt string — previewAmounts(1e18).amountY
  totalBalanceX: string;
  totalBalanceY: string;
  tickLower: number;
  tickUpper: number;
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface UserHarvestEventEntity {
  id: string;
  vault: { id: string };
  user: string;
  token: string;
  amount: string;       // raw BigInt string
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface ILSnapshotEntity {
  id: string;
  vault: { id: string };
  firstAmountXPerShare: string;
  firstAmountYPerShare: string;
  firstTimestamp: string;
  latestAmountXPerShare: string;
  latestAmountYPerShare: string;
  latestTimestamp: string;
  snapshotCount: string;
  totalBalanceXSum: string;
  totalBalanceYSum: string;
  totalRewardAmount: string;
  // Shadow: sqrtPriceX96 from CL pool slot0 — convert: (sqrtPriceX96/2^96)^2 * 10^(decimalsX-decimalsY)
  firstSqrtPriceX96: string;
  latestSqrtPriceX96: string;
  // Metro: getPriceFromId(desiredActiveId) scaled by 2^128 — convert: lbPrice/2^128 * 10^(decimalsX-decimalsY)
  firstLBPrice: string;
  latestLBPrice: string;
}

// GraphQL query fragments
export const VAULT_FIELDS = `
  id
  strategy
  protocol
`;

export const REWARD_EVENT_FIELDS = `
  id
  strategy
  rewardToken
  amount
  timestamp
  blockNumber
  txHash
  vault { id }
`;

export const SNAPSHOT_FIELDS = `
  id
  amountXPerShare
  amountYPerShare
  totalBalanceX
  totalBalanceY
  tickLower
  tickUpper
  timestamp
  blockNumber
  txHash
  vault { id }
`;

export const USER_HARVEST_EVENT_FIELDS = `
  id
  user
  token
  amount
  timestamp
  blockNumber
  txHash
  vault { id }
`;

export const IL_SNAPSHOT_FIELDS = `
  id
  firstAmountXPerShare
  firstAmountYPerShare
  firstTimestamp
  latestAmountXPerShare
  latestAmountYPerShare
  latestTimestamp
  snapshotCount
  totalBalanceXSum
  totalBalanceYSum
  totalRewardAmount
  firstSqrtPriceX96
  latestSqrtPriceX96
  firstLBPrice
  latestLBPrice
  vault { id }
`;
