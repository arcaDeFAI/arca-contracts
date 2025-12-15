export function Skeleton({ className = "", width, height }: { className?: string, width?: string | number, height?: string | number }) {
    return (
        <div
            className={`bg-gray-800/50 animate-pulse rounded-md ${className}`}
            style={{
                width: width,
                height: height
            }}
        />
    );
}
