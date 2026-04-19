'use client';

import { useEffect, useRef, useState } from 'react';

type ToastDetail = {
  title: string;
  description?: string;
};

type ToastState = ToastDetail & {
  id: number;
};

export function ToastViewport() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };

    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastDetail>;
      const detail = customEvent.detail;

      if (!detail?.title) return;

      clearTimers();
      setToast({
        id: Date.now(),
        title: detail.title,
        description: detail.description,
      });
      setVisible(true);

      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, 9200);

      removeTimerRef.current = setTimeout(() => {
        setToast(null);
      }, 9550);
    };

    window.addEventListener('arca:toast', handleToast as EventListener);

    return () => {
      clearTimers();
      window.removeEventListener('arca:toast', handleToast as EventListener);
    };
  }, []);

  const dismissToast = () => {
    setVisible(false);
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    removeTimerRef.current = setTimeout(() => setToast(null), 280);
  };

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[10000] flex justify-center px-4">
      <div
        className={`pointer-events-auto relative flex w-full max-w-[460px] items-center gap-4 rounded-[20px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(18,24,31,0.94),rgba(14,20,27,0.9)_48%,rgba(11,16,22,0.96))] px-5 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,255,136,0.04)] backdrop-blur-xl transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <span className="pointer-events-none absolute inset-x-[18%] bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,136,0.22),transparent)]" />
        <button
          type="button"
          onClick={dismissToast}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-arca-text-tertiary transition-colors duration-200 hover:text-arca-text"
          aria-label="Dismiss notification"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-arca-green/[0.08]">
          <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_24px_rgba(236,242,248,0.14)]" />
          <svg className="h-5 w-5 text-arca-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="min-w-0 flex-1 pr-8">
          <p className="text-[17px] font-semibold tracking-tight text-arca-text">
            {toast.title}
          </p>
          {toast.description ? (
            <p className="mt-1 text-sm text-arca-text-secondary">
              {toast.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
