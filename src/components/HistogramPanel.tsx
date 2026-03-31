import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: { min: number; max: number; count: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { min, max, count } = payload[0].payload;
  return (
    <div className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400">Range: <span className="text-gray-200 font-mono">{min.toFixed(4)} – {max.toFixed(4)}</span></p>
      <p className="text-gray-400">Count: <span className="text-accent-400 font-mono">{count.toLocaleString()}</span></p>
    </div>
  );
}

export default function HistogramPanel() {
  const { histograms, bandStats } = useAppStore();
  const [selectedBand, setSelectedBand] = useState(0);
  const [logScale, setLogScale] = useState(false);

  if (!histograms.length) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-gray-500">Load a GeoTIFF to see histograms</p>
      </div>
    );
  }

  const hist = histograms[selectedBand];
  const stats = bandStats[selectedBand];
  const data = hist?.buckets.map((b) => ({
    ...b,
    count: logScale ? (b.count > 0 ? Math.log10(b.count) : 0) : b.count,
    rawCount: b.count,
  }));

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Band tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {histograms.map((_, i) => (
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
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={logScale}
            onChange={(e) => setLogScale(e.target.checked)}
            className="accent-accent-500"
          />
          Log scale
        </label>
      </div>

      {/* Chart */}
      <div className="bg-dark-700/30 rounded-xl p-3 border border-dark-600/40">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#30363d" vertical={false} />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 9, fill: '#6e7681' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#6e7681' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => logScale ? `10^${v.toFixed(1)}` : v > 999 ? `${(v / 1000).toFixed(0)}k` : v}
            />
            <Tooltip content={<CustomTooltip />} />
            {stats && (
              <>
                <ReferenceLine
                  x={stats.mean.toFixed(4)}
                  stroke="#58a6ff"
                  strokeDasharray="4 2"
                  label={{ value: 'μ', fill: '#58a6ff', fontSize: 10, position: 'top' }}
                />
                <ReferenceLine
                  x={(stats.mean - stats.stdDev).toFixed(4)}
                  stroke="#484f58"
                  strokeDasharray="3 3"
                />
                <ReferenceLine
                  x={(stats.mean + stats.stdDev).toFixed(4)}
                  stroke="#484f58"
                  strokeDasharray="3 3"
                />
              </>
            )}
            <Bar
              dataKey="count"
              fill="#1f6feb"
              radius={[2, 2, 0, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-gray-500 text-center mt-1">
          {logScale ? 'Log₁₀ frequency' : 'Pixel frequency'} · Blue line = mean ± σ
        </p>
      </div>

      {/* Summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-dark-700/50 rounded-lg p-2 text-center border border-dark-600/50">
            <p className="text-[10px] text-gray-500">Min</p>
            <p className="text-xs font-mono text-blue-400">{stats.min.toFixed(3)}</p>
          </div>
          <div className="bg-dark-700/50 rounded-lg p-2 text-center border border-dark-600/50">
            <p className="text-[10px] text-gray-500">Mean</p>
            <p className="text-xs font-mono text-accent-400">{stats.mean.toFixed(3)}</p>
          </div>
          <div className="bg-dark-700/50 rounded-lg p-2 text-center border border-dark-600/50">
            <p className="text-[10px] text-gray-500">Max</p>
            <p className="text-xs font-mono text-red-400">{stats.max.toFixed(3)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
