"""Band math presets and evaluation."""

import numpy as np
from dataclasses import dataclass
from typing import Dict


@dataclass
class BandMathPreset:
    id: str
    name: str
    description: str
    formula: str
    colormap: str
    range: tuple


PRESETS = [
    BandMathPreset(
        id="ndvi", name="NDVI",
        description="Normalized Difference Vegetation Index — (NIR−Red)/(NIR+Red)",
        formula="(b4 - b3) / (b4 + b3)",
        colormap="RdYlGn", range=(-1, 1),
    ),
    BandMathPreset(
        id="ndwi", name="NDWI",
        description="Normalized Difference Water Index — (Green−NIR)/(Green+NIR)",
        formula="(b2 - b4) / (b2 + b4)",
        colormap="Blues", range=(-1, 1),
    ),
    BandMathPreset(
        id="ndbi", name="NDBI",
        description="Normalized Difference Built-up Index — (SWIR−NIR)/(SWIR+NIR)",
        formula="(b5 - b4) / (b5 + b4)",
        colormap="Reds", range=(-1, 1),
    ),
    BandMathPreset(
        id="evi", name="EVI",
        description="Enhanced Vegetation Index — 2.5*(NIR−Red)/(NIR+6*Red−7.5*Blue+1)",
        formula="2.5 * (b4 - b3) / (b4 + 6 * b3 - 7.5 * b1 + 1)",
        colormap="RdYlGn", range=(-1, 1),
    ),
    BandMathPreset(
        id="custom", name="Custom",
        description="Write your own expression using b1, b2, b3...",
        formula="(b1 - b2) / (b1 + b2)",
        colormap="viridis", range=(-1, 1),
    ),
]


def evaluate_band_math(formula: str, bands: Dict[str, np.ndarray]) -> np.ndarray:
    """
    Evaluate a band math formula.
    bands: dict like {"b1": array, "b2": array, ...}
    Returns float64 array, NaN for invalid pixels.
    """
    # Safe math namespace
    safe_ns = {k: v for k, v in bands.items()}
    safe_ns.update({
        "np": np,
        "sqrt": np.sqrt,
        "log": np.log,
        "log10": np.log10,
        "abs": np.abs,
        "exp": np.exp,
        "where": np.where,
        "nan": np.nan,
    })

    with np.errstate(divide="ignore", invalid="ignore"):
        result = eval(compile(formula, "<formula>", "eval"), {"__builtins__": {}}, safe_ns)  # noqa: S307

    result = np.array(result, dtype=np.float64)
    result[~np.isfinite(result)] = np.nan
    return result
