/**
 * Other auto-managed vaults on the same pair, compared on the vault page.
 * Each entry is the Beefy vault users deposit into (its share price includes
 * the rewards it compounds), wrapping either a Beefy CLM or an ICHI vault.
 * Addresses from api.beefy.finance (active Sonic vaults).
 */
export interface Competitor {
  name: string;
  /** Beefy vault (mooToken): getPricePerFullShare() x want() */
  vault: `0x${string}`;
  /** What want() is: a Beefy CLM (balances / wants) or an ICHI vault (getTotalAmounts / token0 / token1) */
  kind: 'clm' | 'ichi';
}

const COMPETITORS: Record<string, Competitor[]> = {
  // wS • USDC | Shadow
  '0x727e6d1ff1f1836bb7cdfad30e89edbbef878ab5': [
    { name: 'Beefy (same Shadow pool)', vault: '0x90dEfd0D2D69FBFF5C5eC3D271A5D24b12FB96F1', kind: 'clm' },
    { name: 'ICHI via Beefy (SwapX)', vault: '0x816d2AEAff13dd1eF3a4A2e16eE6cA4B9e50DDD8', kind: 'ichi' },
  ],
  // WS • WETH | Shadow
  '0xb6a8129779e57845588db74435a9afae509e1454': [
    { name: 'Beefy (same Shadow pool)', vault: '0x7821Fc48A8E3547519b49853c8dDBa47b51f29Cd', kind: 'clm' },
    { name: 'ICHI via Beefy (SwapX)', vault: '0x760943c0501c3E5fb64E01834c68b4CCB60c1679', kind: 'ichi' },
  ],
};

export function getCompetitors(vaultAddress: string): Competitor[] {
  return COMPETITORS[vaultAddress.toLowerCase()] ?? [];
}

/** Our vaults that have at least one competitor to compare with. */
export function vaultsWithCompetitors(): string[] {
  return Object.keys(COMPETITORS);
}
