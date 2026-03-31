import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`bg-dark-700/50 rounded-lg p-2.5 border border-dark-600/50`}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-mono font-semibold ${color ?? 'text-gray-200'}`}>{value}</p>
    </div>
  );
}

function formatVal(n: number): string {
  if (Math.abs(n) >= 1e6) return n.toExponential(3);
  if (!Number.isInteger(n)) return n.toFixed(4);
  return n.toString();
}

export default function StatsPanel() {
  const { bandStats, polygonStats } = useAppStore();
  const [selectedBand, setSelectedBand] = useState(0);
  const [showPolygon, setShowPolygon] = useState(false);

  const displayStats = (showPolygon && polygonStats) ? polygonStats : bandStats;
  const stats = displayStats[selectedBand];

  if (!bandStats.length) return (
    <div className="text-center py-8">
      <BarChart3 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
      <p className="text-xs text-gray-500">Load a GeoTIFF to see band statistics</p>
    </div>
  );

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Band tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {displayStats.map((_s, i) => (
          <button
            key={i}
            onClick={() => setSelectedBand(i)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedBand === i
                ? 'bg-accent-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:text-gray-200 hover:bg-dark-600'
            }`}
          >
            Band {i + 1}
          </button>
        ))}
        {polygonStats && (
          <button
            onClick={() => setShowPolygon(!showPolygon)}
            className={`ml-auto px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              showPolygon
                ? 'bg-purple-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:text-purple-400'
            }`}
          >
            {showPolygon ? 'Polygon' : 'Polygon stats'}
          </button>
        )}
      </div>

      {stats && (
        <>
          {/* Main stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Min" value={formatVal(stats.min)} color="text-blue-400" />
            <StatCard label="Max" value={formatVal(stats.max)} color="text-red-400" />
            <StatCard label="Mean" value={formatVal(stats.mean)} color="text-green-400" />
            <StatCard label="Median" value={formatVal(stats.median)} color="text-yellow-400" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Std Dev" value={formatVal(stats.stdDev)} />
            <StatCard label="Range" value={formatVal(stats.max - stats.min)} />
          </div>

          {/* Coverage bar */}
          <div className="bg-dark-700/50 rounded-lg p-3 border border-dark-600/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Valid pixels</span>
              <span className="text-xs text-gray-200 font-mono">
                {stats.validCount.toLocaleString()} / {(stats.validCount + stats.noDataCount).toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-500 rounded-full transition-all"
                style={{
                  width: `${(stats.validCount / (stats.validCount + stats.noDataCount)) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-500">
                {((stats.validCount / (stats.validCount + stats.noDataCount)) * 100).toFixed(1)}% valid
              </span>
              <span className="text-[10px] text-gray-500">
                {stats.noDataCount.toLocaleString()} no-data
              </span>
            </div>
          </div>

          {/* Distribution visualization */}
          <div className="bg-dark-700/50 rounded-lg p-3 border border-dark-600/50">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Distribution</p>
            <div className="space-y-1">
              {[
                { label: 'Min', val: stats.min, pct: 0 },
                { label: 'Mean−σ', val: stats.mean - stats.stdDev, pct: (stats.mean - stats.stdDev - stats.min) / (stats.max - stats.min || 1) },
                { label: 'Mean', val: stats.mean, pct: (stats.mean - stats.min) / (stats.max - stats.min || 1) },
                { label: 'Mean+σ', val: stats.mean + stats.stdDev, pct: (stats.mean + stats.stdDev - stats.min) / (stats.max - stats.min || 1) },
                { label: 'Max', val: stats.max, pct: 1 },
              ].map(({ label, val, pct }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-14 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-400/60 rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono w-16 text-right flex-shrink-0">
                    {formatVal(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
