# stitch_masks.py

import rasterio
from rasterio.merge import merge
from typing import List
from pathlib import Path

OUTPUT_BASE = Path("./data")
OUTPUT_MASK = OUTPUT_BASE / "LULC_Mask"
OUTPUT_MASK.mkdir(parents=True, exist_ok=True)

def stitch_masks(mask_paths: List[str], year,location_id: str) -> str:
    """
    Stitches multiple mask tiles into a single mask GeoTIFF.

    Parameters
    ----------
    mask_paths : List[str]
        List of paths to mask GeoTIFFs

    output_path : str
        Path to save the final stitched mask

    Returns
    -------
    str
        Path to the final stitched mask
    """

    m_name = f"LULC_{location_id}_{year}MASK.tif"
    output_path = OUTPUT_MASK / m_name

    srcs = [rasterio.open(p) for p in mask_paths]

    print(f"Stitching {len(srcs)} mask tiles...")

    # Merge mask tiles
    mosaic, transform = merge(srcs)

    # Copy metadata from first mask
    meta = srcs[0].meta.copy()
    meta.update({
        "height": mosaic.shape[1],
        "width": mosaic.shape[2],
        "transform": transform
    })

    # Save final stitched mask
    with rasterio.open(output_path, "w", **meta) as dst:
        dst.write(mosaic)

    # Close all files
    for s in srcs:
        s.close()

    print(f"Final stitched mask saved to: {output_path}")
    return output_path
