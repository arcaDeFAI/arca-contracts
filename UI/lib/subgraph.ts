// Subgraph client for Arca Vaults on Sonic
// Tracks RewardForwarded events for custom APR calculation

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  'https://api.goldsky.com/api/public/project_cmkigrmrzomyu01uffa1n57a5/subgraphs/arca-vaults/1.0.7/gn';

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

// Type definitions matching actual subgraph schema

export interface VaultEntity {
  id: string;             // Vault Address
  strategy: string;       // Strategy Address
  protocol: string;       // "shadow" or "metropolis"
  rewardEvents: RewardEventEntity[];
}

export interface RewardEventEntity {
  id: string;             // tx hash + log index
  vault: { id: string };  // Vault Address
  strategy: string;       // Strategy Address
  rewardToken: string;    // Token Address
  amount: string;         // Amount in raw BIGINT string
  timestamp: string;      // Unix timestamp
  blockNumber: string;    // Block number
  txHash: string;         // Transaction hash
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
  vault {
    id
  }
`;
