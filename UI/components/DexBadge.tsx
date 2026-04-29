import { cn } from '@/lib/utils';

interface DexBadgeProps {
  name: string;
  compact?: boolean;
  className?: string;
}

export function DexBadge({ name, compact = false, className }: DexBadgeProps) {
  const isShadow = name.includes('Shadow');
  const dexName = isShadow ? 'Shadow' : 'Metropolis';
  const dexLogo = isShadow ? '/shadow-logo.png' : '/metropolis-logo.png';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium backdrop-blur-md',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        compact ? 'gap-1.5 px-2 py-1 text-[9px] tracking-[0.08em]' : 'gap-2 px-2.5 py-1.5 text-[10px] tracking-[0.1em]',
        isShadow
          ? 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
          : 'border-indigo-300/20 bg-indigo-300/[0.08] text-indigo-100',
        className,
      )}
    >
      <img src={dexLogo} alt="" aria-hidden="true" className={compact ? 'size-4 object-contain' : 'size-[18px] object-contain'} />
      <span>{dexName}</span>
    </span>
  );
}
