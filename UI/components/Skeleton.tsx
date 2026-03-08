export function Skeleton({ className = "", width, height }: { className?: string, width?: string | number, height?: string | number }) {
    return (
        <div
            className={`bg-arca-border rounded-md shimmer ${className}`}
            style={{
                width: width,
                height: height
            }}
        />
    );
}
