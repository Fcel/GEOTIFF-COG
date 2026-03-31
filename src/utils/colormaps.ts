export type RGB = [number, number, number];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function buildColormap(stops: RGB[], size = 256): RGB[] {
  const result: RGB[] = [];
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    const idx = t * (stops.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, stops.length - 1);
    result.push(lerpColor(stops[lo], stops[hi], idx - lo));
  }
  return result;
}

export const COLORMAPS: Record<string, { name: string; lut: RGB[] }> = {
  grayscale: {
    name: 'Grayscale',
    lut: buildColormap([[0, 0, 0], [255, 255, 255]]),
  },
  viridis: {
    name: 'Viridis',
    lut: buildColormap([
      [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142],
      [38, 130, 142], [31, 158, 137], [53, 183, 121], [110, 206, 88],
      [181, 222, 43], [253, 231, 37],
    ]),
  },
  inferno: {
    name: 'Inferno',
    lut: buildColormap([
      [0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106],
      [186, 54, 85], [227, 89, 51], [249, 140, 10], [252, 194, 85], [252, 255, 164],
    ]),
  },
  magma: {
    name: 'Magma',
    lut: buildColormap([
      [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129],
      [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191],
    ]),
  },
  plasma: {
    name: 'Plasma',
    lut: buildColormap([
      [13, 8, 135], [84, 2, 163], [139, 10, 165], [185, 50, 137],
      [219, 92, 104], [244, 136, 73], [254, 188, 43], [240, 249, 33],
    ]),
  },
  rdylgn: {
    name: 'Red-Yellow-Green',
    lut: buildColormap([
      [165, 0, 38], [215, 48, 39], [244, 109, 67], [253, 174, 97],
      [254, 224, 139], [255, 255, 191], [217, 239, 139], [166, 217, 106],
      [102, 189, 99], [26, 152, 80], [0, 104, 55],
    ]),
  },
  blues: {
    name: 'Blues',
    lut: buildColormap([
      [247, 251, 255], [198, 219, 239], [158, 202, 225], [107, 174, 214],
      [66, 146, 198], [33, 113, 181], [8, 81, 156], [8, 48, 107],
    ]),
  },
  reds: {
    name: 'Reds',
    lut: buildColormap([
      [255, 245, 240], [254, 224, 210], [252, 187, 161], [252, 146, 114],
      [251, 106, 74], [239, 59, 44], [203, 24, 29], [165, 15, 21], [103, 0, 13],
    ]),
  },
  ndvi: {
    name: 'NDVI',
    lut: buildColormap([
      [165, 42, 42], [139, 90, 43], [210, 180, 140],
      [240, 230, 140], [124, 205, 124], [34, 139, 34], [0, 100, 0],
    ]),
  },
  terrain: {
    name: 'Terrain',
    lut: buildColormap([
      [51, 102, 204], [51, 153, 204], [102, 204, 204],
      [102, 204, 102], [153, 204, 102], [204, 204, 102],
      [204, 153, 102], [153, 102, 51], [255, 255, 255],
    ]),
  },
};

export function applyColormap(value: number, min: number, max: number, colormapId: string): RGB {
  const lut = COLORMAPS[colormapId]?.lut ?? COLORMAPS.grayscale.lut;
  if (max === min) return lut[0];
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const idx = Math.round(t * (lut.length - 1));
  return lut[idx];
}
