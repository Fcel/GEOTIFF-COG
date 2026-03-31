import { Crosshair, MapPin } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function PixelInspector() {
  const { pixelInfo, metadata } = useAppStore();

  if (!pixelInfo) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Crosshair className="w-5 h-5 text-gray-600" />
        <p className="text-xs text-gray-500">Click on the map to inspect pixel values</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Location */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <MapPin className="w-3 h-3 text-accent-400" />
        <span className="font-mono">
          {pixelInfo.lat.toFixed(6)}, {pixelInfo.lng.toFixed(6)}
        </span>
      </div>
      <div className="text-[10px] text-gray-500">
        Pixel ({pixelInfo.x}, {pixelInfo.y})
      </div>

      {/* Band values */}
      <div className="space-y-1">
        {pixelInfo.values.map((v, i) => {
          const isNoData = metadata?.noDataValue !== null &&
            metadata?.noDataValue !== undefined &&
            v === metadata.noDataValue;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-12">Band {i + 1}</span>
              <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                {!isNoData && (
                  <div
                    className="h-full bg-accent-500 rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((v - (metadata?.noDataValue ?? 0)) / 255) * 100))}%`,
                    }}
                  />
                )}
              </div>
              <span className={`text-xs font-mono w-20 text-right ${isNoData ? 'text-gray-600 italic' : 'text-gray-200'}`}>
                {isNoData ? 'nodata' : Number.isInteger(v) ? v : v.toFixed(4)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
