import pystac_client
import planetary_computer
import stackstac
import pyproj
import numpy as np
import xarray as xr
from shapely.geometry import box, mapping
from shapely.ops import transform
from dask.diagnostics import ProgressBar
import rioxarray
import os
from scipy.ndimage import median_filter
from scipy.spatial import cKDTree
from typing import Tuple, List
import time
from pathlib import Path



OUTPUT_BASE = Path("./data")
OUTPUT_BEFORE = OUTPUT_BASE / "Amazon_Before"
OUTPUT_AFTER = OUTPUT_BASE / "Amazon_After"
OUTPUT_BEFORE.mkdir(parents=True, exist_ok=True)
OUTPUT_AFTER.mkdir(parents=True, exist_ok=True)

# ==========================================
# 1. PIXEL-PERFECT UTM ALIGNMENT
# ==========================================
def get_utm_params(lat: float, lon: float, radius_km: float):
    """Aligns target coordinates with the 10m Sentinel-2 pixel grid."""
    utm_zone = int((lon + 180) / 6) + 1
    epsg = 32600 + utm_zone
    wgs84, utm = pyproj.CRS("EPSG:4326"), pyproj.CRS.from_epsg(epsg)
    to_utm = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
    to_wgs = pyproj.Transformer.from_crs(utm, wgs84, always_xy=True).transform
    x_c, y_c = to_utm(lon, lat)
    x_c, y_c = round(x_c / 10) * 10, round(y_c / 10) * 10
    r_m = radius_km * 1000
    utm_bounds = (x_c - r_m, y_c - r_m, x_c + r_m, y_c + r_m)
    wgs_geom = mapping(transform(to_wgs, box(*utm_bounds)))
    return utm_bounds, epsg, wgs_geom

# ==========================================
# 2. SPATIAL HEALING & FILTERING
# ==========================================
def heal_missing_pixels(data: xr.DataArray, max_distance: int = 150) -> xr.DataArray:
    """Fills NoData voids using cKDTree nearest neighbor interpolation."""
    data_interp = data.copy()
    for band_idx in range(data.shape[0]):
        band_data = data[band_idx].values
        if np.any(np.isnan(band_data)):
            mask = ~np.isnan(band_data)
            valid_coords = np.argwhere(mask)
            invalid_coords = np.argwhere(~mask)
            if len(valid_coords) > 0 and len(invalid_coords) > 0:
                tree = cKDTree(valid_coords)
                dist, idx = tree.query(invalid_coords, k=1)
                fill_mask = dist < max_distance
                band_data[~mask] = np.where(fill_mask, band_data[mask][idx], np.nan)
            data_interp[band_idx].values = band_data
    return data_interp

# ==========================================
# 3. MASTER DOWNLOADER (CONFLICT FIXED)
# ==========================================
def download_perfect_imagery(lat: float, lon: float, radius_km: float, target_year: int, label: str, output_dir: str):
    start_time = time.time()
    print(f"\n{'='*70}\n🚀 PROCESSING: {label.upper()} ({target_year})\n{'='*70}")
    

    utm_bounds, epsg, wgs_geom = get_utm_params(lat, lon, radius_km)
    catalog = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", 
                                        modifier=planetary_computer.sign_inplace)

    # Recursive fallback strategy for cloudy regions like Brazil
    items = []
    strategies = [
        (20, "sentinel-2-l2a", 0), (50, "sentinel-2-l2a", 0),
        (80, "sentinel-2-l2a", 0), (80, "sentinel-2-l1c", 0),
        (80, "sentinel-2-l2a", -1)
    ]

    for cloud_limit, coll, yr_off in strategies:
        search_year = target_year + yr_off
        if lat >= 0: dr = f"{search_year}-05-01/{search_year}-10-31"
        else: dr = f"{search_year}-11-01/{search_year + 1}-01-31"

        search = catalog.search(collections=[coll], intersects=wgs_geom, datetime=dr,
                                query={"eo:cloud_cover": {"lt": cloud_limit}},
                                sortby=[{"field": "properties.eo:cloud_cover", "direction": "asc"}])
        items = list(search.items())
        if len(items) >= 10: break

    if not items: return print(f"❌ No data found for {label} in {target_year}.")

    n_stack = min(20, len(items))
    print(f"   [LOG] Mosaicking top {n_stack} scenes for ultimate clarity...")
    
    processed_slices = []
    reflectance_bands = ["B02", "B03", "B04", "B08", "B11", "B12"]

    for i, item in enumerate(items[:n_stack]):
        slice_cube = stackstac.stack(item, assets=reflectance_bands + ["SCL"],
                                    bounds=utm_bounds, epsg=epsg, resolution=10,
                                    dtype="float64", rescale=True, fill_value=np.nan).squeeze()
        
        # Radiometric Harmonization: Forces color consistency
        pb = item.properties.get("s2:processing_baseline", "02.00")
        if (float(pb) >= 4.0 if pb.replace('.','',1).isdigit() else pb >= "04.00"):
            slice_cube.loc[dict(band=reflectance_bands)] -= 0.1

        # Cloud & Artifact Masking
        if "SCL" in slice_cube.band.values:
            mask = slice_cube.sel(band="SCL").isin([0, 1, 3, 8, 9, 10])
            slice_cube = slice_cube.sel(band=reflectance_bands).where(~mask)
        
        processed_slices.append(slice_cube.sel(band=reflectance_bands))

    # FIXED CONCATENATION: Added coords='minimal' to solve the coordinate conflict
    cube = xr.concat(processed_slices, dim="time", 
                     coords='minimal', 
                     compat='override', 
                     combine_attrs='override', 
                     join='override')

    print("   [LOG] Computing Median Composite (Streaming Data)...")
    with ProgressBar():
        data = cube.median(dim="time", skipna=True).compute().astype("float32")
    
    data = data.where(data >= 0, 0).rio.write_nodata(np.nan).rio.write_crs(f"EPSG:{epsg}")
    data = heal_missing_pixels(data)
    for b in range(data.shape[0]):
        data[b].values = median_filter(data[b].values, size=3)

    filename = os.path.join(output_dir)
    data.rio.to_raster(filename, compress="LZW", tiled=True, nodata=np.nan)
    print(f"✅ SUCCESS: {filename} ({time.time() - start_time:.1f}s)\n")

# ==========================================
# EXECUTION
# ==========================================
def download_pair(lat, lon, location_id):

    before_name = f"{location_id}_BEFORE.tif"
    after_name = f"{location_id}_AFTER.tif"
    before_path = OUTPUT_BEFORE / before_name
    after_path = OUTPUT_AFTER / after_name

    
    locations = [
        (lat, lon, 2.56, 2018, before_name), (lat, lon, 2.56, 2024, after_name),
    ]
    
    
    # First download
    try:
        download_perfect_imagery(lat, lon, 2.56, 2018, before_name, before_path)
    except Exception as e:
        print(f"❌ [FATAL] {before_name} (2018): {str(e)}")

    # Second download
    try:
        download_perfect_imagery(lat, lon, 2.56, 2024, after_name, after_path)
    except Exception as e:
        print(f"❌ [FATAL] {after_name} (2024): {str(e)}")

    if before_path.exists() and after_path.exists():
        return str(before_path), str(after_path)

    # if only one exists, clean up
    if before_path.exists():
        before_path.unlink()
    return None, None