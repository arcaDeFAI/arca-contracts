import { useMetroPositionData } from "../hooks/use-metro-position-data";

interface PositionRangeIndicatorProps {
  vaultName: string;
}

function PositionRangeIndicator({ vaultName }: PositionRangeIndicatorProps) {
  const {
    data: positionData,
    isLoading,
    activeId,
    price,
  } = useMetroPositionData(vaultName);

  console.log("🎯 Position Range Indicator Render:", {
    vaultName,
    isMetroVault: vaultName.includes("S/USDC") && !vaultName.includes("CL"),
    positionData: !!positionData,
    isLoading,
    activeId,
  });

  // Only show for Metro vaults (S/USDC without CL)
  if (!vaultName.includes("S/USDC") || vaultName.includes("CL")) {
    console.log("🚫 Not a Metro vault, skipping range indicator:", vaultName);
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-2 w-2 animate-pulse rounded-full bg-muted"></div>
        Loading position range...
      </div>
    );
  }

  if (!positionData) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
        Position data unavailable
      </div>
    );
  }

  // Debug logging
  console.log("📊 Position Range Indicator:", {
    vaultName,
    activeId: positionData.activeId,
    range: `${positionData.lowerBin} - ${positionData.upperBin}`,
    positionStatus: positionData.isInRange
      ? "ACTIVE (In Range)"
      : "OUT OF RANGE",
    isInRange: positionData.isInRange,
    hasValidRange: positionData.lowerBin !== 0 || positionData.upperBin !== 0,
  });

  const rangePercentage =
    positionData.lowerBin && positionData.upperBin && positionData.activeId
      ? ((positionData.activeId - positionData.lowerBin) /
          (positionData.upperBin - positionData.lowerBin)) *
        100
      : 50;

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-arca-surface border border-arca-border rounded-md">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-arca-secondary">
          Metro Position
        </div>
        <div
          className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs ${
            positionData.isInRange
              ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          <div
            className={`h-1 w-1 rounded-full ${
              positionData.isInRange ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {positionData.isInRange ? "ACTIVE" : "OUT OF RANGE"}
        </div>
      </div>

      {/* Position Details - More compact layout */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col">
          <span className="text-arca-secondary text-xs">Bin ID</span>
          <span className="font-mono text-white font-medium">
            {positionData.activeId}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-arca-secondary text-xs">Range</span>
          <span className="font-mono text-white font-medium text-xs">
            {positionData.lowerBin || 0} - {positionData.upperBin || 0}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-arca-secondary text-xs">Price</span>
          <span className="font-mono text-white font-medium text-xs">
            {isLoading ? "Loading..." : `${price.formatted} USDC/S`}
          </span>
        </div>
      </div>

      {/* Range Progress Bar - More compact */}
      {positionData.isInRange && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs text-arca-secondary">
            <span>Within range</span>
            <span>{Math.round(rangePercentage)}%</span>
          </div>
          <div className="w-full bg-arca-border rounded-full h-1">
            <div
              className="bg-green-500 h-1 rounded-full transition-all duration-300 shadow-sm"
              style={{
                width: `${Math.max(5, Math.min(95, rangePercentage))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default PositionRangeIndicator;
export { PositionRangeIndicator };
