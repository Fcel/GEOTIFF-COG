import { fromUrl, fromArrayBuffer, GeoTIFF, GeoTIFFImage } from 'geotiff';
import type { BandStats, GeoTiffMetadata, HistogramData } from '../types';

export async function loadGeoTiffFromFile(file: File): Promise<GeoTIFF> {
  const buffer = await file.arrayBuffer();
  return fromArrayBuffer(buffer);
}

export async function loadGeoTiffFromUrl(url: string): Promise<GeoTIFF> {
  return fromUrl(url);
}

export async function getMetadata(tiff: GeoTIFF, file?: File): Promise<GeoTiffMetadata> {
  const image: GeoTIFFImage = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bandCount = image.getSamplesPerPixel();
  const bbox = image.getBoundingBox();
  const noDataValue = image.getGDALNoData();
  const fileDir = image.fileDirectory;

  // Try to get WGS84 bounding box
  let geoBbox: [number, number, number, number] | undefined;
  try {
    const [west, south, east, north] = bbox;
    if (Math.abs(west) <= 180 && Math.abs(east) <= 180 && Math.abs(south) <= 90 && Math.abs(north) <= 90) {
      geoBbox = [west, south, east, north];
    }
  } catch {
    // ignore
  }

  const compressionMap: Record<number, string> = {
    1: 'None', 5: 'LZW', 6: 'JPEG', 8: 'Deflate/ZIP',
    32773: 'PackBits', 34925: 'LZMA', 50000: 'ZSTD',
  };
  const compressionCode = (fileDir as unknown as Record<string, unknown>)?.Compression as number | undefined;
  const compression = compressionCode
    ? (compressionMap[compressionCode] ?? `Code ${compressionCode}`)
    : 'Unknown';

  // Detect COG: first IFD offset is typically small in a COG
  const isCOG = tiff.ifdRequests?.length > 1 || false;

  return {
    width,
    height,
    bandCount,
    bbox: geoBbox,
    noDataValue: noDataValue ?? null,
    fileSize: file?.size,
    fileName: file?.name,
    compression,
    isCOG,
  };
}

export async function readBandData(
  tiff: GeoTIFF,
  band: number,
  _noDataValue?: number | null
): Promise<Float64Array> {
  const image = await tiff.getImage();
  const data = await image.readRasters({ samples: [band] });
  const raw = data[0] as Float32Array | Float64Array | Int16Array | Uint16Array | Uint8Array;
  const result = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    result[i] = raw[i];
  }
  return result;
}

export async function computeBandStats(
  tiff: GeoTIFF,
  bandIndex: number,
  noDataValue?: number | null
): Promise<BandStats> {
  const data = await readBandData(tiff, bandIndex, noDataValue);
  const valid: number[] = [];
  let noDataCount = 0;

  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (noDataValue !== null && noDataValue !== undefined && v === noDataValue) {
      noDataCount++;
    } else if (isFinite(v) && !isNaN(v)) {
      valid.push(v);
    } else {
      noDataCount++;
    }
  }

  if (valid.length === 0) {
    return { band: bandIndex, min: 0, max: 0, mean: 0, median: 0, stdDev: 0, noDataCount, validCount: 0 };
  }

  valid.sort((a, b) => a - b);
  const min = valid[0];
  const max = valid[valid.length - 1];
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const median = valid[Math.floor(valid.length / 2)];
  const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
  const stdDev = Math.sqrt(variance);

  return { band: bandIndex, min, max, mean, median, stdDev, noDataCount, validCount: valid.length };
}

export async function computeHistogram(
  tiff: GeoTIFF,
  bandIndex: number,
  stats: BandStats,
  buckets = 64
): Promise<HistogramData> {
  const data = await readBandData(tiff, bandIndex);
  const { min, max } = stats;
  const range = max - min || 1;
  const counts = new Array(buckets).fill(0);

  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!isFinite(v) || isNaN(v)) continue;
    const idx = Math.min(buckets - 1, Math.floor(((v - min) / range) * buckets));
    counts[idx]++;
  }

  const step = range / buckets;
  return {
    band: bandIndex,
    buckets: counts.map((count, i) => ({
      range: `${(min + i * step).toFixed(2)}`,
      count,
      min: min + i * step,
      max: min + (i + 1) * step,
    })),
  };
}

export async function renderToImageData(
  tiff: GeoTIFF,
  opts: {
    bands: number[];
    colormap?: (v: number, min: number, max: number) => [number, number, number];
    mins?: number[];
    maxs?: number[];
    noDataValue?: number | null;
    opacity?: number;
  }
): Promise<{ imageData: ImageData; width: number; height: number }> {
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const samples = await image.readRasters({ samples: opts.bands });
  const opacity = opts.opacity ?? 1;

  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    let r = 0, g = 0, b = 0, a = 255;

    if (opts.bands.length === 1 && opts.colormap) {
      const v = (samples[0] as Float32Array)[i];
      const isNoData = opts.noDataValue !== null && opts.noDataValue !== undefined && v === opts.noDataValue;
      if (isNoData || !isFinite(v) || isNaN(v)) {
        a = 0;
      } else {
        const [cr, cg, cb] = opts.colormap(v, opts.mins?.[0] ?? 0, opts.maxs?.[0] ?? 255);
        r = cr; g = cg; b = cb;
      }
    } else if (opts.bands.length === 3) {
      const rv = (samples[0] as Float32Array)[i];
      const gv = (samples[1] as Float32Array)[i];
      const bv = (samples[2] as Float32Array)[i];
      const mins = opts.mins ?? [0, 0, 0];
      const maxs = opts.maxs ?? [255, 255, 255];
      const isNoData = opts.noDataValue !== null && opts.noDataValue !== undefined &&
        (rv === opts.noDataValue || gv === opts.noDataValue || bv === opts.noDataValue);
      if (isNoData || !isFinite(rv) || !isFinite(gv) || !isFinite(bv)) {
        a = 0;
      } else {
        r = Math.max(0, Math.min(255, Math.round(((rv - mins[0]) / (maxs[0] - mins[0] || 1)) * 255)));
        g = Math.max(0, Math.min(255, Math.round(((gv - mins[1]) / (maxs[1] - mins[1] || 1)) * 255)));
        b = Math.max(0, Math.min(255, Math.round(((bv - mins[2]) / (maxs[2] - mins[2] || 1)) * 255)));
      }
    }

    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = Math.round(a * opacity);
  }

  return { imageData: new ImageData(pixels, width, height), width, height };
}

export async function getPixelValues(
  tiff: GeoTIFF,
  pixelX: number,
  pixelY: number
): Promise<number[]> {
  const image = await tiff.getImage();
  const bands = image.getSamplesPerPixel();
  const data = await image.readRasters({
    window: [pixelX, pixelY, pixelX + 1, pixelY + 1],
  });
  return Array.from({ length: bands }, (_, i) => (data[i] as Float32Array)[0]);
}

export function latLngToPixel(
  lat: number,
  lng: number,
  bbox: [number, number, number, number],
  width: number,
  height: number
): { x: number; y: number } | null {
  const [west, south, east, north] = bbox;
  if (lng < west || lng > east || lat < south || lat > north) return null;
  const x = Math.floor(((lng - west) / (east - west)) * width);
  const y = Math.floor(((north - lat) / (north - south)) * height);
  return { x: Math.max(0, Math.min(width - 1, x)), y: Math.max(0, Math.min(height - 1, y)) };
}
