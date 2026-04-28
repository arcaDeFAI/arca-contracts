'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

interface StatsCardProps {
    title: string | ReactNode;
    value: string | ReactNode;
    subtitle?: string | ReactNode;
    icon?: ReactNode;
    rightElement?: ReactNode;
    trend?: {
        value: number;
        label: string;
        positive?: boolean;
    };
    loading?: boolean;
    className?: string;
    children?: ReactNode;
}

function AnimatedMetricValue({ value }: { value: string | number }) {
    const textValue = useMemo(() => String(value), [value]);
    const [displayValue, setDisplayValue] = useState(textValue);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        setIsAnimating(false);

        const frameA = requestAnimationFrame(() => {
            setDisplayValue(textValue);

            const frameB = requestAnimationFrame(() => {
                setIsAnimating(true);
            });

            return () => cancelAnimationFrame(frameB);
        });

        return () => cancelAnimationFrame(frameA);
    }, [textValue]);

    const chars = displayValue.split('');

    return (
        <span className={`t-digit-group ${isAnimating ? 'is-animating' : ''}`} aria-label={displayValue}>
            {chars.map((char, index) => {
                const isLast = index === chars.length - 1;
                const isSecondLast = index === chars.length - 2;
                const stagger =
                    isSecondLast && chars.length > 1
                        ? '1'
                        : isLast && chars.length > 1
                          ? '2'
                          : undefined;

                return (
                    <span
                        key={`${displayValue}-${index}-${char}`}
                        className="t-digit"
                        data-stagger={stagger}
                        aria-hidden="true"
                    >
                        {char === ' ' ? '\u00A0' : char}
                    </span>
                );
            })}
        </span>
    );
}

export function StatsCard({
    title,
    value,
    subtitle,
    icon,
    rightElement,
    trend,
    loading = false,
    className = "",
    children
}: StatsCardProps) {
    const isAnimatableValue = typeof value === 'string' || typeof value === 'number';

    return (
        <div
            className={`relative h-full rounded-2xl border border-white/[0.04] bg-arca-gray/80 backdrop-blur-sm shadow-card transition-all duration-300 hover:border-white/[0.07] hover:shadow-card-hover ${className}`}
        >
            <div className="flex h-full items-start justify-between gap-4 px-4 py-3 md:grid md:grid-cols-[1fr_auto] md:grid-rows-[auto_1fr] md:gap-x-4 md:gap-y-2 md:px-5 md:py-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 md:items-start">
                        <div className="min-w-0 text-[11px] font-medium uppercase tracking-[0.16em] text-arca-text-secondary flex items-center gap-1.5">
                            {title}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
                            {rightElement}
                            {icon && <div className="text-arca-text-tertiary">{icon}</div>}
                        </div>
                    </div>

                    {subtitle && (
                        <div className="mt-1 text-[11px] text-arca-text-tertiary md:text-xs">
                            {subtitle}
                        </div>
                    )}

                    {trend && !loading && (
                        <div className={`mt-1 flex items-center gap-1.5 text-[11px] font-medium md:text-xs ${trend.positive ? 'text-arca-green-muted' : 'text-red-400'}`}>
                            <span>
                                {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
                            </span>
                            <span className="text-arca-text-tertiary">{trend.label}</span>
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 flex-col items-end text-right md:col-start-2 md:row-start-1 md:items-end md:self-start">
                    <div className="hidden items-center gap-2 md:flex">
                        {rightElement}
                        {icon && <div className="text-arca-text-tertiary">{icon}</div>}
                    </div>
                </div>

                <div className="flex shrink-0 flex-col items-end self-end text-right md:col-start-1 md:row-start-2 md:w-full md:items-start md:self-end md:text-left">
                    <div className="mt-0.5 text-[1.1rem] font-semibold leading-none tracking-[-0.03em] text-arca-text md:mt-1 md:text-[2rem] lg:text-[2.15rem]">
                        {loading ? (
                            <div className="h-7 w-20 rounded-lg bg-white/[0.04] animate-pulse md:h-8 md:w-28" />
                        ) : isAnimatableValue ? (
                            <AnimatedMetricValue value={value as string | number} />
                        ) : (
                            value
                        )}
                    </div>
                </div>
            </div>

            {children && (
                <div className="mx-4 mt-1 border-t border-white/[0.04] pt-3 md:mx-5 md:mt-2">
                    {children}
                </div>
            )}
        </div>
    );
}
