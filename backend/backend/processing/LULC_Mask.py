import numpy as np
import rasterio
from matplotlib.colors import ListedColormap
from pathlib import Path
from PIL import Image

OUTPUT_BASE = Path("./data")
OUTPUT_MASK = OUTPUT_BASE / "LULC_Mask"
OUTPUT_MASK.mkdir(parents=True, exist_ok=True)

# MANZAR Color Palette (Hex → RGB 0-255)
COLORS_HEX = [
    "#228B22", "#808000", "#CD853F", "#FFD700",
    "#DC143C", "#C0C0C0", "#0000FF", "#008080"
]
COLORS_RGB = [tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) for h in COLORS_HEX]

def save_colored_mask(mask_path: str, year,location_id: str | Path = None) -> str:
    """
    Saves a colored PNG from a predicted LULC mask (GeoTIFF) without axes, borders, or colorbars.
    The output image keeps the same resolution as the input mask.

    Args:
        mask_path: path to GeoTIFF mask (0-7 class indices)
        location_id: optional name/id for the output file

    Returns:
        str: path to the saved PNG
    """
    mask_path = Path(mask_path)
    mask_name = f"LULC_{location_id}_MASK.png" if location_id else mask_path.stem + "_LULC_MASK.png"
    png_path = OUTPUT_MASK / mask_name

    # Read mask
    with rasterio.open(mask_path) as src:
        mask = src.read(1).astype(np.uint8)

    # Map class indices to RGB
    h, w = mask.shape
    rgb_array = np.zeros((h, w, 3), dtype=np.uint8)
    for i, color in enumerate(COLORS_RGB):
        rgb_array[mask == i] = color

    # Save PNG
    img = Image.fromarray(rgb_array)
    img.save(png_path)

    print(f"Colored mask saved → {png_path}")
    return str(png_path)
