import pystac_client
import planetary_computer
import stackstac
import pyproj
import numpy as np
import xarray as xr
from shapely.geometry import box, mapping
from shapely.ops import transform
import rioxarray
from scipy.ndimage import binary_dilation
from dask.diagnostics import ProgressBar
import os
from pathlib import Path


OUTPUT_BASE = Path("./data")
OUTPUT_BEFORE = OUTPUT_BASE / "Amazon_Before"
OUTPUT_AFTER = OUTPUT_BASE / "Amazon_After"
OUTPUT_BEFORE.mkdir(parents=True, exist_ok=True)
OUTPUT_AFTER.mkdir(parents=True, exist_ok=True)

# ==========================================
# 1. UTM ALIGNMENT (Unchanged)
# ==========================================
def get_utm_params(lat: float, lon: float, radius_km: float):
    utm_zone = int((lon + 180) / 6) + 1
    epsg = 32600 + utm_zone
    wgs84, utm = pyproj.CRS("EPSG:4326"), pyproj.CRS.from_epsg(epsg)
    to_utm = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
    to_wgs = pyproj.Transformer.from_crs(utm, wgs84, always_xy=True).transform
    x_c, y_c = to_utm(lon, lat)
    r_m = radius_km * 1000
    utm_bounds = (x_c - r_m, y_c - r_m, x_c + r_m, y_c + r_m)
    wgs_geom = mapping(transform(to_wgs, box(*utm_bounds)))
    return utm_bounds, epsg, wgs_geom

# ==========================================
# 2. DOWNLOADER (Modified Naming/Paths)
# ==========================================
def download_clean_mosaic(lat: float, lon: float, radius_km: float, target_date: str, output_dir: str):
    # Enforce directory existence inside the function (Safety check)
    
    utm_bounds, epsg, wgs_geom = get_utm_params(lat, lon, radius_km)
    
    catalog = pystac_client.Client.open(
        "https://planetarycomputer.microsoft.com/api/stac/v1",
        modifier=planetary_computer.sign_inplace
    )

    # Date Logic
    year = int(target_date.strip())
    center = np.datetime64(f"{year}-07-01")
    start_dt = center - np.timedelta64(120, 'D')
    end_dt   = center + np.timedelta64(120, 'D')
    datetime_query = f"{str(start_dt)[:10]}/{str(end_dt)[:10]}"
    
    print(f"→ Searching: {datetime_query}  (cloud < 50%)")

    search = catalog.search(
        collections=["sentinel-2-l2a"],
        intersects=wgs_geom,
        datetime=datetime_query,
        query={"eo:cloud_cover": {"lt": 50}},
        sortby=[{"field": "properties.eo:cloud_cover", "direction": "asc"}]
    )
    
    items = list(search.items())[:15]
    if not items:
        print("❌ No scenes found.")
        return None
    
    print(f"📡 Found {len(items)} scenes.")

    # StackStac Logic
    assets = ["B02", "B03", "B04", "B08", "B11", "B12", "SCL"]
    stack = stackstac.stack(
        items,
        assets=assets,
        bounds=utm_bounds,
        epsg=epsg,
        resolution=10,
        dtype="float32",
        rescale=False,
        fill_value=np.float32(np.nan)
    )

    print("🛠️ Processing Cloud Masks...")
    scl = stack.sel(band="SCL").compute()
    mask = np.isin(scl, [0, 1, 3, 8, 9, 10, 11])
    
    dilated_mask = np.zeros_like(mask, dtype=bool)
    for t in range(mask.shape[0]):
        dilated_mask[t] = binary_dilation(mask[t], iterations=4)
    
    mask_da = xr.DataArray(dilated_mask, coords=scl.coords, dims=scl.dims)
    
    print("⚖️ Applying Baseline Corrections...")
    offsets = [1000.0 if float(item.properties.get("s2:processing_baseline", "02.00")) >= 4.0 else 0.0 for item in items]
    offset_da = xr.DataArray(offsets, coords={'time': stack.time}, dims=['time'])
    ref_bands = [b for b in assets if b != "SCL"]
    final_stack = ((stack.sel(band=ref_bands).where(~mask_da) - offset_da) / 10000.0).clip(0, 1)

    print("✨ Computing Median Composite...")
    with ProgressBar():
        mosaic = final_stack.median(dim="time", skipna=True).compute()
    
    print("🩹 Healing gaps...")
    mosaic = mosaic.sortby("x").sortby("y")
    mosaic = mosaic.interpolate_na(dim="x", method="linear").interpolate_na(dim="y", method="linear")
    mosaic = mosaic.ffill(dim="x").bfill(dim="x").ffill(dim="y").bfill(dim="y")
    
    mosaic = mosaic.rio.write_crs(f"EPSG:{epsg}").rio.clip([wgs_geom], crs="EPSG:4326")
    
    mosaic.rio.to_raster(output_dir, compress="LZW", tiled=True, dtype="float32")
    
    print(f"✅ SUCCESS: Saved as {output_dir}")
    return mosaic

# ==========================================
# 3. EXECUTION (Modified Directory Structure)
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
        download_clean_mosaic(
            lat=lat,
            lon=lon,
            radius_km=2.56,
            target_date="2018",
            output_dir=before_path  # Passing the specific Year dir
        )
        print("   ✓ Done")
    except Exception as e:
        print(f"   ✗ Failed: {str(e)}")
        failed.append((site_id, year))

    # Second download
    try:
        download_clean_mosaic(
            lat=lat,
            lon=lon,
            radius_km=2.56,
            target_date="2024",
            output_dir=after_path  # Passing the specific Year dir
        )
        print("   ✓ Done")
    except Exception as e:
        print(f"   ✗ Failed: {str(e)}")
        failed.append((site_id, year))


    if before_path.exists() and after_path.exists():
        return str(before_path), str(after_path)

    # if only one exists, clean up
    if before_path.exists():
        before_path.unlink()
    return None, None