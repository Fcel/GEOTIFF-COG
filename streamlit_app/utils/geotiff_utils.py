"""GeoTIFF reading and processing utilities using rasterio."""

import io
import numpy as np
import rasterio
from rasterio.warp import transform_bounds, calculate_default_transform, reproject, Resampling
from rasterio.crs import CRS
import tempfile
import os
import requests
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BandStats:
    band: int
    min: float
    max: float
    mean: float
    median: float
    std_dev: float
    no_data_count: int
    valid_count: int


@dataclass
class GeoTiffMetadata:
    width: int
    height: int
    band_count: int
    crs: Optional[str]
    bbox_wgs84: Optional[tuple]   # (west, south, east, north) in WGS84
    no_data_value: Optional[float]
    file_size: Optional[int]
    file_name: Optional[str]
    compression: Optional[str]
    dtype: str
    driver: str
    res: Optional[tuple]          # pixel resolution


def open_from_bytes(data: bytes) -> rasterio.DatasetReader:
    """Open a GeoTIFF from raw bytes via a temp file."""
    tmp = tempfile.NamedTemporaryFile(suffix=".tif", delete=False)
    tmp.write(data)
    tmp.flush()
    tmp.close()
    return rasterio.open(tmp.name), tmp.name


def open_from_url(url: str) -> tuple:
    """Download and open a GeoTIFF from URL. Supports /vsicurl/ for COG."""
    # Try rasterio's virtual filesystem for COG
    try:
        ds = rasterio.open(f"/vsicurl/{url}")
        return ds, None
    except Exception:
        pass
    # Fallback: download first
    r = requests.get(url, timeout=60, stream=True)
    r.raise_for_status()
    data = r.content
    return open_from_bytes(data)


def get_metadata(ds: rasterio.DatasetReader, file_name: str = None, file_size: int = None) -> GeoTiffMetadata:
    """Extract metadata from an open rasterio dataset."""
    crs_str = str(ds.crs) if ds.crs else None

    # Reproject bbox to WGS84
    bbox_wgs84 = None
    if ds.crs:
        try:
            left, bottom, right, top = ds.bounds
            wgs84 = CRS.from_epsg(4326)
            west, south, east, north = transform_bounds(ds.crs, wgs84, left, bottom, right, top)
            bbox_wgs84 = (west, south, east, north)
        except Exception:
            pass

    # Get compression tag
    compression = ds.profile.get("compress", "none")

    res = ds.res if ds.res else None

    return GeoTiffMetadata(
        width=ds.width,
        height=ds.height,
        band_count=ds.count,
        crs=crs_str,
        bbox_wgs84=bbox_wgs84,
        no_data_value=ds.nodata,
        file_size=file_size,
        file_name=file_name,
        compression=compression,
        dtype=str(ds.dtypes[0]),
        driver=ds.driver,
        res=res,
    )


def read_band(ds: rasterio.DatasetReader, band_idx: int, max_pixels: int = 4_000_000) -> np.ndarray:
    """Read a single band, downsampling if needed for performance."""
    total = ds.width * ds.height
    if total > max_pixels:
        scale = (max_pixels / total) ** 0.5
        out_h = max(1, int(ds.height * scale))
        out_w = max(1, int(ds.width * scale))
    else:
        out_h, out_w = ds.height, ds.width
    data = ds.read(band_idx + 1, out_shape=(out_h, out_w), resampling=Resampling.average)
    return data.astype(np.float64)


def compute_band_stats(data: np.ndarray, no_data_value=None) -> BandStats:
    """Compute statistics for a band array."""
    flat = data.flatten()
    if no_data_value is not None and not np.isnan(no_data_value):
        mask = flat != no_data_value
    else:
        mask = np.isfinite(flat)

    valid = flat[mask]
    no_data_count = int((~mask).sum())

    if len(valid) == 0:
        return BandStats(band=0, min=0, max=0, mean=0, median=0, std_dev=0,
                         no_data_count=no_data_count, valid_count=0)

    return BandStats(
        band=0,
        min=float(valid.min()),
        max=float(valid.max()),
        mean=float(valid.mean()),
        median=float(np.median(valid)),
        std_dev=float(valid.std()),
        no_data_count=no_data_count,
        valid_count=int(len(valid)),
    )


def render_band_rgba(
    data: np.ndarray,
    vmin: float,
    vmax: float,
    cmap_name: str,
    no_data_value=None,
    opacity: float = 1.0,
) -> np.ndarray:
    """Render a 2D band array to RGBA uint8 using a matplotlib colormap."""
    import matplotlib.cm as cm
    import matplotlib.colors as mcolors

    arr = data.copy().astype(np.float64)

    # Build no-data mask
    if no_data_value is not None and not np.isnan(no_data_value):
        nodata_mask = arr == no_data_value
    else:
        nodata_mask = ~np.isfinite(arr)

    # Normalize to [0, 1]
    rng = vmax - vmin if vmax != vmin else 1.0
    norm = np.clip((arr - vmin) / rng, 0, 1)

    cmap = cm.get_cmap(cmap_name)
    rgba = cmap(norm)  # shape (H, W, 4)
    rgba[nodata_mask, 3] = 0.0  # transparent
    rgba[:, :, 3] *= opacity

    return (rgba * 255).astype(np.uint8)


def render_rgb_rgba(
    r: np.ndarray, g: np.ndarray, b: np.ndarray,
    r_range: tuple, g_range: tuple, b_range: tuple,
    no_data_value=None,
    opacity: float = 1.0,
) -> np.ndarray:
    """Render three bands as RGB RGBA."""
    def stretch(arr, vmin, vmax):
        rng = vmax - vmin if vmax != vmin else 1.0
        return np.clip((arr - vmin) / rng, 0, 1)

    R = stretch(r, *r_range)
    G = stretch(g, *g_range)
    B = stretch(b, *b_range)

    rgba = np.stack([R, G, B, np.ones_like(R)], axis=-1)

    if no_data_value is not None:
        nodata_mask = (r == no_data_value) | (g == no_data_value) | (b == no_data_value)
        rgba[nodata_mask, 3] = 0.0

    rgba[:, :, 3] *= opacity
    return (rgba * 255).astype(np.uint8)


def rgba_to_png_bytes(rgba: np.ndarray) -> bytes:
    """Convert RGBA uint8 array to PNG bytes."""
    from PIL import Image
    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def compute_histogram(data: np.ndarray, no_data_value=None, bins: int = 64) -> tuple:
    """Return (bin_centers, counts) for histogram."""
    flat = data.flatten().astype(np.float64)
    if no_data_value is not None and not np.isnan(no_data_value):
        flat = flat[flat != no_data_value]
    flat = flat[np.isfinite(flat)]
    if len(flat) == 0:
        return np.array([]), np.array([])
    counts, edges = np.histogram(flat, bins=bins)
    centers = (edges[:-1] + edges[1:]) / 2
    return centers, counts
