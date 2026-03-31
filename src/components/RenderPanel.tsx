import { useCallback } from 'react';
import { Layers } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { COLORMAPS, applyColormap } from '../utils/colormaps';
import { renderToImageData } from '../utils/geotiffUtils';
import type { RenderMode } from '../types';

export default function RenderPanel() {
  const store = useAppStore();
  const { metadata, tiff, bandStats, renderSettings } = store;

  const applyRender = useCallback(async () => {
    if (!tiff || !metadata || !bandStats.length) return;
    store.setLoading(true);
    try {
      const { mode, selectedBand, rBand, gBand, bBand, colorMapId, stretchMin, stretchMax, opacity, noDataTransparent } = renderSettings;
      const colormap = (v: number, min: number, max: number) => applyColormap(v, min, max, colorMapId);

      let result: { imageData: ImageData };
      if (mode === 'rgb' && metadata.bandCount >= 3) {
        const s = [bandStats[rBand], bandStats[gBand], bandStats[bBand]];
        result = await renderToImageData(tiff, {
          bands: [rBand, gBand, bBand],
          mins: s.map(x => x.min),
          maxs: s.map(x => x.max),
          noDataValue: noDataTransparent ? metadata.noDataValue : undefined,
          opacity,
        });
      } else {
        const s = bandStats[selectedBand];
        result = await renderToImageData(tiff, {
          bands: [selectedBand],
          colormap,
          mins: [stretchMin ?? s.min],
          maxs: [stretchMax ?? s.max],
          noDataValue: noDataTransparent ? metadata.noDataValue : undefined,
          opacity,
        });
      }
      store.setRenderedImageData(result.imageData);
      store.setRenderedBandMath(null);
    } catch (e) {
      store.setError(e instanceof Error ? e.message : 'Render failed');
    } finally {
      store.setLoading(false);
    }
  }, [tiff, metadata, bandStats, renderSettings, store]);

  if (!metadata) return null;

  const { mode, selectedBand, colorMapId, stretchMin, stretchMax, opacity } = renderSettings;
  const currentStats = bandStats[selectedBand];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Render mode */}
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Render Mode</p>
        <div className="flex gap-1">
          {(['singleband', ...(metadata.bandCount >= 3 ? ['rgb'] : [])] as RenderMode[]).map((m) => (
            <button
              key={m}
              onClick={() => store.setRenderSettings({ mode: m })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-accent-500 text-white'
                  : 'bg-dark-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {m === 'singleband' ? 'Single Band' : 'RGB'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'singleband' && (
        <>
          {/* Band selector */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Band</label>
            <select
              value={selectedBand}
              onChange={(e) => {
                const b = Number(e.target.value);
                const s = bandStats[b];
                store.setRenderSettings({ selectedBand: b, stretchMin: s?.min, stretchMax: s?.max });
              }}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-accent-400"
            >
              {Array.from({ length: metadata.bandCount }, (_, i) => (
                <option key={i} value={i}>Band {i + 1}</option>
              ))}
            </select>
          </div>

          {/* Colormap */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Colormap</label>
            <select
              value={colorMapId}
              onChange={(e) => store.setRenderSettings({ colorMapId: e.target.value })}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-accent-400"
            >
              {Object.entries(COLORMAPS).map(([id, { name }]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            {/* Colormap preview */}
            <div
              className="mt-2 h-4 rounded-lg overflow-hidden border border-dark-600/50"
              style={{
                background: `linear-gradient(to right, ${COLORMAPS[colorMapId]?.lut
                  .filter((_, i, arr) => i % Math.floor(arr.length / 12) === 0)
                  .map(([r, g, b]) => `rgb(${r},${g},${b})`)
                  .join(', ')})`,
              }}
            />
          </div>

          {/* Stretch */}
          {currentStats && (
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Stretch</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={stretchMin ?? currentStats.min}
                  onChange={(e) => store.setRenderSettings({ stretchMin: Number(e.target.value) })}
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent-400"
                />
                <span className="text-gray-500 text-xs">–</span>
                <input
                  type="number"
                  value={stretchMax ?? currentStats.max}
                  onChange={(e) => store.setRenderSettings({ stretchMax: Number(e.target.value) })}
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent-400"
                />
              </div>
              <button
                onClick={() => store.setRenderSettings({ stretchMin: currentStats.min, stretchMax: currentStats.max })}
                className="text-[10px] text-accent-400 hover:text-accent-300 mt-1 transition-colors"
              >
                Reset to min/max
              </button>
            </div>
          )}
        </>
      )}

      {mode === 'rgb' && metadata.bandCount >= 3 && (
        <div className="space-y-2">
          {(['rBand', 'gBand', 'bBand'] as const).map((ch, ci) => (
            <div key={ch} className="flex items-center gap-2">
              <span className={`w-12 text-xs font-semibold ${['text-red-400', 'text-green-400', 'text-blue-400'][ci]}`}>
                {['Red', 'Green', 'Blue'][ci]}
              </span>
              <select
                value={renderSettings[ch]}
                onChange={(e) => store.setRenderSettings({ [ch]: Number(e.target.value) })}
                className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent-400"
              >
                {Array.from({ length: metadata.bandCount }, (_, i) => (
                  <option key={i} value={i}>Band {i + 1}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Opacity */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Opacity</label>
          <span className="text-xs text-gray-300 font-mono">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={opacity}
          onChange={(e) => store.setRenderSettings({ opacity: Number(e.target.value) })}
          className="w-full h-1.5 accent-accent-500 cursor-pointer"
        />
      </div>

      {/* No-data toggle */}
      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={renderSettings.noDataTransparent}
          onChange={(e) => store.setRenderSettings({ noDataTransparent: e.target.checked })}
          className="accent-accent-500"
        />
        Transparent no-data pixels
      </label>

      {/* Apply button */}
      <button
        onClick={applyRender}
        disabled={store.isLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
      >
        <Layers className="w-4 h-4" />
        Apply Render
      </button>
    </div>
  );
}
