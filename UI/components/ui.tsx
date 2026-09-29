'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-white/[0.06] bg-arca-gray', className)}>{children}</div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-arca-green text-arca-dark hover:bg-arca-green/90',
  secondary: 'bg-white/[0.06] text-arca-text hover:bg-white/[0.1]',
  ghost: 'text-arca-text-secondary hover:text-arca-text hover:bg-white/[0.04]',
};

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        BUTTON_STYLES[variant],
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Brand-styled "Connect wallet" that opens the RainbowKit modal. */
export function ConnectWalletButton({ className }: { className?: string }) {
  const { openConnectModal } = useConnectModal();
  return (
    <Button className={className} onClick={openConnectModal} disabled={!openConnectModal}>
      Connect wallet
    </Button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    />
  );
}

/** Pill-style segmented control, used for tabs and range pickers. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className="inline-flex rounded-xl bg-white/[0.04] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-1.5 text-sm',
            o.value === value ? 'bg-white/[0.08] text-arca-text' : 'text-arca-text-secondary hover:text-arca-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  accent = false,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-arca-text-secondary">{label}</div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div className={cn('text-xl font-semibold tabular-nums sm:text-2xl', accent ? 'text-arca-green' : 'text-arca-text')}>
          {value}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-white/[0.06]', className)} />;
}

export function PairIcons({ logoX, logoY, size = 32 }: { logoX: string; logoY: string; size?: number }) {
  return (
    <div className="flex shrink-0 items-center">
      <img src={logoX} alt="" width={size} height={size} className="rounded-full ring-2 ring-arca-gray" />
      <img
        src={logoY}
        alt=""
        width={size}
        height={size}
        className="rounded-full ring-2 ring-arca-gray"
        style={{ marginLeft: -size * 0.35 }}
      />
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-xl px-3.5 py-3 text-xs leading-relaxed',
        tone === 'info' && 'bg-white/[0.04] text-arca-text-secondary',
        tone === 'warn' && 'bg-amber-500/[0.08] text-amber-300/90',
        tone === 'error' && 'bg-red-500/[0.08] text-red-300',
      )}
    >
      {children}
    </div>
  );
}
