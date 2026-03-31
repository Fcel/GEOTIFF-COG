import { create } from 'zustand';
import type { GeoTIFF } from 'geotiff';
import type { AppState, BandStats, GeoTiffMetadata, HistogramData, PixelInfo, RenderSettings } from '../types';

interface AppStore extends AppState {
  tiff: GeoTIFF | null;
  renderedImageData: ImageData | null;
  renderedBandMath: ImageData | null;
  bandMathStats: { min: number; max: number } | null;

  setTiff: (tiff: GeoTIFF | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMetadata: (metadata: GeoTiffMetadata | null) => void;
  setBandStats: (stats: BandStats[]) => void;
  setHistograms: (histograms: HistogramData[]) => void;
  setPixelInfo: (info: PixelInfo | null) => void;
  setRenderSettings: (settings: Partial<RenderSettings>) => void;
  setActivePanel: (panel: AppState['activePanel']) => void;
  setDarkMode: (dark: boolean) => void;
  setShowPixelInspector: (show: boolean) => void;
  setRenderedImageData: (data: ImageData | null) => void;
  setRenderedBandMath: (data: ImageData | null) => void;
  setBandMathStats: (stats: { min: number; max: number } | null) => void;
  setDrawnPolygon: (polygon: GeoJSON.Feature | null) => void;
  setPolygonStats: (stats: BandStats[] | null) => void;
  reset: () => void;
}

const defaultRenderSettings: RenderSettings = {
  mode: 'singleband',
  selectedBand: 0,
  rBand: 0,
  gBand: 1,
  bBand: 2,
  colorMapId: 'grayscale',
  stretchMin: 0,
  stretchMax: 255,
  opacity: 1,
  noDataTransparent: true,
};

export const useAppStore = create<AppStore>((set) => ({
  tiff: null,
  renderedImageData: null,
  renderedBandMath: null,
  bandMathStats: null,
  isLoading: false,
  error: null,
  metadata: null,
  bandStats: [],
  histograms: [],
  pixelInfo: null,
  renderSettings: defaultRenderSettings,
  activePanel: 'info',
  darkMode: true,
  showPixelInspector: false,
  drawnPolygon: null,
  polygonStats: null,

  setTiff: (tiff) => set({ tiff }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setMetadata: (metadata) => set({ metadata }),
  setBandStats: (bandStats) => set({ bandStats }),
  setHistograms: (histograms) => set({ histograms }),
  setPixelInfo: (pixelInfo) => set({ pixelInfo }),
  setRenderSettings: (settings) =>
    set((state) => ({ renderSettings: { ...state.renderSettings, ...settings } })),
  setActivePanel: (activePanel) => set({ activePanel }),
  setDarkMode: (darkMode) => set({ darkMode }),
  setShowPixelInspector: (showPixelInspector) => set({ showPixelInspector }),
  setRenderedImageData: (renderedImageData) => set({ renderedImageData }),
  setRenderedBandMath: (renderedBandMath) => set({ renderedBandMath }),
  setBandMathStats: (bandMathStats) => set({ bandMathStats }),
  setDrawnPolygon: (drawnPolygon) => set({ drawnPolygon }),
  setPolygonStats: (polygonStats) => set({ polygonStats }),
  reset: () => set({
    tiff: null,
    renderedImageData: null,
    renderedBandMath: null,
    bandMathStats: null,
    isLoading: false,
    error: null,
    metadata: null,
    bandStats: [],
    histograms: [],
    pixelInfo: null,
    renderSettings: defaultRenderSettings,
    drawnPolygon: null,
    polygonStats: null,
  }),
}));
