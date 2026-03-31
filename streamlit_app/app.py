"""
GeoTIFF Studio — Streamlit Edition
Browser-based GeoTIFF / COG viewer and analyzer.
"""

import io
import base64
import tempfile
import os

import numpy as np
import streamlit as st
import plotly.graph_objects as go
import folium
from streamlit_folium import st_folium

from utils.geotiff_utils import (
    open_from_bytes, open_from_url, get_metadata,
    read_band, compute_band_stats, render_band_rgba,
    render_rgb_rgba, rgba_to_png_bytes, compute_histogram,
)
from utils.band_math import PRESETS, evaluate_band_math

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="GeoTIFF Studio",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
/* Dark background for main area */
.stApp { background-color: #0d1117; color: #e6edf3; }
section[data-testid="stSidebar"] { background-color: #161b22; border-right: 1px solid #30363d; }
section[data-testid="stSidebar"] * { color: #e6edf3 !important; }

/* Headers */
h1, h2, h3 { color: #e6edf3 !important; }
h1 { font-size: 1.4rem !important; }

/* Metric cards */
[data-testid="stMetric"] {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 10px 14px;
}
[data-testid="stMetricValue"] { font-size: 1.1rem !important; }

/* Tabs */
[data-testid="stTabs"] button { color: #8b949e !important; font-size: 0.8rem; }
[data-testid="stTabs"] button[aria-selected="true"] {
    color: #58a6ff !important;
    border-bottom: 2px solid #58a6ff !important;
}

/* Inputs */
.stTextInput input, .stSelectbox select, .stTextArea textarea, .stNumberInput input {
    background: #21262d !important;
    border: 1px solid #30363d !important;
    color: #e6edf3 !important;
    border-radius: 8px !important;
}

/* Buttons */
.stButton > button {
    background: #1f6feb !important;
    color: white !important;
    border: none !important;
    border-radius: 10px !important;
    font-weight: 600;
}
.stButton > button:hover { background: #1158c7 !important; }

/* Sliders */
.stSlider > div > div > div { background: #1f6feb !important; }

/* File uploader */
[data-testid="stFileUploader"] {
    border: 2px dashed #30363d !important;
    border-radius: 12px !important;
    background: #21262d !important;
}

/* Expander */
[data-testid="stExpander"] {
    border: 1px solid #30363d !important;
    border-radius: 10px !important;
    background: #21262d !important;
}

/* Hide Streamlit branding */
#MainMenu, footer, header { visibility: hidden; }

/* Status badges */
.badge-cog { background:#238636; color:white; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; }
.badge-nocog { background:#30363d; color:#8b949e; padding:2px 8px; border-radius:12px; font-size:11px; }
.info-row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #21262d; font-size:13px; }
.info-label { color:#8b949e; }
.info-value { color:#e6edf3; font-family:monospace; }
</style>
""", unsafe_allow_html=True)

# ── Session state ─────────────────────────────────────────────────────────────
def init_state():
    defaults = {
        "ds": None,           # rasterio dataset
        "tmp_path": None,     # temp file path
        "metadata": None,
        "band_data": {},      # {band_idx: np.ndarray}
        "band_stats": {},     # {band_idx: BandStats}
        "render_rgba": None,  # rendered RGBA array
        "bmath_rgba": None,   # band math RGBA
        "bmath_range": None,
        "file_name": None,
        "file_size": None,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

init_state()

# ── Helpers ───────────────────────────────────────────────────────────────────
COLORMAPS = [
    "gray", "viridis", "inferno", "magma", "plasma",
    "RdYlGn", "RdYlBu", "Blues", "Reds", "YlOrRd",
    "terrain", "gist_earth", "coolwarm", "Spectral",
]

COLORMAP_LABELS = {
    "gray": "Grayscale", "viridis": "Viridis", "inferno": "Inferno",
    "magma": "Magma", "plasma": "Plasma", "RdYlGn": "Red-Yellow-Green",
    "RdYlBu": "Red-Yellow-Blue", "Blues": "Blues", "Reds": "Reds",
    "YlOrRd": "Yellow-Orange-Red", "terrain": "Terrain",
    "gist_earth": "Earth", "coolwarm": "Cool-Warm", "Spectral": "Spectral",
}


def get_band_data(band_idx: int) -> np.ndarray:
    if band_idx not in st.session_state.band_data:
        ds = st.session_state.ds
        st.session_state.band_data[band_idx] = read_band(ds, band_idx)
    return st.session_state.band_data[band_idx]


def get_band_stats(band_idx: int):
    if band_idx not in st.session_state.band_stats:
        data = get_band_data(band_idx)
        nd = st.session_state.metadata.no_data_value if st.session_state.metadata else None
        st.session_state.band_stats[band_idx] = compute_band_stats(data, nd)
    return st.session_state.band_stats[band_idx]


def load_file(data: bytes, name: str, size: int):
    """Load a GeoTIFF from bytes into session state."""
    # Close existing
    if st.session_state.ds:
        try:
            st.session_state.ds.close()
        except Exception:
            pass
    if st.session_state.tmp_path and os.path.exists(st.session_state.tmp_path):
        os.unlink(st.session_state.tmp_path)

    ds, tmp_path = open_from_bytes(data)
    st.session_state.ds = ds
    st.session_state.tmp_path = tmp_path
    st.session_state.metadata = get_metadata(ds, name, size)
    st.session_state.band_data = {}
    st.session_state.band_stats = {}
    st.session_state.render_rgba = None
    st.session_state.bmath_rgba = None
    st.session_state.bmath_range = None
    st.session_state.file_name = name
    st.session_state.file_size = size


def rgba_to_base64(rgba: np.ndarray) -> str:
    png = rgba_to_png_bytes(rgba)
    return base64.b64encode(png).decode()


def add_image_overlay_to_map(fmap: folium.Map, rgba: np.ndarray, bbox: tuple):
    """Add RGBA numpy array as image overlay to folium map."""
    b64 = rgba_to_base64(rgba)
    west, south, east, north = bbox
    folium.raster_layers.ImageOverlay(
        image=f"data:image/png;base64,{b64}",
        bounds=[[south, west], [north, east]],
        opacity=0.85,
        name="Raster",
        zindex=1,
    ).add_to(fmap)


def make_base_map(bbox=None) -> folium.Map:
    if bbox:
        west, south, east, north = bbox
        center = [(south + north) / 2, (west + east) / 2]
    else:
        center = [20, 0]

    fmap = folium.Map(
        location=center,
        zoom_start=4 if bbox else 2,
        tiles=None,
        prefer_canvas=True,
    )

    # Basemap tiles
    folium.TileLayer("CartoDB dark_matter", name="Dark", attr="CartoDB").add_to(fmap)
    folium.TileLayer("CartoDB positron", name="Light", attr="CartoDB").add_to(fmap)
    folium.TileLayer("OpenStreetMap", name="OSM", attr="OSM").add_to(fmap)
    folium.TileLayer(
        tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        name="Satellite",
        attr="Esri",
    ).add_to(fmap)

    folium.LayerControl(position="topright").add_to(fmap)

    if bbox:
        fmap.fit_bounds([[south, west], [north, east]])

    return fmap


# ── Sidebar ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🗺️ GeoTIFF Studio")
    st.caption("Advanced browser-based raster viewer")
    st.divider()

    # ── File loading ──────────────────────────────────────────────────────────
    st.markdown("### Load Data")

    upload_tab, url_tab = st.tabs(["📂 Upload", "🔗 URL"])

    with upload_tab:
        uploaded = st.file_uploader(
            "Drop a GeoTIFF here",
            type=["tif", "tiff"],
            label_visibility="collapsed",
        )
        if uploaded and (
            st.session_state.file_name != uploaded.name or
            st.session_state.file_size != uploaded.size
        ):
            with st.spinner("Loading GeoTIFF..."):
                try:
                    load_file(uploaded.read(), uploaded.name, uploaded.size)
                    st.success("Loaded!", icon="✅")
                except Exception as e:
                    st.error(f"Error: {e}")

    with url_tab:
        url_input = st.text_input("URL", placeholder="https://example.com/file.tif")
        if st.button("Load URL", use_container_width=True):
            if url_input.strip():
                with st.spinner("Downloading..."):
                    try:
                        ds, tmp_path = open_from_url(url_input.strip())
                        st.session_state.ds = ds
                        st.session_state.tmp_path = tmp_path
                        st.session_state.metadata = get_metadata(ds, url_input.split("/")[-1])
                        st.session_state.band_data = {}
                        st.session_state.band_stats = {}
                        st.session_state.render_rgba = None
                        st.session_state.bmath_rgba = None
                        st.success("Loaded!", icon="✅")
                    except Exception as e:
                        st.error(f"Error: {e}")

    meta = st.session_state.metadata

    if meta:
        st.divider()
        # ── Render settings ───────────────────────────────────────────────────
        st.markdown("### Render")

        n_bands = meta.band_count
        mode = st.radio("Mode", ["Single Band", "RGB Composite"] if n_bands >= 3 else ["Single Band"],
                        horizontal=True, label_visibility="collapsed")

        if mode == "Single Band":
            sel_band = st.selectbox("Band", range(n_bands),
                                    format_func=lambda i: f"Band {i+1}", key="sel_band")
            cmap = st.selectbox("Colormap", COLORMAPS,
                                format_func=lambda k: COLORMAP_LABELS.get(k, k))
            s = get_band_stats(sel_band)
            col1, col2 = st.columns(2)
            vmin = col1.number_input("Min", value=float(s.min), format="%.4f", key="vmin")
            vmax = col2.number_input("Max", value=float(s.max), format="%.4f", key="vmax")
            if col1.button("Reset stretch", use_container_width=True):
                st.rerun()
        else:
            r_band = st.selectbox("Red Band", range(n_bands), index=0,
                                  format_func=lambda i: f"Band {i+1}")
            g_band = st.selectbox("Green Band", range(n_bands), index=1,
                                  format_func=lambda i: f"Band {i+1}")
            b_band = st.selectbox("Blue Band", range(n_bands), index=min(2, n_bands-1),
                                  format_func=lambda i: f"Band {i+1}")

        opacity = st.slider("Opacity", 0.0, 1.0, 0.9, 0.05)
        no_data_transparent = st.checkbox("No-data transparent", value=True)

        if st.button("🎨 Apply Render", use_container_width=True, type="primary"):
            with st.spinner("Rendering..."):
                try:
                    nd = meta.no_data_value if no_data_transparent else None
                    if mode == "Single Band":
                        data = get_band_data(sel_band)
                        rgba = render_band_rgba(data, vmin, vmax, cmap, nd, opacity)
                    else:
                        r_data = get_band_data(r_band)
                        g_data = get_band_data(g_band)
                        b_data = get_band_data(b_band)
                        r_s = get_band_stats(r_band)
                        g_s = get_band_stats(g_band)
                        b_s = get_band_stats(b_band)
                        rgba = render_rgb_rgba(
                            r_data, g_data, b_data,
                            (r_s.min, r_s.max), (g_s.min, g_s.max), (b_s.min, b_s.max),
                            nd, opacity,
                        )
                    st.session_state.render_rgba = rgba
                    st.session_state.bmath_rgba = None
                    st.rerun()
                except Exception as e:
                    st.error(f"Render error: {e}")

        st.divider()
        # ── Pixel inspector ───────────────────────────────────────────────────
        st.markdown("### 🎯 Pixel Inspector")
        st.caption("Click on the map to inspect pixel values (coming soon via Streamlit callbacks)")

# ── Main area ──────────────────────────────────────────────────────────────────
if not meta:
    # Landing page
    st.markdown("""
    <div style="text-align:center; padding: 80px 20px;">
        <div style="font-size:64px; margin-bottom:16px;">🗺️</div>
        <h1 style="font-size:2rem; color:#e6edf3;">GeoTIFF Studio</h1>
        <p style="color:#8b949e; font-size:1.1rem; margin-bottom:32px;">
            Advanced browser-based raster viewer & analyzer
        </p>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; max-width:700px; margin:0 auto;">
            <div style="background:#21262d; border:1px solid #30363d; border-radius:12px; padding:20px;">
                <div style="font-size:28px">📊</div>
                <div style="font-weight:600; margin:8px 0">Band Statistics</div>
                <div style="color:#8b949e; font-size:13px">Min, max, mean, median, std dev</div>
            </div>
            <div style="background:#21262d; border:1px solid #30363d; border-radius:12px; padding:20px;">
                <div style="font-size:28px">🎨</div>
                <div style="font-weight:600; margin:8px 0">Colormaps</div>
                <div style="color:#8b949e; font-size:13px">14 colormaps, stretch control</div>
            </div>
            <div style="background:#21262d; border:1px solid #30363d; border-radius:12px; padding:20px;">
                <div style="font-size:28px">🧮</div>
                <div style="font-weight:600; margin:8px 0">Band Math</div>
                <div style="color:#8b949e; font-size:13px">NDVI, NDWI, EVI + custom</div>
            </div>
        </div>
        <p style="color:#6e7681; font-size:13px; margin-top:40px;">
            Upload a GeoTIFF from the sidebar to get started
        </p>
    </div>
    """, unsafe_allow_html=True)
    st.stop()

# ── Tabs ───────────────────────────────────────────────────────────────────────
tab_map, tab_meta, tab_stats, tab_hist, tab_bmath = st.tabs([
    "🗺️ Map", "ℹ️ Metadata", "📊 Statistics", "📈 Histogram", "🧮 Band Math"
])

# ── MAP TAB ───────────────────────────────────────────────────────────────────
with tab_map:
    fmap = make_base_map(meta.bbox_wgs84)

    if st.session_state.bmath_rgba is not None and meta.bbox_wgs84:
        add_image_overlay_to_map(fmap, st.session_state.bmath_rgba, meta.bbox_wgs84)
    elif st.session_state.render_rgba is not None and meta.bbox_wgs84:
        add_image_overlay_to_map(fmap, st.session_state.render_rgba, meta.bbox_wgs84)
    else:
        if not meta.bbox_wgs84:
            st.warning("No valid WGS84 bounding box found — cannot display on map. Check CRS.", icon="⚠️")
        else:
            st.info("Use **Apply Render** in the sidebar to display the raster on the map.", icon="👈")

    st_folium(fmap, width="100%", height=560, returned_objects=[])

    # Band math legend
    if st.session_state.bmath_rgba is not None and st.session_state.bmath_range:
        vmin_bm, vmax_bm, cmap_bm = st.session_state.bmath_range
        st.caption(f"Band math overlay · colormap: **{cmap_bm}** · range: [{vmin_bm:.3f}, {vmax_bm:.3f}]")

# ── METADATA TAB ──────────────────────────────────────────────────────────────
with tab_meta:
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("#### 📁 File")
        rows = [
            ("Name", meta.file_name or "—"),
            ("Size", f"{meta.file_size / 1024 / 1024:.2f} MB" if meta.file_size else "—"),
            ("Driver", meta.driver),
            ("Compression", meta.compression or "none"),
            ("Data type", meta.dtype),
            ("COG", "✅ Yes" if _is_cog(meta) else "❌ No"),
        ]
        for label, val in rows:
            st.markdown(
                f'<div class="info-row"><span class="info-label">{label}</span>'
                f'<span class="info-value">{val}</span></div>',
                unsafe_allow_html=True,
            )

    with c2:
        st.markdown("#### 📐 Dimensions")
        rows2 = [
            ("Width", f"{meta.width:,} px"),
            ("Height", f"{meta.height:,} px"),
            ("Bands", str(meta.band_count)),
            ("Total pixels", f"{meta.width * meta.height:,}"),
            ("CRS", meta.crs or "Unknown"),
            ("Resolution", f"{meta.res[0]:.6f} × {meta.res[1]:.6f}" if meta.res else "—"),
        ]
        for label, val in rows2:
            st.markdown(
                f'<div class="info-row"><span class="info-label">{label}</span>'
                f'<span class="info-value">{val}</span></div>',
                unsafe_allow_html=True,
            )

    if meta.bbox_wgs84:
        st.markdown("#### 🌍 Spatial Extent (WGS84)")
        west, south, east, north = meta.bbox_wgs84
        cm1, cm2, cm3, cm4 = st.columns(4)
        cm1.metric("West", f"{west:.6f}°")
        cm2.metric("South", f"{south:.6f}°")
        cm3.metric("East", f"{east:.6f}°")
        cm4.metric("North", f"{north:.6f}°")

    if meta.no_data_value is not None:
        st.info(f"No-data value: `{meta.no_data_value}`", icon="ℹ️")


def _is_cog(m) -> bool:
    return m.compression in ("deflate", "lzw", "zstd") and m.driver == "GTiff"


# ── STATISTICS TAB ────────────────────────────────────────────────────────────
with tab_stats:
    n = meta.band_count
    sel_b = st.selectbox("Select band", range(n), format_func=lambda i: f"Band {i+1}", key="stats_band")

    with st.spinner(f"Computing band {sel_b+1} statistics..."):
        s = get_band_stats(sel_b)

    # Metric cards
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Min", f"{s.min:.4f}" if abs(s.min) < 1e6 else f"{s.min:.3e}")
    c2.metric("Max", f"{s.max:.4f}" if abs(s.max) < 1e6 else f"{s.max:.3e}")
    c3.metric("Mean", f"{s.mean:.4f}" if abs(s.mean) < 1e6 else f"{s.mean:.3e}")
    c4.metric("Median", f"{s.median:.4f}" if abs(s.median) < 1e6 else f"{s.median:.3e}")

    c5, c6 = st.columns(2)
    c5.metric("Std Dev", f"{s.std_dev:.4f}")
    c6.metric("Range", f"{s.max - s.min:.4f}")

    # Coverage bar
    total = s.valid_count + s.no_data_count
    pct_valid = s.valid_count / total if total > 0 else 0
    st.markdown(f"**Valid pixels:** {s.valid_count:,} / {total:,} ({pct_valid*100:.1f}%)")
    st.progress(pct_valid)

    # Distribution visualization
    st.markdown("**Distribution relative to mean ± σ**")
    fig = go.Figure()
    points = {
        "Min": s.min,
        "Mean−σ": s.mean - s.std_dev,
        "Mean": s.mean,
        "Mean+σ": s.mean + s.std_dev,
        "Max": s.max,
    }
    labels, values = zip(*points.items())
    fig.add_trace(go.Scatter(
        x=values, y=[1]*len(values),
        mode="markers+text",
        marker=dict(size=[8, 10, 14, 10, 8], color=["#58a6ff", "#3fb950", "#ff7b72", "#3fb950", "#58a6ff"]),
        text=labels, textposition="top center",
        hovertemplate="%{text}: %{x:.4f}<extra></extra>",
    ))
    fig.update_layout(
        height=140, showlegend=False, paper_bgcolor="#161b22", plot_bgcolor="#21262d",
        font_color="#e6edf3", margin=dict(l=0, r=0, t=30, b=10),
        yaxis=dict(visible=False), xaxis=dict(color="#8b949e"),
    )
    st.plotly_chart(fig, use_container_width=True)

# ── HISTOGRAM TAB ─────────────────────────────────────────────────────────────
with tab_hist:
    sel_bh = st.selectbox("Band", range(meta.band_count),
                          format_func=lambda i: f"Band {i+1}", key="hist_band")
    hcol1, hcol2 = st.columns([3, 1])
    with hcol2:
        bins = st.slider("Bins", 16, 256, 64, 8)
        log_scale = st.checkbox("Log scale", value=False)

    with st.spinner("Building histogram..."):
        data_h = get_band_data(sel_bh)
        nd = meta.no_data_value
        centers, counts = compute_histogram(data_h, nd, bins)

    if len(centers):
        s_h = get_band_stats(sel_bh)
        y_vals = np.log10(counts + 1) if log_scale else counts
        y_label = "log₁₀(count + 1)" if log_scale else "Pixel count"

        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=centers, y=y_vals,
            marker_color="#1f6feb", marker_line_width=0,
            hovertemplate="Value: %{x:.4f}<br>Count: %{customdata:,}<extra></extra>",
            customdata=counts,
            name="Frequency",
        ))
        # Mean line
        mean_y = np.log10(counts.max() + 1) if log_scale else counts.max()
        fig.add_vline(x=s_h.mean, line_dash="dash", line_color="#58a6ff",
                      annotation_text="μ", annotation_font_color="#58a6ff")
        fig.add_vline(x=s_h.mean - s_h.std_dev, line_dash="dot", line_color="#484f58")
        fig.add_vline(x=s_h.mean + s_h.std_dev, line_dash="dot", line_color="#484f58")

        fig.update_layout(
            height=350, showlegend=False,
            paper_bgcolor="#161b22", plot_bgcolor="#21262d",
            font_color="#e6edf3",
            margin=dict(l=0, r=0, t=10, b=0),
            xaxis=dict(title="Pixel value", color="#8b949e", gridcolor="#30363d"),
            yaxis=dict(title=y_label, color="#8b949e", gridcolor="#30363d"),
        )
        st.plotly_chart(fig, use_container_width=True)

        mc1, mc2, mc3 = st.columns(3)
        mc1.metric("Min", f"{s_h.min:.4f}")
        mc2.metric("Mean", f"{s_h.mean:.4f}")
        mc3.metric("Max", f"{s_h.max:.4f}")
    else:
        st.warning("No valid data in this band.")

# ── BAND MATH TAB ─────────────────────────────────────────────────────────────
with tab_bmath:
    bm_c1, bm_c2 = st.columns([1, 1])

    with bm_c1:
        st.markdown("#### Presets")
        preset_names = [p.name for p in PRESETS]
        preset_sel = st.selectbox("Choose preset", preset_names)
        preset = next(p for p in PRESETS if p.name == preset_sel)

        if preset.id != "custom":
            st.info(preset.description, icon="ℹ️")

        st.markdown("#### Formula")
        formula = st.text_area(
            "Expression (use b1, b2, b3...)",
            value=preset.formula,
            height=80,
        )
        st.caption("Available: `np.sqrt`, `np.log`, `np.abs`, `np.where`, `+`, `-`, `*`, `/`")

    with bm_c2:
        st.markdown("#### Output settings")
        bm_cmap = st.selectbox("Colormap", COLORMAPS,
                               index=COLORMAPS.index(preset.colormap) if preset.colormap in COLORMAPS else 0,
                               format_func=lambda k: COLORMAP_LABELS.get(k, k),
                               key="bm_cmap")
        bm_min = st.number_input("Range min", value=float(preset.range[0]), format="%.3f")
        bm_max = st.number_input("Range max", value=float(preset.range[1]), format="%.3f")
        bm_opacity = st.slider("Opacity", 0.0, 1.0, 0.9, key="bm_opacity")

    if st.button("▶ Run Band Math", type="primary", use_container_width=True):
        with st.spinner("Computing..."):
            try:
                n = meta.band_count
                bands_dict = {}
                for i in range(n):
                    bands_dict[f"b{i+1}"] = get_band_data(i)

                result = evaluate_band_math(formula, bands_dict)
                nd = meta.no_data_value

                # Render result
                from utils.geotiff_utils import render_band_rgba
                rgba_bm = render_band_rgba(
                    result, bm_min, bm_max, bm_cmap,
                    no_data_value=None,  # NaN already handled
                    opacity=bm_opacity,
                )
                # Set NaN pixels transparent
                rgba_bm[np.isnan(result), 3] = 0

                st.session_state.bmath_rgba = rgba_bm
                st.session_state.bmath_range = (bm_min, bm_max, bm_cmap)
                st.success(f"✅ Band math applied! Switch to **Map** tab to see the result.")

                # Show stats
                valid = result[np.isfinite(result)]
                if len(valid):
                    brs1, brs2, brs3, brs4 = st.columns(4)
                    brs1.metric("Min", f"{valid.min():.4f}")
                    brs2.metric("Max", f"{valid.max():.4f}")
                    brs3.metric("Mean", f"{valid.mean():.4f}")
                    brs4.metric("Std Dev", f"{valid.std():.4f}")

                # Quick histogram of result
                counts_bm, edges_bm = np.histogram(valid, bins=50)
                centers_bm = (edges_bm[:-1] + edges_bm[1:]) / 2
                fig_bm = go.Figure(go.Bar(
                    x=centers_bm, y=counts_bm,
                    marker_color="#3fb950", marker_line_width=0,
                    hovertemplate="Value: %{x:.4f}<br>Count: %{y:,}<extra></extra>",
                ))
                fig_bm.update_layout(
                    height=200, showlegend=False,
                    paper_bgcolor="#161b22", plot_bgcolor="#21262d",
                    font_color="#e6edf3",
                    margin=dict(l=0, r=0, t=10, b=0),
                    xaxis=dict(title="Result value", color="#8b949e", gridcolor="#30363d"),
                    yaxis=dict(title="Count", color="#8b949e", gridcolor="#30363d"),
                )
                st.plotly_chart(fig_bm, use_container_width=True)

            except Exception as e:
                st.error(f"Error: {e}")

    if st.session_state.bmath_rgba is not None:
        if st.button("🗑️ Clear band math overlay"):
            st.session_state.bmath_rgba = None
            st.session_state.bmath_range = None
            st.rerun()
