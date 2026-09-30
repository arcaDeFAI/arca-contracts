'use client';

import { PageShell } from '@/components/PageShell';
import { ShadowV2Vault } from '@/components/staking/ShadowV2Vault';

/** Temporary home of the Shadow V2 test vault (instant withdrawals, side pools). */
export default function Staking() {
  return (
    <PageShell>
      <ShadowV2Vault />
    </PageShell>
  );
}
