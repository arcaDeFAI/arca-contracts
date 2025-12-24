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
    // Glassmorphism: bg-arca-gray with slight opacity and blur
    const CardContent = (
        <div className={`relative bg-arca-gray/95 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 md:p-5 h-full flex flex-col gap-3 transition-all hover:border-gray-700/80 ${className}`}>
            <div className="flex justify-between items-start mb-2">
                <div className="text-gray-400 text-sm font-medium flex items-center gap-2">
                    {title}
                </div>
                <div className="flex items-center gap-2">
                    {rightElement}
                    {icon && <div className="text-gray-500 opacity-80">{icon}</div>}
                </div>
            </div>

            <div>
                <div className="text-2xl md:text-3xl font-bold text-arca-green tracking-tight">
                    {loading ? (
                        <div className="h-8 w-32 bg-gray-800/50 animate-pulse rounded" />
                    ) : (
                        value
                    )}
                </div>
                {subtitle && (
                    <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
                )}
            </div>

            {trend && !loading && (
                <div className={`flex items-center gap-1.5 mt-3 text-sm ${trend.positive ? 'text-arca-green' : 'text-red-400'}`}>
                    <span className="font-semibold">
                        {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
                    </span>
                    <span className="text-gray-500 text-xs">{trend.label}</span>
                </div>
            )}

            {children && <div className="mt-4 pt-3 border-t border-gray-800/50">{children}</div>}
        </div>
    );

    return CardContent;
}
