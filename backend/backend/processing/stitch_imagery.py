# stitch_images.py

import rasterio
from rasterio.merge import merge
from typing import List
from pathlib import Path

OUTPUT_BASE = Path("./data")
OUTPUT_BEFORE = OUTPUT_BASE / "LULC_Before"
OUTPUT_AFTER = OUTPUT_BASE / "LULC_After"
OUTPUT_BEFORE.mkdir(parents=True, exist_ok=True)
OUTPUT_AFTER.mkdir(parents=True, exist_ok=True)


def stitch_images(image_paths: List[str], year, location_id: str) -> str:
    """
    Stitches multiple georeferenced satellite image tiles into a single image.

    Parameters
    ----------
    image_paths : List[str]
        List of paths to downloaded satellite image tiles (GeoTIFFs)

    output_path : str
        Path to save the final stitched image

    Returns
    -------
    str
        Path to the final stitched image
    """
    for p in image_paths:
        print(f"{image_paths}\n")
    srcs = [rasterio.open(p) for p in image_paths]
    fileName = f"{location_id}_{year}.tif"
    file_path = OUTPUT_AFTER / fileName

    print(f"Stitching {len(srcs)} satellite tiles...")

    # Merge tiles
    mosaic, transform = merge(srcs)

    # Copy metadata from first tile
    meta = srcs[0].meta.copy()
    meta.update({
        "height": mosaic.shape[1],
        "width": mosaic.shape[2],
        "transform": transform
    })

    # Save final stitched image
    with rasterio.open(file_path, "w", **meta) as dst:
        dst.write(mosaic)

    # Close all files
    for s in srcs:
        s.close()

    print(f"Final stitched image saved to: {file_path}")
    return file_path
