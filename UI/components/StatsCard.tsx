import { ReactNode } from 'react';

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
    return (
        <div className={`relative bg-arca-gray/80 backdrop-blur-sm rounded-2xl p-4 md:p-5 h-full flex flex-col gap-2 border border-white/[0.04] shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-white/[0.07] ${className}`}>
            {/* Header row */}
            <div className="flex justify-between items-start">
                <div className="text-arca-text-secondary text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                    {title}
                </div>
                <div className="flex items-center gap-2">
                    {rightElement}
                    {icon && <div className="text-arca-text-tertiary">{icon}</div>}
                </div>
            </div>

            {/* Value */}
            <div>
                <div className="text-2xl md:text-[28px] font-bold text-arca-text tracking-tight leading-tight">
                    {loading ? (
                        <div className="h-8 w-28 bg-white/[0.04] animate-pulse rounded-lg" />
                    ) : (
                        value
                    )}
                </div>
                {subtitle && (
                    <div className="text-xs text-arca-text-tertiary mt-1">{subtitle}</div>
                )}
            </div>

            {/* Trend */}
            {trend && !loading && (
                <div className={`flex items-center gap-1.5 text-xs font-medium ${trend.positive ? 'text-arca-green-muted' : 'text-red-400'}`}>
                    <span>
                        {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
                    </span>
                    <span className="text-arca-text-tertiary">{trend.label}</span>
                </div>
            )}

            {/* Children slot */}
            {children && <div className="mt-2 pt-3 border-t border-white/[0.04]">{children}</div>}
        </div>
    );
}
