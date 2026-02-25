import math
import pyproj
from processing.LULC_Downloader import LULC_Image_Downloader

TILE_RADIUS_KM = 3.0          # fixed constraint
TILE_SIZE_M = TILE_RADIUS_KM * 2000  # 6km squares


def download_large_area(lat, lon, radius_km, year, location_id):
    """
    Splits request into 3km-radius tiles (6x6km squares)
    and calls download_fn(tile_lat, tile_lon, 3).

    Returns list of results from each download.
    """

    to_3857 = pyproj.Transformer.from_crs(
        "EPSG:4326", "EPSG:3857", always_xy=True
    )
    to_4326 = pyproj.Transformer.from_crs(
        "EPSG:3857", "EPSG:4326", always_xy=True
    )

    cx, cy = to_3857.transform(lon, lat)

    request_radius_m = radius_km * 1000

    minx = cx - request_radius_m
    maxx = cx + request_radius_m
    miny = cy - request_radius_m
    maxy = cy + request_radius_m

    # ROUND UP happens here
    nx = math.ceil((maxx - minx) / TILE_SIZE_M)
    ny = math.ceil((maxy - miny) / TILE_SIZE_M)

    print(f"{nx} x {ny} grid → {nx*ny} tiles")

    results = []
    tile_count = 0
    for i in range(nx):
        for j in range(ny):
            tile_count = tile_count + 1
            tx = minx + (i + 0.5) * TILE_SIZE_M
            ty = miny + (j + 0.5) * TILE_SIZE_M
            tile_location_id = location_id + str(tile_count)

            tile_lon, tile_lat = to_4326.transform(tx, ty)

            result = LULC_Image_Downloader(
                tile_lat,
                tile_lon,
                year,
                tile_location_id
            )

            results.append(result)

    return results
