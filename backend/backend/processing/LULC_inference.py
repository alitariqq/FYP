# backend/processing/lulc_inference.py

import os
import numpy as np
import torch
import rasterio
from pathlib import Path

# ==========================================
# CONFIG
# ==========================================

NUM_CLASSES = 8
IN_CHANNELS = 14
PATCH_SIZE = 512
OVERLAP = 0.5

BASE_DIR = Path(__file__).resolve().parent / "models"
MODEL_PT_PATH = BASE_DIR / "manzar_lulc_try_1.pt"

OUTPUT_BASE = Path("./data")
OUTPUT_MASK = OUTPUT_BASE / "LULC_Mask"
OUTPUT_MASK.mkdir(parents=True, exist_ok=True)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_MODEL = None   # cached singleton


# ==========================================
# MODEL LOADING (TorchScript)
# ==========================================

def _load_model():
    global _MODEL
    if _MODEL is None:
        print(f"Loading TorchScript model from: {MODEL_PT_PATH}")
        _MODEL = torch.jit.load(MODEL_PT_PATH, map_location=DEVICE)
        _MODEL.eval()
    return _MODEL


# ==========================================
# FEATURE ENGINEERING
# ==========================================

def _compute_indices(img):
    img = img.astype(np.float32)

    b2, b3, b4, b5, b6, b7, b8, b11, b12 = img
    eps = 1e-8

    ndvi = (b8 - b4) / (b8 + b4 + eps)
    ndwi = (b3 - b8) / (b3 + b8 + eps)
    ndmi = (b8 - b11) / (b8 + b11 + eps)
    ndsi = (b3 - b11) / (b3 + b11 + eps)

    re_num = ((b4 + b7) / 2) - b5
    re_denom = b6 - b5 + eps
    s2rep = (705.0 + 35.0 * (re_num / re_denom) - 700.0) / 50.0
    s2rep = np.clip(s2rep, 0, 1)

    features = np.stack([ndvi, ndwi, ndmi, ndsi, s2rep])
    full = np.concatenate([img, features], axis=0)

    full[:9] = np.clip(full[:9], 0, 1)
    full[9:13] = np.clip(full[9:13], -1, 1)
    full[13] = np.clip(full[13], 0, 1)

    return full


# ==========================================
# CORE INFERENCE
# ==========================================

def _predict(full_stack, model):
    C, H, W = full_stack.shape

    pad_h = (PATCH_SIZE - H % PATCH_SIZE) % PATCH_SIZE
    pad_w = (PATCH_SIZE - W % PATCH_SIZE) % PATCH_SIZE

    padded = np.pad(full_stack, ((0, 0), (0, pad_h), (0, pad_w)), mode="reflect")
    H_pad, W_pad = padded.shape[1:]
    stride = int(PATCH_SIZE * (1 - OVERLAP))

    counts = np.zeros((H_pad, W_pad), dtype=np.float32)
    probs = np.zeros((NUM_CLASSES, H_pad, W_pad), dtype=np.float32)

    with torch.no_grad():
        for y in range(0, H_pad - PATCH_SIZE + 1, stride):
            for x in range(0, W_pad - PATCH_SIZE + 1, stride):
                patch = padded[:, y:y+PATCH_SIZE, x:x+PATCH_SIZE]
                tensor = torch.from_numpy(patch).unsqueeze(0).float().to(DEVICE)
                logits = model(tensor)
                score = torch.softmax(logits, dim=1).cpu().numpy()[0]
                probs[:, y:y+PATCH_SIZE, x:x+PATCH_SIZE] += score
                counts[y:y+PATCH_SIZE, x:x+PATCH_SIZE] += 1

    avg = probs / np.maximum(counts, 1e-6)
    pred = np.argmax(avg, axis=0).astype(np.uint8)
    return pred[:H, :W]


# ==========================================
# PUBLIC FUNCTION FOR MANZAR
# ==========================================

def run_lulc_inference(image_path: str, year, location_id: str | None = None) -> str:
    """
    Runs LULC inference on a GeoTIFF and saves prediction mask.

    Args:
        image_path: path to downloaded Sentinel-2 image
        location_id: optional identifier to name the mask

    Returns:
        path to saved mask
    """

    mask_name = f"LULC_{location_id}_{year}MASK.tif" if location_id else Path(image_path).stem + "_LULC_MASK.tif"
    mask_path = OUTPUT_MASK / mask_name

    print(f"Processing image: {image_path}")
    model = _load_model()
    print("Model loaded successfully")

    with rasterio.open(image_path) as src:
        img = src.read()
        profile = src.profile.copy()

    full_stack = _compute_indices(img)
    pred_mask = _predict(full_stack, model)
    print(f"Prediction complete, saving mask to: {mask_path}")

    profile.update(dtype=rasterio.uint8, count=1, nodata=255)

    with rasterio.open(mask_path, "w", **profile) as dst:
        dst.write(pred_mask, 1)

    return str(mask_path)
