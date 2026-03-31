import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../store/useAppStore';
import { latLngToPixel, getPixelValues } from '../utils/geotiffUtils';
import { Loader2, Layers, Map as MapIcon, ZoomIn } from 'lucide-react';

const BASEMAPS = {
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri',
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO',
  },
  light: {
    name: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO',
  },
  topo: {
    name: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap',
  },
};

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const bandMathOverlayRef = useRef<L.ImageOverlay | null>(null);
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('dark');
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const store = useAppStore();
  const { metadata, renderedImageData, renderedBandMath, isLoading, tiff, showPixelInspector } = store;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    const tile = L.tileLayer(BASEMAPS[basemap].url, {
      attribution: BASEMAPS[basemap].attribution,
      maxZoom: 20,
    }).addTo(map);
    baseTileRef.current = tile;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Change basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseTileRef.current) {
      baseTileRef.current.remove();
    }
    const tile = L.tileLayer(BASEMAPS[basemap].url, {
      attribution: BASEMAPS[basemap].attribution,
      maxZoom: 20,
    }).addTo(map);
    baseTileRef.current = tile;
    if (overlayRef.current) overlayRef.current.bringToFront();
    if (bandMathOverlayRef.current) bandMathOverlayRef.current.bringToFront();
  }, [basemap]);

  // Render raster overlay from ImageData
  const imageDataToUrl = useCallback((imageData: ImageData): string => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  }, []);

  // Update main raster overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !renderedImageData || !metadata?.bbox) return;

    const [west, south, east, north] = metadata.bbox;
    const bounds = L.latLngBounds([[south, west], [north, east]]);
    const url = imageDataToUrl(renderedImageData);

    if (overlayRef.current) {
      overlayRef.current.remove();
    }
    overlayRef.current = L.imageOverlay(url, bounds, { opacity: store.renderSettings.opacity }).addTo(map);
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [renderedImageData, metadata, imageDataToUrl, store.renderSettings.opacity]);

  // Update band math overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !metadata?.bbox) return;

    if (bandMathOverlayRef.current) {
      bandMathOverlayRef.current.remove();
      bandMathOverlayRef.current = null;
    }

    if (renderedBandMath) {
      const [west, south, east, north] = metadata.bbox;
      const bounds = L.latLngBounds([[south, west], [north, east]]);
      const url = imageDataToUrl(renderedBandMath);
      bandMathOverlayRef.current = L.imageOverlay(url, bounds, { opacity: 0.85 }).addTo(map);
    }
  }, [renderedBandMath, metadata, imageDataToUrl]);

  // Pixel inspector click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = async (e: L.LeafletMouseEvent) => {
      if (!tiff || !metadata?.bbox || !showPixelInspector) return;
      const { lat, lng } = e.latlng;
      const pixel = latLngToPixel(lat, lng, metadata.bbox!, metadata.width, metadata.height);
      if (!pixel) return;
      try {
        const values = await getPixelValues(tiff, pixel.x, pixel.y);
        store.setPixelInfo({ lat, lng, x: pixel.x, y: pixel.y, values });
      } catch { /* ignore */ }
    };

    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [tiff, metadata, showPixelInspector, store]);

  // Cursor style
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    container.style.cursor = showPixelInspector ? 'crosshair' : '';
  }, [showPixelInspector]);

  const zoomToExtent = () => {
    if (!mapRef.current || !metadata?.bbox) return;
    const [west, south, east, north] = metadata.bbox;
    mapRef.current.fitBounds([[south, west], [north, east]], { padding: [20, 20] });
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-dark-900/60 backdrop-blur-sm flex items-center justify-center z-[1000]">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
            <Loader2 className="w-8 h-8 text-accent-400 animate-spin" />
            <p className="text-sm font-medium text-gray-200">Processing GeoTIFF...</p>
            <p className="text-xs text-gray-500">Computing statistics and rendering</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!renderedImageData && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
          <div className="bg-dark-800/80 backdrop-blur-md border border-dark-600 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl text-center max-w-xs">
            <MapIcon className="w-10 h-10 text-gray-600" />
            <div>
              <p className="text-sm font-semibold text-gray-300">No raster loaded</p>
              <p className="text-xs text-gray-500 mt-1">Upload a GeoTIFF or load from URL using the panel on the left</p>
            </div>
          </div>
        </div>
      )}

      {/* Map controls */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        {/* Basemap switcher */}
        <div className="relative">
          <button
            onClick={() => setShowBasemapMenu(!showBasemapMenu)}
            className="flex items-center gap-1.5 bg-dark-800/90 backdrop-blur-sm border border-dark-600 rounded-xl px-3 py-2 text-xs text-gray-300 hover:text-white hover:border-accent-400/60 transition-all shadow-lg"
          >
            <Layers className="w-3.5 h-3.5" />
            {BASEMAPS[basemap].name}
          </button>
          {showBasemapMenu && (
            <div className="absolute top-full mt-1 left-0 bg-dark-800/95 backdrop-blur-md border border-dark-600 rounded-xl overflow-hidden shadow-2xl animate-slide-up w-36">
              {Object.entries(BASEMAPS).map(([key, { name }]) => (
                <button
                  key={key}
                  onClick={() => { setBasemap(key as keyof typeof BASEMAPS); setShowBasemapMenu(false); }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                    basemap === key
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'text-gray-400 hover:bg-dark-700 hover:text-gray-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom to extent */}
        {metadata?.bbox && (
          <button
            onClick={zoomToExtent}
            title="Zoom to extent"
            className="flex items-center gap-1.5 bg-dark-800/90 backdrop-blur-sm border border-dark-600 rounded-xl px-3 py-2 text-xs text-gray-300 hover:text-white hover:border-accent-400/60 transition-all shadow-lg"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            Fit
          </button>
        )}
      </div>

      {/* Pixel inspector hint */}
      {showPixelInspector && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="bg-dark-800/90 backdrop-blur-sm border border-accent-400/30 rounded-full px-4 py-2 text-xs text-accent-400 shadow-lg">
            Click anywhere on the raster to inspect pixel values
          </div>
        </div>
      )}

      {/* Band math legend */}
      {store.renderedBandMath && store.bandMathStats && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-dark-800/90 backdrop-blur-sm border border-dark-600 rounded-xl p-3 shadow-lg">
          <p className="text-[10px] text-gray-500 mb-1.5">Band Math Result</p>
          <div className="h-3 w-32 rounded" style={{
            background: 'linear-gradient(to right, #a50026, #d73027, #fdae61, #fee08b, #66bd63, #1a9850, #006837)',
          }} />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-gray-400">{store.bandMathStats.min.toFixed(2)}</span>
            <span className="text-[10px] font-mono text-gray-400">{store.bandMathStats.max.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
