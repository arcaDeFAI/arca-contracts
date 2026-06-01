import type { ReactNode } from 'react';

type WalletNoticeProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function WalletNotice({
  title = 'Wallet Not Connected',
  children,
  className = 'mb-8',
}: WalletNoticeProps) {
  return (
    <div className={`${className} flex items-start gap-3 rounded-[20px] border border-amber-300/12 bg-white/[0.025] p-4 shadow-card backdrop-blur-sm animate-fade-in`}>
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-amber-300" aria-hidden="true">
        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </span>
      <div>
        <h3 className="text-amber-200 font-medium text-sm mb-0.5">{title}</h3>
        <p className="text-amber-100/65 text-xs leading-relaxed">
          {children}
        </p>
      </div>
    </div>
  );
}
