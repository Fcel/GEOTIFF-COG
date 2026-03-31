import type { GeoTIFF } from 'geotiff';

export interface BandMathPreset {
  id: string;
  name: string;
  description: string;
  formula: string;
  minBands: number;
  colormap: string;
  range: [number, number];
}

export const BAND_MATH_PRESETS: BandMathPreset[] = [
  {
    id: 'ndvi',
    name: 'NDVI',
    description: 'Normalized Difference Vegetation Index — (NIR-Red)/(NIR+Red)',
    formula: '(b4 - b3) / (b4 + b3)',
    minBands: 4,
    colormap: 'ndvi',
    range: [-1, 1],
  },
  {
    id: 'ndwi',
    name: 'NDWI',
    description: 'Normalized Difference Water Index — (Green-NIR)/(Green+NIR)',
    formula: '(b2 - b4) / (b2 + b4)',
    minBands: 4,
    colormap: 'blues',
    range: [-1, 1],
  },
  {
    id: 'ndbi',
    name: 'NDBI',
    description: 'Normalized Difference Built-up Index — (SWIR-NIR)/(SWIR+NIR)',
    formula: '(b5 - b4) / (b5 + b4)',
    minBands: 5,
    colormap: 'reds',
    range: [-1, 1],
  },
  {
    id: 'evi',
    name: 'EVI',
    description: 'Enhanced Vegetation Index — 2.5*(NIR-Red)/(NIR+6*Red-7.5*Blue+1)',
    formula: '2.5 * (b4 - b3) / (b4 + 6 * b3 - 7.5 * b1 + 1)',
    minBands: 4,
    colormap: 'ndvi',
    range: [-1, 1],
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Write your own band math expression',
    formula: '(b1 - b2) / (b1 + b2)',
    minBands: 2,
    colormap: 'viridis',
    range: [-1, 1],
  },
];

export async function evaluateBandMath(
  tiff: GeoTIFF,
  formula: string,
  bandCount: number
): Promise<{ result: Float64Array; width: number; height: number }> {
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();

  // Read all bands referenced in formula
  const usedBands: number[] = [];
  for (let i = 1; i <= bandCount; i++) {
    if (formula.includes(`b${i}`)) usedBands.push(i - 1);
  }
  if (usedBands.length === 0) throw new Error('No valid band references (b1, b2, ...) found in formula');

  const rasters = await image.readRasters({ samples: usedBands });
  const pixelCount = width * height;
  const result = new Float64Array(pixelCount);

  // Build band arrays
  const bands: Record<string, Float32Array> = {};
  usedBands.forEach((bi, idx) => {
    bands[`b${bi + 1}`] = rasters[idx] as Float32Array;
  });

  // Evaluate formula per pixel using Function constructor
  const bandKeys = Object.keys(bands);
  let fn: (...args: number[]) => number;
  try {
    fn = new Function(...bandKeys, `return (${formula});`) as (...args: number[]) => number;
  } catch {
    throw new Error(`Invalid formula: ${formula}`);
  }

  for (let i = 0; i < pixelCount; i++) {
    const args = bandKeys.map(k => bands[k][i]);
    const v = fn(...args);
    result[i] = isFinite(v) ? v : NaN;
  }

  return { result, width, height };
}

export function resultToImageData(
  result: Float64Array,
  width: number,
  height: number,
  min: number,
  max: number,
  lut: [number, number, number][],
  opacity = 1
): ImageData {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const range = max - min || 1;
  for (let i = 0; i < result.length; i++) {
    const v = result[i];
    if (isNaN(v)) {
      pixels[i * 4 + 3] = 0;
      continue;
    }
    const t = Math.max(0, Math.min(1, (v - min) / range));
    const idx = Math.round(t * (lut.length - 1));
    pixels[i * 4] = lut[idx][0];
    pixels[i * 4 + 1] = lut[idx][1];
    pixels[i * 4 + 2] = lut[idx][2];
    pixels[i * 4 + 3] = Math.round(255 * opacity);
  }
  return new ImageData(pixels, width, height);
}
