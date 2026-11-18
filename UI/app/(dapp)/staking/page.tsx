'use client';

import { PageShell } from '@/components/PageShell';

/** Same as the live site. The V2 test vaults are on the Vaults page in dev builds (NEXT_PUBLIC_SHOW_TEST_VAULTS). */
export default function Staking() {
  return (
    <PageShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-arca-green/[0.12] bg-arca-green/[0.08]">
          <svg className="h-7 w-7 text-arca-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-arca-text">Coming Soon</h1>
        <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-arca-text-secondary">
          Staking functionality is under active development. Stay tuned for updates.
        </p>
        <div className="mx-auto h-[2px] w-12 rounded-full bg-arca-green/40" />
      </div>
    </PageShell>
  );
}
