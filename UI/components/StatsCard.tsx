import { ReactNode } from 'react';

interface StatsCardProps {
    title: string | ReactNode;
    value: string | ReactNode;
    subtitle?: string | ReactNode; // e.g. "Total TVL"
    icon?: ReactNode;
    rightElement?: ReactNode; // For dropdowns or actions
    trend?: {
        value: number; // e.g. 5.2
        label: string; // e.g. "vs last week"
        positive?: boolean;
    };
    loading?: boolean;
    className?: string;
    children?: ReactNode; // For "More Info" or charts
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
    const CardContent = (
        <div className={`relative bg-arca-card backdrop-blur-sm border border-arca-border rounded-xl p-4 md:p-5 h-full flex flex-col gap-3 transition-all hover:border-arca-border-light hover:bg-arca-card-hover hover-lift animate-fadeIn ${className}`}>
            <div className="flex justify-between items-start mb-2">
                <div className="text-arca-text-secondary text-sm font-medium flex items-center gap-2">
                    {title}
                </div>
                <div className="flex items-center gap-2">
                    {rightElement}
                    {icon && <div className="text-arca-text-muted">{icon}</div>}
                </div>
            </div>

            <div>
                <div className="text-2xl md:text-3xl font-bold text-arca-green tracking-tight">
                    {loading ? (
                        <div className="h-8 w-32 bg-arca-border rounded shimmer" />
                    ) : (
                        value
                    )}
                </div>
                {subtitle && (
                    <div className="text-xs text-arca-text-muted mt-1">{subtitle}</div>
                )}
            </div>

            {trend && !loading && (
                <div className={`flex items-center gap-1.5 mt-3 text-sm ${trend.positive ? 'text-arca-green' : 'text-red-400'}`}>
                    <span className="font-semibold">
                        {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
                    </span>
                    <span className="text-arca-text-muted text-xs">{trend.label}</span>
                </div>
            )}

            {children && <div className="mt-4 pt-3 border-t border-arca-border">{children}</div>}
        </div>
    );

    return CardContent;
}
