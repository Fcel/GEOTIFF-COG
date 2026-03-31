export interface BandStats {
  band: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  noDataCount: number;
  validCount: number;
}

export interface GeoTiffMetadata {
  width: number;
  height: number;
  bandCount: number;
  crs?: string;
  bbox?: [number, number, number, number]; // [west, south, east, north] in WGS84
  origin?: [number, number];
  pixelSize?: [number, number];
  noDataValue?: number | null;
  fileSize?: number;
  fileName?: string;
  compression?: string;
  isCOG?: boolean;
  projection?: string;
}

export interface PixelInfo {
  lat: number;
  lng: number;
  x: number;
  y: number;
  values: number[];
}

export interface HistogramData {
  band: number;
  buckets: { range: string; count: number; min: number; max: number }[];
}

export interface ColorMap {
  id: string;
  name: string;
  colors: [number, number, number][];
}

export type RenderMode = 'singleband' | 'rgb' | 'grayscale' | 'colormap';

export interface RenderSettings {
  mode: RenderMode;
  selectedBand: number;
  rBand: number;
  gBand: number;
  bBand: number;
  colorMapId: string;
  stretchMin: number;
  stretchMax: number;
  opacity: number;
  noDataTransparent: boolean;
}

export interface AppState {
  isLoading: boolean;
  error: string | null;
  metadata: GeoTiffMetadata | null;
  bandStats: BandStats[];
  histograms: HistogramData[];
  pixelInfo: PixelInfo | null;
  renderSettings: RenderSettings;
  activePanel: 'info' | 'stats' | 'histogram' | 'bandmath' | 'layers';
  darkMode: boolean;
  showPixelInspector: boolean;
  drawnPolygon: GeoJSON.Feature | null;
  polygonStats: BandStats[] | null;
}

export interface BandMathExpression {
  id: string;
  name: string;
  formula: string;
  description: string;
  colorMap: string;
}
