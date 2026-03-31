import React, { useRef, useState, useCallback } from 'react';
import { Link, X, FileImage, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { loadGeoTiffFromFile, loadGeoTiffFromUrl, getMetadata, computeBandStats, computeHistogram } from '../utils/geotiffUtils';
import { applyColormap } from '../utils/colormaps';
import { renderToImageData } from '../utils/geotiffUtils';

export default function FileUpload() {
  const [dragging, setDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const store = useAppStore();

  const processGeoTiff = useCallback(async (tiff: Awaited<ReturnType<typeof loadGeoTiffFromFile>>, file?: File) => {
    store.setLoading(true);
    store.setError(null);
    try {
      const meta = await getMetadata(tiff, file);
      store.setMetadata(meta);
      store.setTiff(tiff);

      // Compute stats for all bands (cap at 10 for performance)
      const statsList = [];
      const histList = [];
      const bandsToProcess = Math.min(meta.bandCount, 10);
      for (let b = 0; b < bandsToProcess; b++) {
        const s = await computeBandStats(tiff, b, meta.noDataValue);
        statsList.push(s);
        const h = await computeHistogram(tiff, b, s);
        histList.push(h);
      }
      store.setBandStats(statsList);
      store.setHistograms(histList);

      // Determine render mode
      const colormap = (v: number, min: number, max: number) => applyColormap(v, min, max, 'grayscale');
      let rendered: ImageData;
      if (meta.bandCount >= 3) {
        const r = statsList[0];
        const g = statsList[1];
        const bStat = statsList[2];
        const result = await renderToImageData(tiff, {
          bands: [0, 1, 2],
          mins: [r.min, g.min, bStat.min],
          maxs: [r.max, g.max, bStat.max],
          noDataValue: meta.noDataValue,
          opacity: 1,
        });
        rendered = result.imageData;
        store.setRenderSettings({ mode: 'rgb', rBand: 0, gBand: 1, bBand: 2 });
      } else {
        const s = statsList[0];
        const result = await renderToImageData(tiff, {
          bands: [0],
          colormap,
          mins: [s.min],
          maxs: [s.max],
          noDataValue: meta.noDataValue,
          opacity: 1,
        });
        rendered = result.imageData;
        store.setRenderSettings({ mode: 'singleband', selectedBand: 0, stretchMin: s.min, stretchMax: s.max });
      }

      store.setRenderedImageData(rendered);
      store.setActivePanel('info');
    } catch (e) {
      store.setError(e instanceof Error ? e.message : 'Failed to load GeoTIFF');
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(tif|tiff)$/i)) {
      store.setError('Please upload a .tif or .tiff file');
      return;
    }
    store.reset();
    store.setLoading(true);
    try {
      const tiff = await loadGeoTiffFromFile(file);
      await processGeoTiff(tiff, file);
    } catch (e) {
      store.setError(e instanceof Error ? e.message : 'Failed to load file');
      store.setLoading(false);
    }
  }, [processGeoTiff, store]);

  const handleUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    store.reset();
    store.setLoading(true);
    try {
      const tiff = await loadGeoTiffFromUrl(urlInput.trim());
      await processGeoTiff(tiff);
    } catch (e) {
      store.setError(e instanceof Error ? e.message : 'Failed to load URL');
      store.setLoading(false);
    }
  }, [urlInput, processGeoTiff, store]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
          ${dragging
            ? 'border-accent-400 bg-accent-500/10 scale-[1.01]'
            : 'border-dark-500 hover:border-accent-400/60 hover:bg-dark-700/50'
          }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".tif,.tiff"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div className="flex flex-col items-center gap-2">
          {store.isLoading ? (
            <Loader2 className="w-8 h-8 text-accent-400 animate-spin" />
          ) : (
            <div className="p-3 rounded-full bg-dark-700 border border-dark-500">
              <FileImage className="w-6 h-6 text-accent-400" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-200">
              {store.isLoading ? 'Processing...' : 'Drop GeoTIFF here'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">.tif / .tiff · COG supported</p>
          </div>
          {!store.isLoading && (
            <button className="mt-1 px-3 py-1 text-xs rounded-lg bg-accent-500 hover:bg-accent-600 text-white font-medium transition-colors">
              Browse files
            </button>
          )}
        </div>
      </div>

      {/* URL loader */}
      <div>
        <button
          onClick={() => setShowUrl(!showUrl)}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-accent-400 transition-colors w-full"
        >
          <Link className="w-3.5 h-3.5" />
          <span>Load from URL (COG / remote)</span>
          <span className="ml-auto">{showUrl ? '▲' : '▼'}</span>
        </button>
        {showUrl && (
          <div className="mt-2 flex gap-2 animate-slide-up">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrl()}
              placeholder="https://example.com/file.tif"
              className="flex-1 text-xs bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-400/30"
            />
            <button
              onClick={handleUrl}
              disabled={store.isLoading || !urlInput.trim()}
              className="px-3 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              Load
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {store.error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 animate-fade-in">
          <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{store.error}</p>
        </div>
      )}
    </div>
  );
}
