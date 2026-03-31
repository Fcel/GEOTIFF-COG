import { useState } from 'react';
import { Calculator, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { BAND_MATH_PRESETS, evaluateBandMath, resultToImageData } from '../utils/bandMath';
import { COLORMAPS } from '../utils/colormaps';

export default function BandMathPanel() {
  const store = useAppStore();
  const { tiff, metadata } = store;
  const [preset, setPreset] = useState(BAND_MATH_PRESETS[0]);
  const [formula, setFormula] = useState(preset.formula);
  const [colormap, setColormap] = useState(preset.colormap);
  const [rangeMin, setRangeMin] = useState(preset.range[0]);
  const [rangeMax, setRangeMax] = useState(preset.range[1]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const handlePreset = (p: typeof BAND_MATH_PRESETS[0]) => {
    setPreset(p);
    setFormula(p.formula);
    setColormap(p.colormap);
    setRangeMin(p.range[0]);
    setRangeMax(p.range[1]);
  };

  const handleRun = async () => {
    if (!tiff || !metadata) return;
    setRunning(true);
    setStatus(null);
    try {
      const { result, width, height } = await evaluateBandMath(tiff, formula, metadata.bandCount);
      const lut = COLORMAPS[colormap]?.lut ?? COLORMAPS.viridis.lut;
      const imageData = resultToImageData(result, width, height, rangeMin, rangeMax, lut, store.renderSettings.opacity);
      store.setRenderedBandMath(imageData);
      store.setBandMathStats({ min: rangeMin, max: rangeMax });
      setStatus({ ok: true, msg: 'Band math applied to map' });
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : 'Error evaluating formula' });
    } finally {
      setRunning(false);
    }
  };

  const handleClear = () => {
    store.setRenderedBandMath(null);
    store.setBandMathStats(null);
    setStatus(null);
  };

  if (!tiff) {
    return (
      <div className="text-center py-8">
        <Calculator className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-gray-500">Load a GeoTIFF to use band math</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Preset buttons */}
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Presets</p>
        <div className="grid grid-cols-2 gap-1.5">
          {BAND_MATH_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePreset(p)}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                preset.id === p.id
                  ? 'bg-accent-500 text-white'
                  : 'bg-dark-700 text-gray-400 hover:text-gray-200 hover:bg-dark-600'
              }`}
            >
              <span className="font-semibold">{p.name}</span>
              {p.id !== 'custom' && (
                <span className={`block text-[10px] mt-0.5 ${preset.id === p.id ? 'text-blue-200' : 'text-gray-500'}`}>
                  {p.description.split('—')[0].trim()}
                </span>
              )}
            </button>
          ))}
        </div>
        {preset.id !== 'custom' && (
          <p className="text-[10px] text-gray-500 mt-2 p-2 bg-dark-700/50 rounded-lg">{preset.description}</p>
        )}
      </div>

      {/* Formula editor */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">
          Formula — use b1, b2, b3... for bands
        </label>
        <textarea
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          rows={3}
          className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-400/30 resize-none"
          placeholder="(b4 - b3) / (b4 + b3)"
        />
        <p className="text-[10px] text-gray-600 mt-1">
          Available: Math.abs, Math.sqrt, Math.log, +, -, *, /
        </p>
      </div>

      {/* Colormap and range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Colormap</label>
          <select
            value={colormap}
            onChange={(e) => setColormap(e.target.value)}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent-400"
          >
            {Object.entries(COLORMAPS).map(([id, { name }]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Range</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={rangeMin}
              onChange={(e) => setRangeMin(Number(e.target.value))}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent-400"
              placeholder="Min"
            />
            <span className="text-gray-500 text-xs">–</span>
            <input
              type="number"
              value={rangeMax}
              onChange={(e) => setRangeMax(Number(e.target.value))}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent-400"
              placeholder="Max"
            />
          </div>
        </div>
      </div>

      {/* Colormap preview */}
      <div
        className="h-4 rounded-lg overflow-hidden border border-dark-600/50"
        style={{
          background: `linear-gradient(to right, ${COLORMAPS[colormap]?.lut
            .filter((_, i, arr) => i % Math.floor(arr.length / 10) === 0)
            .map(([r, g, b]) => `rgb(${r},${g},${b})`)
            .join(', ') ?? '#fff, #000'})`,
        }}
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleRun}
          disabled={running || !formula.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          {running ? 'Computing...' : 'Run'}
        </button>
        {store.renderedBandMath && (
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-400 text-xs font-medium transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Status */}
      {status && (
        <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
          status.ok
            ? 'bg-green-500/10 border border-green-500/30 text-green-300'
            : 'bg-red-500/10 border border-red-500/30 text-red-300'
        }`}>
          {status.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {status.msg}
        </div>
      )}
    </div>
  );
}
