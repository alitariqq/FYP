from pathlib import Path
import torch
import numpy as np
import rasterio

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

BASE_DIR = Path(__file__).resolve().parent / "models"
MODEL_PT_PATH =  BASE_DIR / "amazon_deforestation_v1.pt"

OUTPUT_BASE = Path("./data")
OUTPUT_MASK = OUTPUT_BASE / "Amazon_Mask"

MODEL_PATH = MODEL_PT_PATH
THRESHOLD = 0.4
TILE_SIZE = 512
TARGET_CHANNELS = 9


# -------------------------------------------------
# Load model ONCE (important for Celery workers)
# -------------------------------------------------
_model = None

def load_model():
    global _model
    if _model is None:
        _model = torch.jit.load(MODEL_PATH, map_location=DEVICE)
        _model.eval()
    return _model


# -------------------------------------------------
# Helpers
# -------------------------------------------------
def pad_channels(img, target=9):
    c, h, w = img.shape
    if c < target:
        pad = np.zeros((target - c, h, w), dtype=img.dtype)
        img = np.concatenate([img, pad], axis=0)
    return img[:target]


def preprocess(path):
    with rasterio.open(path) as src:
        img = src.read()[:, :TILE_SIZE, :TILE_SIZE]
        meta = src.meta.copy()

    img = pad_channels(img, TARGET_CHANNELS).astype(np.float32)

    if img.max() > 2.0:
        img /= 3000.0

    img = np.clip(img, 0, 1)

    return img, meta


# -------------------------------------------------
# MAIN FUNCTION YOU WANT
# -------------------------------------------------
def generate_deforestation_mask(before_path, after_path, location_id):
    """
    before_path  -> Sentinel before image (.tif)
    after_path   -> Sentinel after image (.tif)
    location_id -> used to generate Path to save mask file (.tif)

    returns: output_path
    """
    print("Starting Mask Generation")

    mask_name = f"{location_id}_MASK.tif"
    mask_path = OUTPUT_MASK / mask_name

    model = load_model()
    print("Model Loaded")

    imgA, meta = preprocess(before_path)
    imgB, _ = preprocess(after_path)
    print("Image Preprocessing Complete")

    x = np.concatenate([imgA, imgB], axis=0)   # 18 channels
    print("Image NP Concatenated")
    x = torch.from_numpy(x).unsqueeze(0).to(DEVICE)
    print("Tensor Loaded, Running Model:")
    with torch.no_grad():
        logits = model(x)
        probs = torch.sigmoid(logits)
        mask = (probs > THRESHOLD).float().cpu().numpy()[0, 0]

    print("Model Work Complete, Saving image as GeoTIFF:")

    # Save mask as GeoTIFF
    out_meta = {
        "driver": "GTiff",
        "height": meta["height"],
        "width": meta["width"],
        "count": 1,
        "dtype": "uint8",
        "crs": meta["crs"],
        "transform": meta["transform"],
        "nodata": 0,          # <-- FIX (must be integer)
        "compress": "lzw"
    }

    print("Saving GEOTIFF to Parh:")
    with rasterio.open(mask_path, "w", **meta) as dst:
        dst.write((mask * 255).astype(np.uint8), 1)

    print("If successful, Image saved to", mask_path)
    return str(mask_path)
