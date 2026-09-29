import { VAULT_CONFIGS } from '@/lib/vaultConfigs';
import { VaultPageClient } from './VaultDetail';

// Static export: pre-render one page per configured vault
export function generateStaticParams() {
  return VAULT_CONFIGS.map((v) => ({ address: v.vaultAddress }));
}

export default async function VaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <VaultPageClient address={address} />;
}
