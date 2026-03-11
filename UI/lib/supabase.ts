import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our vault performance data
export interface VaultSnapshot {
  id?: number;
  vault_id: string;
  ts: number;
  price_per_share: number;
  tick: number;
  tvl: number;
  price_x: number;
  created_at?: string;
}

export interface VaultReward {
  id?: number;
  vault_id: string;
  ts: number;
  amount: string;
  shadow_price: number;
  value_usd: number;
  tx_hash: string;
  created_at?: string;
}
