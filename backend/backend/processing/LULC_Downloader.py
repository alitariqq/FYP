# ==========================================
# PHASE 1: DOWNLOADER (FIXED)
# ==========================================
import os
import pystac_client
import planetary_computer
import stackstac
import pyproj
import numpy as np
import xarray as xr
from shapely.geometry import box, mapping
from shapely.ops import transform
import rioxarray
from dask.diagnostics import ProgressBar
from pathlib import Path

OUTPUT_BASE = Path("./data")
OUTPUT_BEFORE = OUTPUT_BASE / "LULC_Before"
OUTPUT_AFTER = OUTPUT_BASE / "LULC_After"
OUTPUT_BEFORE.mkdir(parents=True, exist_ok=True)
OUTPUT_AFTER.mkdir(parents=True, exist_ok=True)


def get_3857_params(lat: float, lon: float, radius_km: float):
    wgs84 = pyproj.CRS("EPSG:4326")
    web_mercator = pyproj.CRS("EPSG:3857")
    to_3857 = pyproj.Transformer.from_crs(wgs84, web_mercator, always_xy=True).transform
    to_wgs = pyproj.Transformer.from_crs(web_mercator, wgs84, always_xy=True).transform
    x_c, y_c = to_3857(lon, lat)
    x_c, y_c = round(x_c / 10) * 10, round(y_c / 10) * 10
    r_m = radius_km * 1000
    bounds_3857 = (x_c - r_m, y_c - r_m, x_c + r_m, y_c + r_m)
    wgs_geom = mapping(transform(to_wgs, box(*bounds_3857)))
    return bounds_3857, wgs_geom

def download_manzar_lulc_data(lat, lon, radius_km, file_path, esa_path, target_year):
    print(f"\n🚀 PHASE 1: Full-Spectrum Processing")
    bounds_3857, wgs_geom = get_3857_params(lat, lon, radius_km)
    catalog = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=planetary_computer.sign_inplace)

    # 1. Search
    s2_search = catalog.search(collections=["sentinel-2-l2a"], intersects=wgs_geom, 
                               datetime=f"{target_year}-01-01/{target_year}-12-31", query={"eo:cloud_cover": {"lt": 20}})
    s2_items = list(s2_search.items())
    
    esa_search = catalog.search(collections=["esa-worldcover"], intersects=wgs_geom)
    esa_items = list(esa_search.items())
    
    if not s2_items or not esa_items:
        print("❌ Data not found.")
        return None, None

    # 2. Stack (FIXED TYPES)
    spectral_assets = ["B02", "B03", "B04", "B05", "B06", "B07", "B08", "B11", "B12"]
    
    s2_stack = stackstac.stack(
        s2_items, 
        assets=spectral_assets + ["SCL"], 
        bounds=bounds_3857,
        epsg=3857, 
        resolution=10, 
        dtype="float32", 
        fill_value=np.float32(np.nan), # FIX: Explicit 32-bit NaN
        rescale=False
    )
    
    esa_stack = stackstac.stack(
        esa_items, 
        assets=["map"], 
        bounds=bounds_3857, 
        epsg=3857, 
        resolution=10, 
        dtype="uint8", 
        fill_value=np.uint8(0), # FIX: Explicit 8-bit Integer
        rescale=False
    )

    # 3. Process
    offsets = [1000.0 if float(str(item.properties.get("s2:processing_baseline", "0.0"))) >= 4.0 else 0.0 for item in s2_items]
    offset_da = xr.DataArray(offsets, coords={'time': s2_stack.time}, dims=['time'])
    
    scl_mask = s2_stack.sel(band="SCL").isin([0, 1, 3, 8, 9, 10, 11])
    clean_s2 = ((s2_stack.sel(band=spectral_assets).where(~scl_mask) - offset_da) / 10000.0).clip(0, 1)

    with ProgressBar():
        final_img = clean_s2.median(dim="time", skipna=True).compute()
        final_mask = esa_stack.sel(band="map").isel(time=0).compute() # FIX: .isel instead of .first

    # 4. Remap & Save
    # Mapping Strategy defined in the Strategic Framework
    mapping_dict = {
        10: 0,  # Tree cover
        20: 1,  # Shrubland
        30: 2,  # Grassland
        40: 3,  # Cropland
        50: 4,  # Built-up
        60: 5,  # Bare / Sparse
        80: 6,  # Permanent Water
        95: 7   # Mangroves
    }
    remapped_mask = np.full(final_mask.shape, 255, dtype=np.uint8)
    for esa_val, model_idx in mapping_dict.items():
        remapped_mask[final_mask.values == esa_val] = model_idx

    
    # Save Image with Band Names for Phase 2
    final_img.rio.to_raster(file_path, compress="LZW", tiled=True)
    mask_xr = xr.DataArray(remapped_mask, coords=final_mask.coords, dims=final_mask.dims)
    mask_xr.rio.write_crs("EPSG:3857", inplace=True).rio.to_raster(esa_path, compress="LZW", dtype="uint8")

def LULC_Image_Downloader(lat,lon,year,location_id):
    print("Starting Image Acquistion process:\n")

    fileName = f"{location_id}_{year}.tif"
    file_path = OUTPUT_AFTER / fileName
    esa_path = f"{location_id}_ESA_{year}.tif"

    if file_path.exists():
        print("Already Exists, passing for inference")
        return file_path

    try:
        download_manzar_lulc_data(lat, lon, radius_km=3, file_path=file_path, esa_path=esa_path, target_year=year)
    except Exception as errorInfo:
        print(f"❌ Failed {location_id}: {errorInfo}")
    
    if file_path.exists():
        return str(file_path)
    
    return None

def LULC_Temp_Downloader(lat,lon,location_id):
    tempRet = LULC_Image_Downloader(lat,lon,2021,location_id)
    return tempRet
    

