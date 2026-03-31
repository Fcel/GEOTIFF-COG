import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const { darkMode } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Parse URL params on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    if (url) {
      // Auto-load from URL param
      import('./utils/geotiffUtils').then(async ({ loadGeoTiffFromUrl, getMetadata, computeBandStats, computeHistogram, renderToImageData }) => {
        const { applyColormap } = await import('./utils/colormaps');
        const store = useAppStore.getState();
        store.setLoading(true);
        try {
          const tiff = await loadGeoTiffFromUrl(url);
          const meta = await getMetadata(tiff);
          store.setMetadata(meta);
          store.setTiff(tiff);
          const statsList = [];
          const histList = [];
          for (let b = 0; b < Math.min(meta.bandCount, 10); b++) {
            const s = await computeBandStats(tiff, b, meta.noDataValue);
            statsList.push(s);
            histList.push(await computeHistogram(tiff, b, s));
          }
          store.setBandStats(statsList);
          store.setHistograms(histList);
          const colormap = (v: number, min: number, max: number) => applyColormap(v, min, max, 'grayscale');
          const result = await renderToImageData(tiff, {
            bands: meta.bandCount >= 3 ? [0, 1, 2] : [0],
            colormap: meta.bandCount < 3 ? colormap : undefined,
            mins: statsList.slice(0, 3).map(s => s.min),
            maxs: statsList.slice(0, 3).map(s => s.max),
            noDataValue: meta.noDataValue,
          });
          store.setRenderedImageData(result.imageData);
        } catch (e) {
          store.setError(e instanceof Error ? e.message : 'Failed to load from URL');
        } finally {
          store.setLoading(false);
        }
      });
    }
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-900">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        <MapView />
      </main>
    </div>
  );
}
