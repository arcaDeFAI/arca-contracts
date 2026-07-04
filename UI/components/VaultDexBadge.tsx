import { cn } from '@/lib/utils';
import { type VaultConfig } from '@/lib/vaultConfigs';

interface VaultDexBadgeProps {
  name: string;
  status?: VaultConfig['status'];
  compact?: boolean;
  className?: string;
}

export function VaultDexBadge({ name, status, compact = false, className }: VaultDexBadgeProps) {
  const isShadow = name.includes('Shadow');
  const isInactive = status === 'inactive';
  const dexName = isShadow ? 'Shadow' : 'Metropolis';
  const dexLogo = isShadow ? '/shadow-logo.png' : '/metropolis-logo.png';
  const dexPillClass = isShadow
    ? 'border-[#8c5a16]/55 bg-[linear-gradient(135deg,rgba(255,184,77,0.22),rgba(255,184,77,0.12)_46%,rgba(89,52,10,0.3))] text-[#ffe2a7] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,238,205,0.18),inset_0_-1px_0_rgba(102,60,12,0.22),0_10px_24px_rgba(27,16,3,0.16)]'
    : 'border-[#25346f]/70 bg-[linear-gradient(135deg,rgba(126,137,255,0.2),rgba(126,137,255,0.12)_46%,rgba(19,29,74,0.34))] text-[#d8deff] backdrop-blur-md shadow-[inset_0_1px_0_rgba(176,190,255,0.12),inset_0_-1px_0_rgba(17,25,63,0.3),0_10px_24px_rgba(8,12,30,0.22)]';

  return (
    <span className={cn('relative inline-flex w-fit items-center justify-center', className)}>
      {isInactive && (
        <span
          className={cn(
            'pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -rotate-[7deg] whitespace-nowrap rounded-full',
            'border border-rose-200/45 bg-[linear-gradient(135deg,rgba(255,55,84,0.98),rgba(150,18,38,0.98))]',
            'font-extrabold uppercase leading-none tracking-[0.08em] text-white',
            'shadow-[0_0_0_1px_rgba(255,60,90,0.12),0_8px_22px_rgba(255,38,70,0.28)]',
            'origin-center',
            compact ? '-top-2 px-1.5 py-[2px] text-[8px]' : '-top-2.5 px-2 py-[3px] text-[9px]',
          )}
        >
          Inactive
        </span>
      )}
      <span
        className={cn(
          'inline-flex items-center rounded-xl border font-medium',
          compact ? 'gap-1.5 px-2 py-[0.375rem] text-[9px] tracking-[0.08em]' : 'gap-2 px-2.5 py-1.5 text-[10px] tracking-[0.1em]',
          dexPillClass,
        )}
      >
        <img src={dexLogo} alt={dexName} className={compact ? 'h-4 w-4 object-contain' : 'h-[18px] w-[18px] object-contain'} />
        <span>{dexName}</span>
      </span>
    </span>
  );
}
